import type { LayoutPlanOp } from "@/lib/proposeLayout.functions";

const PAGE_W = 3200;
const PAGE_H = 4267;

type Props = {
  ops: LayoutPlanOp[];
  pageId: string;
  dim: { w: number; h: number };
  /** Optional lookup: attachmentId → file name for image-block labels. */
  libraryLabels?: Record<string, string>;
};

/**
 * Visual ghost overlay showing where proposed text/image blocks will land
 * on a given page. Renders inside the page's positioned wrapper.
 */
export function LayoutProposalOverlay({ ops, pageId, dim, libraryLabels }: Props) {
  const pageOps = ops.filter(
    (o) => o.pageId === pageId && (o.kind === "add_image_block" || o.kind === "add_text_block"),
  );
  if (pageOps.length === 0) return null;
  const sx = dim.w / PAGE_W;
  const sy = dim.h / PAGE_H;

  return (
    <div
      aria-hidden
      data-export-ignore="true"
      className="pointer-events-none absolute inset-0 z-30"
    >
      {pageOps.map((op, i) => {
        const x = (op.x ?? (op.kind === "add_image_block" ? 160 : 160)) * sx;
        const y = (op.y ?? 160) * sy;
        const w = (op.w ?? (op.kind === "add_image_block" ? 1600 : 1600)) * sx;
        const h = (op.h ?? (op.kind === "add_image_block" ? 1000 : 600)) * sy;
        const isImage = op.kind === "add_image_block";
        const tint = isImage ? "rgba(225, 29, 72, 0.14)" : "rgba(37, 99, 235, 0.12)";
        const border = isImage ? "rgb(225, 29, 72)" : "rgb(37, 99, 235)";
        const label = isImage
          ? `Image · ${libraryLabels?.[op.attachmentId ?? ""] ?? "library item"}`
          : `Text · ${(op.text ?? "").slice(0, 40)}${(op.text ?? "").length > 40 ? "…" : ""}`;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: w,
              height: h,
              background: tint,
              border: `1.5px dashed ${border}`,
              borderRadius: 4,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.6) inset`,
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
                }}
              >
                {op.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
