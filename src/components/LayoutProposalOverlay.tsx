import { useRef } from "react";
import type { LayoutPlanOp } from "@/lib/proposeLayout.functions";

const PAGE_W = 3200;
const PAGE_H = 4267;

type Props = {
  ops: LayoutPlanOp[];
  pageId: string;
  dim: { w: number; h: number };
  /** Optional lookup: attachmentId → file name for image-block labels. */
  libraryLabels?: Record<string, string>;
  /** When provided, ghost rects become drag/resize-able and emit the updated ops array. */
  onOpsChange?: (next: LayoutPlanOp[]) => void;
};

type Drag = {
  mode: "move" | "resize";
  opIndex: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
};

const DEFAULTS = {
  image: { x: 160, y: 160, w: 1600, h: 1000 },
  text: { x: 160, y: 160, w: 1600, h: 600 },
};

function defaultsFor(op: LayoutPlanOp) {
  return op.kind === "add_image_block" ? DEFAULTS.image : DEFAULTS.text;
}

/**
 * Visual ghost overlay showing where proposed text/image blocks will land
 * on a given page. When `onOpsChange` is set, ghosts can be dragged (body)
 * and resized (bottom-right handle) to fine-tune placement before applying.
 */
export function LayoutProposalOverlay({ ops, pageId, dim, libraryLabels, onOpsChange }: Props) {
  const interactive = typeof onOpsChange === "function";
  const dragRef = useRef<Drag | null>(null);
  const sx = dim.w / PAGE_W;
  const sy = dim.h / PAGE_H;

  // Filter to this page but keep original indices so edits write back correctly.
  const entries = ops
    .map((op, idx) => ({ op, idx }))
    .filter(
      ({ op }) =>
        op.pageId === pageId &&
        (op.kind === "add_image_block" || op.kind === "add_text_block"),
    );

  if (entries.length === 0) return null;

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  const onPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    opIndex: number,
    mode: "move" | "resize",
  ) => {
    if (!interactive) return;
    e.stopPropagation();
    e.preventDefault();
    const op = ops[opIndex];
    const d = defaultsFor(op);
    dragRef.current = {
      mode,
      opIndex,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: op.x ?? d.x,
      startY: op.y ?? d.y,
      startW: op.w ?? d.w,
      startH: op.h ?? d.h,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !onOpsChange) return;
    const dxPage = (e.clientX - drag.startClientX) / sx;
    const dyPage = (e.clientY - drag.startClientY) / sy;
    const next = ops.slice();
    const cur = next[drag.opIndex];
    if (drag.mode === "move") {
      const w = drag.startW;
      const h = drag.startH;
      next[drag.opIndex] = {
        ...cur,
        x: Math.round(clamp(drag.startX + dxPage, 0, PAGE_W - w)),
        y: Math.round(clamp(drag.startY + dyPage, 0, PAGE_H - h)),
        w,
        h,
      };
    } else {
      const w = Math.round(clamp(drag.startW + dxPage, 80, PAGE_W - drag.startX));
      const h = Math.round(clamp(drag.startH + dyPage, 60, PAGE_H - drag.startY));
      next[drag.opIndex] = { ...cur, x: drag.startX, y: drag.startY, w, h };
    }
    onOpsChange(next);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    dragRef.current = null;
  };

  return (
    <div
      aria-hidden
      data-export-ignore="true"
      className="absolute inset-0 z-30"
      style={{ pointerEvents: "none" }}
    >
      {entries.map(({ op, idx }) => {
        const d = defaultsFor(op);
        const px = (op.x ?? d.x) * sx;
        const py = (op.y ?? d.y) * sy;
        const pw = (op.w ?? d.w) * sx;
        const ph = (op.h ?? d.h) * sy;
        const isImage = op.kind === "add_image_block";
        const tint = isImage ? "rgba(225, 29, 72, 0.14)" : "rgba(37, 99, 235, 0.12)";
        const border = isImage ? "rgb(225, 29, 72)" : "rgb(37, 99, 235)";
        const label = isImage
          ? `Image · ${libraryLabels?.[op.attachmentId ?? ""] ?? "library item"}`
          : `Text · ${(op.text ?? "").slice(0, 40)}${(op.text ?? "").length > 40 ? "…" : ""}`;
        return (
          <div
            key={idx}
            onPointerDown={(e) => onPointerDown(e, idx, "move")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: pw,
              height: ph,
              background: tint,
              border: `1.5px dashed ${border}`,
              borderRadius: 4,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.6) inset`,
              pointerEvents: interactive ? "auto" : "none",
              cursor: interactive ? "move" : "default",
              touchAction: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -18,
                left: 0,
                fontSize: 10,
                lineHeight: "16px",
                padding: "0 6px",
                background: border,
                color: "white",
                borderRadius: 3,
                whiteSpace: "nowrap",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                pointerEvents: "none",
              }}
            >
              {label}
            </div>
            {!isImage && op.text && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  padding: 6,
                  color: "rgba(30, 64, 175, 0.85)",
                  fontFamily: "Georgia, serif",
                  fontSize: Math.max(8, Math.min(14, (op.fontSize ?? 28) * sx)),
                  textAlign: op.align ?? "left",
                  overflow: "hidden",
                  pointerEvents: "none",
                }}
              >
                {op.text}
              </div>
            )}
            {interactive && (
              <div
                onPointerDown={(e) => onPointerDown(e, idx, "resize")}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                  position: "absolute",
                  right: -6,
                  bottom: -6,
                  width: 14,
                  height: 14,
                  background: "white",
                  border: `1.5px solid ${border}`,
                  borderRadius: 2,
                  cursor: "nwse-resize",
                  touchAction: "none",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
