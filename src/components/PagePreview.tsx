import { forwardRef } from "react";
import {
  COVER_PX,
  PALETTES,
  type ContentsData,
  type CoverData,
  type FeatureData,
  type PageType,
  type PhotoData,
} from "@/lib/coverDefaults";
import { CoverPreview } from "./CoverPreview";

type AnyData = CoverData | FeatureData | PhotoData | ContentsData;

type Props = {
  pageType: PageType;
  data: AnyData;
};

export const PagePreview = forwardRef<HTMLDivElement, Props>(function PagePreview(
  { pageType, data },
  ref,
) {
  if (pageType === "cover") return <CoverPreview ref={ref} data={data as CoverData} />;
  if (pageType === "feature") return <FeaturePreview ref={ref} data={data as FeatureData} />;
  if (pageType === "photo") return <PhotoPreview ref={ref} data={data as PhotoData} />;
  return <ContentsPreview ref={ref} data={data as ContentsData} />;
});

/* — shared shell wrapper — */

function Page({
  innerRef,
  pal,
  children,
}: {
  innerRef: React.Ref<HTMLDivElement>;
  pal: ReturnType<() => typeof PALETTES[keyof typeof PALETTES]>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={innerRef}
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
      {children}
    </div>
  );
}

function Folio({
  left,
  right,
  pal,
}: {
  left: string;
  right: string;
  pal: typeof PALETTES[keyof typeof PALETTES];
}) {
  const base = {
    fontFamily: "var(--font-sans)",
    fontSize: 24,
    letterSpacing: 6,
    textTransform: "uppercase" as const,
    fontWeight: 500,
    color: pal.fg,
  };
  return (
    <>
      <div style={{ position: "absolute", top: 120, left: 160, ...base }}>{left}</div>
      <div style={{ position: "absolute", top: 120, right: 160, ...base }}>{right}</div>
      <div
        style={{
          position: "absolute",
          top: 175,
          left: 160,
          right: 160,
          borderTop: `1px solid ${pal.rule}`,
        }}
      />
    </>
  );
}

/* — FEATURE ARTICLE — two-column long-form — */

const FeaturePreview = forwardRef<HTMLDivElement, { data: FeatureData }>(function FeaturePreview(
  { data },
  ref,
) {
  const pal = PALETTES[data.palette];
  const paragraphs = data.body.split(/\n\s*\n/).filter(Boolean);

  return (
    <Page innerRef={ref} pal={pal}>
      <Folio left={data.folio} right={`PAGE ${data.pageNumber}`} pal={pal} />

      {/* Section eyebrow */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 160,
          fontFamily: "var(--font-sans)",
          fontSize: 24,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: pal.rule,
          fontWeight: 600,
        }}
      >
        {data.section}
      </div>

      {/* Headline */}
      <h1
        style={{
          position: "absolute",
          top: 300,
          left: 160,
          right: 160,
          fontFamily: "var(--font-display)",
          fontWeight: 400,
          fontSize: 220,
          lineHeight: 0.95,
          letterSpacing: -3,
          margin: 0,
          color: pal.fg,
        }}
      >
        {data.headline}
      </h1>

      {/* Dek */}
      <p
        style={{
          position: "absolute",
          top: 620,
          left: 160,
          right: 700,
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 48,
          lineHeight: 1.3,
          margin: 0,
          color: pal.fg,
          opacity: 0.9,
        }}
      >
        {data.dek}
      </p>

      {/* Byline */}
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 160,
          fontFamily: "var(--font-sans)",
          fontSize: 22,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: pal.muted,
        }}
      >
        {data.byline}
      </div>

      {/* Hero image */}
      <div
        style={{
          position: "absolute",
          top: 900,
          left: 160,
          right: 160,
          height: 1200,
          background: pal.muted + "22",
          overflow: "hidden",
        }}
      >
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `center ${data.imageY}%`,
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: pal.muted,
              fontFamily: "var(--font-sans)",
              fontSize: 36,
              letterSpacing: 6,
              textTransform: "uppercase",
              background: `repeating-linear-gradient(45deg, ${pal.bg} 0 30px, ${pal.muted}22 30px 60px)`,
            }}
          >
            Place image
          </div>
        )}
      </div>

      {/* Caption */}
      <div
        style={{
          position: "absolute",
          top: 2120,
          left: 160,
          right: 160,
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 22,
          color: pal.muted,
        }}
      >
        {data.imageCaption}
      </div>

      {/* Two-column body */}
      <div
        style={{
          position: "absolute",
          top: 2200,
          left: 160,
          right: 160,
          bottom: 220,
          columnCount: 2,
          columnGap: 90,
          columnFill: "auto",
          fontFamily: "var(--font-serif)",
          fontSize: 28,
          lineHeight: 1.5,
          color: pal.fg,
        }}
      >
        {paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              marginBottom: 28,
              textIndent: i === 0 ? 0 : 36,
            }}
          >
            {i === 0 && data.dropCap ? (
              <>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    float: "left",
                    fontSize: 130,
                    lineHeight: 0.85,
                    paddingRight: 16,
                    paddingTop: 6,
                    color: pal.rule,
                  }}
                >
                  {p.charAt(0)}
                </span>
                {p.slice(1)}
              </>
            ) : (
              p
            )}
          </p>
        ))}
      </div>

      {/* Pull quote — overlaid right column */}
      {data.pullQuote && (
        <div
          style={{
            position: "absolute",
            right: 160,
            bottom: 280,
            width: 1180,
            borderTop: `2px solid ${pal.rule}`,
            borderBottom: `1px solid ${pal.rule}`,
            paddingTop: 28,
            paddingBottom: 28,
            background: pal.bg,
            fontFamily: "var(--font-display)",
            fontSize: 64,
            lineHeight: 1.15,
            color: pal.fg,
          }}
        >
          {data.pullQuote}
        </div>
      )}

      {/* Bottom folio */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 160,
          right: 160,
          borderTop: `1px solid ${pal.rule}`,
          paddingTop: 24,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-sans)",
          fontSize: 20,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: pal.muted,
        }}
      >
        <span>{data.folio}</span>
        <span>{data.pageNumber}</span>
      </div>
    </Page>
  );
});

/* — PHOTO ESSAY — full-bleed with caption block — */

const PhotoPreview = forwardRef<HTMLDivElement, { data: PhotoData }>(function PhotoPreview(
  { data },
  ref,
) {
  const pal = PALETTES[data.palette];
  const isSplit = data.layout === "split";
  const isFramed = data.layout === "framed";

  return (
    <Page innerRef={ref} pal={pal}>
      {/* Image */}
      <div
        style={{
          position: "absolute",
          top: isFramed ? 380 : 0,
          left: isFramed ? 200 : 0,
          right: isFramed ? 200 : isSplit ? "45%" : 0,
          bottom: isFramed ? 1100 : isSplit ? 0 : 0,
          overflow: "hidden",
          background: pal.muted + "22",
        }}
      >
        {data.imageUrl ? (
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
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: pal.muted,
              fontFamily: "var(--font-sans)",
              fontSize: 48,
              letterSpacing: 8,
              textTransform: "uppercase",
              background: `repeating-linear-gradient(45deg, ${pal.bg} 0 40px, ${pal.muted}22 40px 80px)`,
            }}
          >
            Place photograph
          </div>
        )}
        {!isSplit && !isFramed && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 100%)`,
            }}
          />
        )}
      </div>

      {/* Top folio (overlaid on image when full-bleed) */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: isSplit ? "calc(55% + 60px)" : 160,
          right: 160,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-sans)",
          fontSize: 22,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: isFramed || isSplit ? pal.fg : pal.bg,
          mixBlendMode: !isFramed && !isSplit ? "difference" : "normal",
        }}
      >
        <span>{data.folio}</span>
        <span>{data.section}</span>
      </div>

      {/* Caption block */}
      <div
        style={{
          position: "absolute",
          left: isSplit ? "calc(55% + 60px)" : 160,
          right: 160,
          bottom: isFramed ? 200 : 220,
          top: isSplit ? 600 : "auto",
          color: isFramed || isSplit ? pal.fg : pal.bg,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            opacity: 0.9,
            marginBottom: 24,
            color: pal.rule,
            fontWeight: 600,
          }}
        >
          {data.section}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: isSplit ? 180 : 160,
            lineHeight: 0.95,
            margin: 0,
            fontWeight: 400,
            letterSpacing: -2,
          }}
        >
          {data.title}
        </h1>
        <div
          style={{
            marginTop: 36,
            borderTop: `1px solid ${pal.rule}`,
            paddingTop: 28,
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 30,
            lineHeight: 1.4,
            maxWidth: isSplit ? 1100 : 1800,
          }}
        >
          {data.caption}
        </div>
        <div
          style={{
            marginTop: 32,
            fontFamily: "var(--font-sans)",
            fontSize: 20,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          {data.credit}
        </div>
      </div>

      {/* Page number bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: 90,
          right: 160,
          fontFamily: "var(--font-sans)",
          fontSize: 22,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: isFramed || isSplit ? pal.muted : pal.bg,
          mixBlendMode: !isFramed && !isSplit ? "difference" : "normal",
        }}
      >
        {data.pageNumber}
      </div>
    </Page>
  );
});

/* — CONTENTS — issue index — */

const ContentsPreview = forwardRef<HTMLDivElement, { data: ContentsData }>(function ContentsPreview(
  { data },
  ref,
) {
  const pal = PALETTES[data.palette];

  return (
    <Page innerRef={ref} pal={pal}>
      <Folio left={data.folio} right={`PAGE ${data.pageNumber}`} pal={pal} />

      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 160,
          fontFamily: "var(--font-sans)",
          fontSize: 24,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: pal.rule,
          fontWeight: 600,
        }}
      >
        Contents  ·  {data.issue}  ·  {data.date}
      </div>

      {/* Title */}
      <h1
        style={{
          position: "absolute",
          top: 320,
          left: 160,
          right: 160,
          fontFamily: "var(--font-display)",
          fontWeight: 400,
          fontSize: 280,
          lineHeight: 0.9,
          letterSpacing: -3,
          margin: 0,
          color: pal.fg,
        }}
      >
        Inside
      </h1>

      {/* Intro */}
      <p
        style={{
          position: "absolute",
          top: 680,
          left: 160,
          right: 1200,
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 44,
          lineHeight: 1.3,
          margin: 0,
          color: pal.fg,
          opacity: 0.9,
        }}
      >
        {data.intro}
      </p>

      {/* Entries */}
      <div
        style={{
          position: "absolute",
          top: 1100,
          left: 160,
          right: 160,
          bottom: 240,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {data.entries.map((e, i) => (
          <div
            key={i}
            data-link-row
            data-link-target={e.link ?? "none"}
            style={{
              display: "grid",
              gridTemplateColumns: "260px 1fr 140px",
              alignItems: "baseline",
              gap: 40,
              padding: "32px 0",
              borderTop: `1px solid ${pal.rule}`,
              borderBottom: i === data.entries.length - 1 ? `1px solid ${pal.rule}` : "none",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 20,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: pal.rule,
                fontWeight: 600,
              }}
            >
              {e.section}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 64,
                  lineHeight: 1.05,
                  color: pal.fg,
                }}
              >
                {e.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: 24,
                  color: pal.muted,
                  marginTop: 8,
                }}
              >
                {e.byline}
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 56,
                textAlign: "right",
                color: pal.fg,
                fontWeight: 300,
              }}
            >
              {e.page}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom folio */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 160,
          right: 160,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-sans)",
          fontSize: 20,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: pal.muted,
        }}
      >
        <span>{data.folio}</span>
        <span>{data.pageNumber}</span>
      </div>
    </Page>
  );
});
