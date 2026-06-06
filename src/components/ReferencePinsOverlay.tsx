import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, FileType2, Paperclip } from "lucide-react";
import {
  isImage,
  isPdf,
  isWordDoc,
  type AttachmentAssignment,
  type AttachmentWithUrl,
} from "@/lib/attachments";

type AssignOpts = { silent?: boolean; groupKey?: string | null };

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({});

  // Drag handling — pointermove updates local state, pointerup commits.
  useEffect(() => {
    if (!dragId) return;
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

  // Arrow-key nudging on the currently selected pin.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      const isArrow =
        e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown";
      if (!isArrow) return;
      e.preventDefault();

      const ref = references.find((r) => r.id === selectedId);
      if (!ref) return;
      const i = references.indexOf(ref);
      const local = localPos[selectedId];
      const baseX = local?.x ?? ref.position_x ?? defaultPos(i).x;
      const baseY = local?.y ?? ref.position_y ?? defaultPos(i).y;
      const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
      let nx = baseX;
      let ny = baseY;
      if (e.key === "ArrowLeft") nx = Math.max(0, baseX - step);
      else if (e.key === "ArrowRight") nx = Math.min(1, baseX + step);
      else if (e.key === "ArrowUp") ny = Math.max(0, baseY - step);
      else if (e.key === "ArrowDown") ny = Math.min(1, baseY + step);

      setLocalPos((p) => ({ ...p, [selectedId]: { x: nx, y: ny } }));
      void onAssign(
        selectedId,
        { position_x: nx, position_y: ny, region: null },
        { groupKey: `nudge:${selectedId}` },
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, references, localPos, onAssign]);

  // Click outside any pin clears selection.
  useEffect(() => {
    const onDocPointer = (e: PointerEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const target = e.target as Node | null;
      if (target && host.contains(target)) return;
      setSelectedId(null);
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
        const isSelected = selectedId === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedId(r.id);
              setDragId(r.id);
              (e.currentTarget as HTMLButtonElement).focus();
            }}
            onFocus={() => setSelectedId(r.id)}
            title={`${r.file_name}${r.region ? ` · ${r.region}` : ""}\nDrag to reposition · Arrow keys to nudge (Shift = larger step)`}
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
