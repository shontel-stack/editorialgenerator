import type { PageMargins } from "@/lib/coverDefaults";

type Props = {
  /** Page (trim) size in pixels at 300 DPI. */
  dim: { w: number; h: number };
  /** Margin & bleed in inches. */
  margins: PageMargins;
  /** Optional override for label visibility. */
  showLabels?: boolean;
};

/**
 * Non-printing overlay drawn on top of the editor canvas to visualize the
 * publication's safe area (margins) and bleed (crop) guides. Rendered as a
 * sibling of the page DOM so exports (which use a separate off-screen stage)
 * never capture it.
 *
 * Coordinate system: the parent wrapper is sized to the page's pixel
 * dimensions (e.g. 3200×4267 at 300 DPI). Inches are converted at 300 DPI to
 * match. Bleed extends *outside* the trim, so the parent wrapper must allow
 * overflow.
 */
export function GuidesOverlay({ dim, margins, showLabels = true }: Props) {
  const DPI = 300;
  const mTop = margins.top * DPI;
  const mRight = margins.right * DPI;
  const mBottom = margins.bottom * DPI;
  const mLeft = margins.left * DPI;
  const bleed = Math.max(0, margins.bleed * DPI);

  const MAGENTA = "rgba(236, 0, 140, 0.95)"; // safe-area (margin)
  const CYAN = "rgba(0, 174, 239, 0.95)"; // bleed (crop)
  const labelStyle: React.CSSProperties = {
    position: "absolute",
    fontFamily: "system-ui, sans-serif",
    fontSize: 36,
    fontWeight: 600,
    letterSpacing: 4,
    textTransform: "uppercase",
    padding: "6px 14px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
  };

  return (
    <div
      aria-hidden
      data-guides-overlay
      style={{
        position: "absolute",
        // Extend outward by bleed so the bleed rectangle sits outside trim.
        top: -bleed,
        left: -bleed,
        right: -bleed,
        bottom: -bleed,
        pointerEvents: "none",
        zIndex: 80,
      }}
    >
      {/* Bleed box — outer crop guide */}
      {bleed > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: `4px dashed ${CYAN}`,
            boxSizing: "border-box",
          }}
        />
      )}

      {/* Trim box — page edge */}
      <div
        style={{
          position: "absolute",
          top: bleed,
          left: bleed,
          width: dim.w,
          height: dim.h,
          border: `2px solid rgba(0,0,0,0.35)`,
          boxSizing: "border-box",
        }}
      />

      {/* Safe-area / margin box */}
      <div
        style={{
          position: "absolute",
          top: bleed + mTop,
          left: bleed + mLeft,
          width: dim.w - mLeft - mRight,
          height: dim.h - mTop - mBottom,
          border: `3px solid ${MAGENTA}`,
          boxSizing: "border-box",
        }}
      />

      {showLabels && (
        <>
          {bleed > 0 && (
            <span
              style={{
                ...labelStyle,
                top: 8,
                left: 8,
                color: CYAN,
                background: "rgba(255,255,255,0.85)",
              }}
            >
              Bleed · {margins.bleed.toFixed(3)}″
            </span>
          )}
          <span
            style={{
              ...labelStyle,
              top: bleed + 8,
              right: bleed + 8,
              color: MAGENTA,
              background: "rgba(255,255,255,0.85)",
            }}
          >
            Safe area
          </span>
        </>
      )}
    </div>
  );
}
