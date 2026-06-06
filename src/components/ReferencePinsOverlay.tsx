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

export function ReferencePinsOverlay({ references, dim, scale, onAssign }: Props) {
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

  // Click outside any pin clears selection.
  useEffect(() => {
    const onDocPointer = (e: PointerEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const target = e.target as Node | null;
      if (target && host.contains(target)) return;
      setSelectedIds(new Set());
      nudgeBatchRef.current = null;
    };
    window.addEventListener("pointerdown", onDocPointer);
    return () => window.removeEventListener("pointerdown", onDocPointer);
  }, []);

  void dim;

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    >
      {references.map((r, i) => {
        const local = localPos[r.id];
        const px = local?.x ?? r.position_x ?? defaultPos(i).x;
        const py = local?.y ?? r.position_y ?? defaultPos(i).y;
        const Icon = iconFor(r.mime_type);
        const isDragging = dragId === r.id;
        const isSelected = selectedIds.has(r.id);
        return (
          <button
            key={r.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const additive = e.shiftKey || e.metaKey || e.ctrlKey;
              selectPin(r.id, additive);
              // Only start dragging on a plain click (no modifier) so
              // Shift/Cmd-click stays a pure selection toggle.
              if (!additive) setDragId(r.id);
              (e.currentTarget as HTMLButtonElement).focus();
            }}
            title={`${r.file_name}${r.region ? ` · ${r.region}` : ""}\nDrag to move · Arrows to nudge (Shift = larger) · Shift/Cmd-click to multi-select`}
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
