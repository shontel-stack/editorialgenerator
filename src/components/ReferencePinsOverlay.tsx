import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, FileType2, Paperclip } from "lucide-react";
import {
  isImage,
  isPdf,
  isWordDoc,
  type AttachmentAssignment,
  type AttachmentWithUrl,
} from "@/lib/attachments";

type Props = {
  references: AttachmentWithUrl[];
  /** Page dimensions in CSS px at the canvas's scaled size. */
  dim: { w: number; h: number };
  /** Canvas zoom scale (1 = 100%). Used to translate pointer deltas. */
  scale: number;
  onAssign: (id: string, patch: AttachmentAssignment) => Promise<void> | void;
};

function iconFor(mime: string) {
  if (isPdf(mime)) return FileText;
  if (isImage(mime)) return ImageIcon;
  if (isWordDoc(mime)) return FileType2;
  return Paperclip;
}

/**
 * Default coordinates for a reference that has no explicit pin yet.
 * Spreads them in a small diagonal cascade so multiple unpinned refs don't stack.
 */
function defaultPos(index: number): { x: number; y: number } {
  const step = 0.04;
  return { x: 0.05 + (index % 8) * step, y: 0.05 + Math.floor(index / 8) * step + (index % 8) * step };
}

export function ReferencePinsOverlay({ references, dim, scale, onAssign }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Local drag state — committed to the server on pointerup.
  const [dragId, setDragId] = useState<string | null>(null);
  const [localPos, setLocalPos] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      // rect already reflects current scale, so dividing by its width/height yields 0..1.
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      setLocalPos((p) => ({ ...p, [dragId]: { x, y } }));
    };
    const onUp = () => {
      const pos = localPos[dragId];
      if (pos) {
        void onAssign(dragId, { position_x: pos.x, position_y: pos.y, region: null });
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
        return (
          <button
            key={r.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragId(r.id);
            }}
            title={`${r.file_name}${r.region ? ` · ${r.region}` : ""}\nDrag to reposition`}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 select-none"
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
                isDragging
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
