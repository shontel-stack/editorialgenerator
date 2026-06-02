import { forwardRef } from "react";
import { COVER_PX, PALETTES, type CoverData } from "@/lib/coverDefaults";

type Props = { data: CoverData };

// The cover is always rendered at intrinsic 3200x4267 px and scaled visually
// via CSS transform on its wrapper. This guarantees pixel-perfect exports
// at 300 DPI while the on-screen preview adapts to any container width.
export const CoverPreview = forwardRef<HTMLDivElement, Props>(function CoverPreview(
  { data },
  ref,
) {
  const pal = PALETTES[data.palette];

  return (
    <div
      ref={ref}
      data-cover-root
      style={{
        width: COVER_PX.w,
        height: COVER_PX.h,
        backgroundColor: pal.bg,
        color: pal.fg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-serif)",
      }}
    >
      {/* Hero image */}
      {data.imageUrl ? (
        <div
          style={{
            position: "absolute",
            inset: data.layout === "framed" ? "12% 10% 22% 10%" : 0,
            overflow: "hidden",
          }}
        >
          <img
            src={data.imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: data.imageFit,
              objectPosition: `center ${data.imageY}%`,
              display: "block",
            }}
          />
          {data.layout === "classic" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)`,
              }}
            />
          )}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: data.layout === "framed" ? "12% 10% 22% 10%" : 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: pal.muted,
            fontFamily: "var(--font-sans)",
            fontSize: 64,
            letterSpacing: 6,
            textTransform: "uppercase",
            background: `repeating-linear-gradient(45deg, ${pal.bg} 0 40px, ${pal.muted}11 40px 80px)`,
          }}
        >
          Upload cover image
        </div>
      )}

      {/* Top masthead bar */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 160,
          right: 160,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: data.layout === "framed" ? pal.fg : pal.fg,
          mixBlendMode: data.layout === "edge" && data.imageUrl ? "difference" : "normal",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 28,
            letterSpacing: 8,
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {data.issue}
        </span>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 28,
            letterSpacing: 8,
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {data.date}
        </span>
      </div>

      {/* Masthead title */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          mixBlendMode: data.layout === "edge" && data.imageUrl ? "difference" : "normal",
          color: pal.fg,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: 360,
            lineHeight: 0.95,
            margin: 0,
            letterSpacing: -4,
          }}
        >
          {data.masthead}
        </h1>
        <div
          style={{
            marginTop: 24,
            display: "inline-block",
            borderTop: `2px solid ${pal.rule}`,
            paddingTop: 24,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 44,
              color: pal.fg,
              opacity: 0.85,
            }}
          >
            {data.tagline}
          </span>
        </div>
      </div>

      {/* Bottom title block */}
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 340,
          color: pal.fg,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            opacity: 0.85,
            marginBottom: 28,
          }}
        >
          The Cover Story
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: 260,
            lineHeight: 0.92,
            margin: 0,
            letterSpacing: -3,
          }}
        >
          {data.headline}
        </h2>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 52,
            lineHeight: 1.25,
            marginTop: 36,
            maxWidth: "75%",
            opacity: 0.92,
          }}
        >
          {data.dek}
        </p>
      </div>

      {/* Bottom rule + meta */}
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 160,
          borderTop: `1px solid ${pal.rule}`,
          paddingTop: 36,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          color: pal.fg,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            maxWidth: "70%",
            opacity: 0.85,
          }}
        >
          {data.feature}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            fontWeight: 600,
            color: pal.rule,
          }}
        >
          {data.price}
        </div>
      </div>

      {/* Credit micro-text */}
      <div
        style={{
          position: "absolute",
          left: 160,
          bottom: 90,
          color: pal.muted,
          fontFamily: "var(--font-sans)",
          fontSize: 18,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {data.credit}
      </div>
    </div>
  );
});
