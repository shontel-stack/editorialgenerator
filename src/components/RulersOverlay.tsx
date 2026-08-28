import { DPI, UNIT_LABELS, fromPx, type MeasureUnit } from "@/lib/measure";

type Props = {
  /** Page (trim) size in pixels at 300 DPI. */
  dim: { w: number; h: number };
  /** Display unit for the tick labels. */
  unit: MeasureUnit;
};

/** Tick geometry for a unit: distance between labelled ticks (page-px) and
 *  how many minor subdivisions sit inside each. */
function tickSpec(unit: MeasureUnit): { major: number; subs: number; label: (i: number) => string } {
  switch (unit) {
    case "mm":
      // Labelled every 10 mm, minor every 1 mm.
      return { major: (10 / 25.4) * DPI, subs: 10, label: (i) => String(i * 10) };
    case "pt":
      // Labelled every 72 pt (1 in), minor every 12 pt.
      return { major: DPI, subs: 6, label: (i) => String(i * 72) };
    case "px":
      return { major: 300, subs: 6, label: (i) => String(i * 300) };
    case "in":
    default:
      // Labelled every inch, minor every 1/8 in.
      return { major: DPI, subs: 8, label: (i) => String(i) };
  }
}

const THICK = 60; // ruler band thickness in page-px (0.2in @ 300 DPI)
const INK = "rgba(10,10,10,0.75)";
const BAND = "rgba(255,255,255,0.92)";

/**
 * Non-printing rulers drawn just outside the page trim (top + left edges).
 *
 * Rendered as a sibling of the page DOM — like GuidesOverlay — so exports
 * never capture it. Everything is expressed in page pixels at 300 DPI so the
 * rulers scale with the canvas zoom and stay pinned to the page edges.
 */
export function RulersOverlay({ dim, unit }: Props) {
  const { major, subs, label } = tickSpec(unit);
  const minor = major / subs;

  const hCount = Math.floor(dim.w / minor) + 1;
  const vCount = Math.floor(dim.h / minor) + 1;

  const tickLen = (i: number) => {
    if (i % subs === 0) return THICK * 0.75;
    if (subs % 2 === 0 && i % (subs / 2) === 0) return THICK * 0.45;
    return THICK * 0.25;
  };

  return (
    <div
      aria-hidden
      data-export-ignore="true"
      data-rulers-overlay
      style={{
        position: "absolute",
        top: -THICK,
        left: -THICK,
        width: dim.w + THICK,
        height: dim.h + THICK,
        pointerEvents: "none",
        zIndex: 90,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Corner block with the active unit */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: THICK,
          height: THICK,
          background: BAND,
          border: `2px solid ${INK}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 700,
          color: INK,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {UNIT_LABELS[unit]}
      </div>

      {/* Horizontal ruler */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: THICK,
          width: dim.w,
          height: THICK,
          background: BAND,
          borderTop: `2px solid ${INK}`,
          borderRight: `2px solid ${INK}`,
          borderBottom: `2px solid ${INK}`,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: hCount }, (_, i) => {
          const x = i * minor;
          const len = tickLen(i);
          const isMajor = i % subs === 0;
          return (
            <div key={`h-${i}`}>
              <div
                style={{
                  position: "absolute",
                  left: x,
                  bottom: 0,
                  width: isMajor ? 3 : 1.5,
                  height: len,
                  background: INK,
                }}
              />
              {isMajor && i > 0 && (
                <span
                  style={{
                    position: "absolute",
                    left: x + 6,
                    top: 4,
                    fontSize: 26,
                    fontWeight: 600,
                    color: INK,
                  }}
                >
                  {label(Math.round(x / major))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Vertical ruler */}
      <div
        style={{
          position: "absolute",
          top: THICK,
          left: 0,
          width: THICK,
          height: dim.h,
          background: BAND,
          borderLeft: `2px solid ${INK}`,
          borderBottom: `2px solid ${INK}`,
          borderRight: `2px solid ${INK}`,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {Array.from({ length: vCount }, (_, i) => {
          const y = i * minor;
          const len = tickLen(i);
          const isMajor = i % subs === 0;
          return (
            <div key={`v-${i}`}>
              <div
                style={{
                  position: "absolute",
                  top: y,
                  right: 0,
                  height: isMajor ? 3 : 1.5,
                  width: len,
                  background: INK,
                }}
              />
              {isMajor && i > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: y + 6,
                    left: 4,
                    fontSize: 26,
                    fontWeight: 600,
                    color: INK,
                    writingMode: "vertical-rl",
                  }}
                >
                  {label(Math.round(y / major))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Exported for callers that need to know how much room the rulers occupy. */
export const RULER_THICKNESS_PX = THICK;
export { fromPx };
