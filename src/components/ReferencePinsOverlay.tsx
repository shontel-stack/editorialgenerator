import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, FileType2, Paperclip } from "lucide-react";
import {
  isImage,
  isPdf,
  isWordDoc,
  type AttachmentAssignment,
  type AttachmentWithUrl,
} from "@/lib/attachments";

type AssignOpts = { silent?: boolean; groupKey?: string | null; batchId?: string | null };

type Props = {
  references: AttachmentWithUrl[];
  /** Page dimensions in CSS px at the canvas's scaled size. */
  dim: { w: number; h: number };
  /** Canvas zoom scale (1 = 100%). Used to translate pointer deltas. */
  scale: number;
  onAssign: (
    id: string,
    patch: AttachmentAssignment,
    opts?: AssignOpts,
  ) => Promise<void> | void;
  /** When true, the overlay does not intercept pointer events on empty
   *  canvas space — so block dragging in layout-edit mode works. Pins
   *  themselves remain interactive. */
  editing?: boolean;
};

function iconFor(mime: string) {
  if (isPdf(mime)) return FileText;
  if (isImage(mime)) return ImageIcon;
  if (isWordDoc(mime)) return FileType2;
  return Paperclip;
}

function defaultPos(index: number): { x: number; y: number } {
  const step = 0.04;
  return { x: 0.05 + (index % 8) * step, y: 0.05 + Math.floor(index / 8) * step + (index % 8) * step };
}

const NUDGE_STEP = 0.005;
const NUDGE_STEP_LARGE = 0.02;

export function ReferencePinsOverlay({ references, dim, scale, onAssign, editing = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // Multi-select set. Shift/Meta/Ctrl-click toggles membership; a plain click
  // replaces the selection with just that pin.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({});
  // Stable batch id for the in-progress nudge group. Cleared on selection
  // change, mouse drag, or Escape so the next nudge starts a fresh undo step.
  const nudgeBatchRef = useRef<string | null>(null);

  // Marquee selection: a rectangle drawn on the empty canvas to lasso pins.
  // Stored in 0..1 page-relative coords so we can match against each pin's
  // logical position regardless of zoom.
  type Marquee = {
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    additive: boolean;
    baseSelection: Set<string>;
  };
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  const selectPin = (id: string, additive: boolean) => {
    nudgeBatchRef.current = null;
    setSelectedIds((prev) => {
      if (!additive) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Drag handling — pointermove updates local state, pointerup commits.
  useEffect(() => {
    if (!dragId) return;
    nudgeBatchRef.current = null;
    const onMove = (e: PointerEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      setLocalPos((p) => ({ ...p, [dragId]: { x, y } }));
    };
    const onUp = () => {
      const pos = localPos[dragId];
      if (pos) {
        void onAssign(
          dragId,
          { position_x: pos.x, position_y: pos.y, region: null },
          { groupKey: `drag:${dragId}` },
        );
      }
      setDragId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragId, localPos, onAssign]);

  // Arrow-key nudging on the currently selected pins. A single keypress that
  // moves N pins is committed as one undo step via a shared batchId.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        nudgeBatchRef.current = null;
        return;
      }
      const isArrow =
        e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!isArrow) return;
      e.preventDefault();

      const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;

      // Reuse the in-progress batch id so successive keypresses keep grouping
      // (per-id coalescing in applyPlacement merges them within its window),
      // and any new entries that get pushed share the same batchId.
      if (!nudgeBatchRef.current) {
        nudgeBatchRef.current = `nudge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      }
      const batchId = nudgeBatchRef.current;

      const updates: Record<string, { x: number; y: number }> = {};
      for (const id of selectedIds) {
        const ref = references.find((r) => r.id === id);
        if (!ref) continue;
        const i = references.indexOf(ref);
        const local = localPos[id];
        const baseX = local?.x ?? ref.position_x ?? defaultPos(i).x;
        const baseY = local?.y ?? ref.position_y ?? defaultPos(i).y;
        const nx = Math.min(1, Math.max(0, baseX + dx));
        const ny = Math.min(1, Math.max(0, baseY + dy));
        updates[id] = { x: nx, y: ny };
        void onAssign(
          id,
          { position_x: nx, position_y: ny, region: null },
          { groupKey: `nudge:${id}`, batchId },
        );
      }
      setLocalPos((p) => ({ ...p, ...updates }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, references, localPos, onAssign]);

  // Marquee drag handling (window-level for smooth tracking outside the host).
  useEffect(() => {
    if (!marquee) return;
    const onMove = (e: PointerEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const cx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const cy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      setMarquee((m) => (m ? { ...m, curX: cx, curY: cy } : m));
    };
    const onUp = () => {
      setMarquee((m) => {
        if (!m) return null;
        const x1 = Math.min(m.startX, m.curX);
        const x2 = Math.max(m.startX, m.curX);
        const y1 = Math.min(m.startY, m.curY);
        const y2 = Math.max(m.startY, m.curY);
        const hit = new Set<string>();
        references.forEach((r, i) => {
          const local = localPos[r.id];
          const px = local?.x ?? r.position_x ?? defaultPos(i).x;
          const py = local?.y ?? r.position_y ?? defaultPos(i).y;
          if (px >= x1 && px <= x2 && py >= y1 && py <= y2) hit.add(r.id);
        });
        // If the user barely moved, treat it as a click-to-clear.
        const tiny = Math.abs(m.curX - m.startX) < 0.005 && Math.abs(m.curY - m.startY) < 0.005;
        if (tiny && hit.size === 0) {
          setSelectedIds(m.additive ? m.baseSelection : new Set());
        } else if (m.additive) {
          const next = new Set(m.baseSelection);
          for (const id of hit) next.add(id);
          setSelectedIds(next);
        } else {
          setSelectedIds(hit);
        }
        nudgeBatchRef.current = null;
        return null;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [marquee, references, localPos]);

  void dim;

  const marqueeRect = marquee
    ? (() => {
        const x1 = Math.min(marquee.startX, marquee.curX);
        const x2 = Math.max(marquee.startX, marquee.curX);
        const y1 = Math.min(marquee.startY, marquee.curY);
        const y2 = Math.max(marquee.startY, marquee.curY);
        return { left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` };
      })()
    : null;

  // Live preview of pins covered by the in-progress marquee so the user sees
  // exactly what will be selected on pointer-up.
  const liveHit = (() => {
    if (!marquee) return null;
    const x1 = Math.min(marquee.startX, marquee.curX);
    const x2 = Math.max(marquee.startX, marquee.curX);
    const y1 = Math.min(marquee.startY, marquee.curY);
    const y2 = Math.max(marquee.startY, marquee.curY);
    const set = new Set<string>();
    references.forEach((r, i) => {
      const local = localPos[r.id];
      const px = local?.x ?? r.position_x ?? defaultPos(i).x;
      const py = local?.y ?? r.position_y ?? defaultPos(i).y;
      if (px >= x1 && px <= x2 && py >= y1 && py <= y2) set.add(r.id);
    });
    return set;
  })();

  // With no pins there is nothing to marquee-select, so the overlay must not
  // swallow clicks on page content (e.g. the cover TOC page links).
  const interactive = !editing && references.length > 0;

  return (
    <div
      ref={hostRef}
      className="absolute inset-0"
      style={{ zIndex: 5, pointerEvents: interactive ? undefined : "none" }}
    >
      {/* Marquee capture layer — sits behind pins, catches drags on empty canvas.
          Disabled in layout-edit mode so block dragging receives pointer events. */}
      {interactive && (
        <div
          className="absolute inset-0"
          style={{ cursor: marquee ? "crosshair" : "default" }}
          onPointerDown={(e) => {
            // Only respond to primary button on the empty layer itself.
            if (e.button !== 0) return;
            if (e.target !== e.currentTarget) return;
            const host = hostRef.current;
            if (!host) return;
            const rect = host.getBoundingClientRect();
            const sx = (e.clientX - rect.left) / rect.width;
            const sy = (e.clientY - rect.top) / rect.height;
            const additive = e.shiftKey || e.metaKey || e.ctrlKey;
            setMarquee({
              startX: sx,
              startY: sy,
              curX: sx,
              curY: sy,
              additive,
              baseSelection: additive ? new Set(selectedIds) : new Set(),
            });
            if (!additive) setSelectedIds(new Set());
            nudgeBatchRef.current = null;
          }}
        />
      )}

      {marqueeRect && (
        <div
          className="absolute pointer-events-none border border-primary/70 bg-primary/10"
          style={marqueeRect}
        />
      )}

      {references.map((r, i) => {
        const local = localPos[r.id];
        const px = local?.x ?? r.position_x ?? defaultPos(i).x;
        const py = local?.y ?? r.position_y ?? defaultPos(i).y;
        const Icon = iconFor(r.mime_type);
        const isDragging = dragId === r.id;
        const isSelected = selectedIds.has(r.id) || (liveHit?.has(r.id) ?? false);
        return (
          <button
            key={r.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const additive = e.shiftKey || e.metaKey || e.ctrlKey;
              selectPin(r.id, additive);
              if (!additive) setDragId(r.id);
              (e.currentTarget as HTMLButtonElement).focus();
            }}
            title={`${r.file_name}${r.region ? ` · ${r.region}` : ""}\nDrag to move · Arrows to nudge (Shift = larger) · Shift/Cmd-click or marquee-drag to multi-select`}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 select-none focus:outline-none"
            style={{
              left: `${px * 100}%`,
              top: `${py * 100}%`,
              transform: `translate(-50%, -50%) scale(${1 / scale})`,
              transformOrigin: "center",
              cursor: isDragging ? "grabbing" : "grab",
            }}
          >
            <div
              className={`flex items-center gap-1 rounded-sm border bg-card/95 backdrop-blur px-1.5 py-0.5 text-[10px] font-medium shadow-md transition ${
                isDragging || isSelected
                  ? "border-primary ring-2 ring-primary/40"
                  : "border-border hover:border-primary"
              }`}
            >
              {isImage(r.mime_type) && r.signedUrl ? (
                <img
                  src={r.signedUrl}
                  alt=""
                  className="h-6 w-6 rounded-[2px] object-cover"
                  draggable={false}
                />
              ) : (
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="max-w-[120px] truncate">{r.file_name}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
