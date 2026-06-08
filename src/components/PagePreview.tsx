import { forwardRef } from "react";
import {
  COVER_PX,
  PALETTES,
  type AdData,
  type ArticleData,
  type ArticleLayout,
  type BackCoverData,
  type ContentsData,
  type CoverData,
  type PageType,
  type PhotoData,
} from "@/lib/coverDefaults";
import { CoverPreview } from "./CoverPreview";
import { Draggable } from "./LayoutEdit";
import { CustomBlocksLayer } from "./CustomBlocksLayer";

type AnyData = CoverData | ArticleData | PhotoData | ContentsData | AdData | BackCoverData;

type Props = {
  pageType: PageType;
  data: AnyData;
  dim?: { w: number; h: number };
  hideFolio?: boolean;
};

export const PagePreview = forwardRef<HTMLDivElement, Props>(function PagePreview(
  { pageType, data, dim, hideFolio },
  ref,
) {
  switch (pageType) {
    case "cover":
      return <CoverPreview ref={ref} data={data as CoverData} dim={dim} />;
    case "article":
      return <ArticlePreview ref={ref} data={data as ArticleData} dim={dim} hideFolio={hideFolio} />;
    case "photo":
      return <PhotoPreview ref={ref} data={data as PhotoData} dim={dim} />;
    case "contents":
      return <ContentsPreview ref={ref} data={data as ContentsData} dim={dim} hideFolio={hideFolio} />;
    case "ad":
      return <AdPreview ref={ref} data={data as AdData} dim={dim} />;
    case "back":
      return <BackCoverPreview ref={ref} data={data as BackCoverData} dim={dim} />;
  }
});

/* — shared shell — */

function Page({
  innerRef,
  pal,
  children,
  dim,
}: {
  innerRef: React.Ref<HTMLDivElement>;
  pal: ReturnType<() => typeof PALETTES[keyof typeof PALETTES]>;
  children: React.ReactNode;
  dim?: { w: number; h: number };
}) {
  return (
    <div
      ref={innerRef}
      data-cover-root
      style={{
        width: dim?.w ?? COVER_PX.w,
        height: dim?.h ?? COVER_PX.h,
        backgroundColor: pal.bg,
        color: pal.fg,
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-serif)",
      }}
    >
      {children}
      <CustomBlocksLayer />
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
      <Draggable blockKey="folio-left" style={{ position: "absolute", top: 120, left: 160, ...base }}>{left}</Draggable>
      <Draggable blockKey="folio-right" style={{ position: "absolute", top: 120, right: 160, ...base }}>{right}</Draggable>
      <Draggable
        blockKey="folio-rule"
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

/* — ARTICLE — 10 layout presets driven by data.layout — */

function ImageBox({
  data,
  pal,
  style,
  blockKey = "image",
}: {
  data: ArticleData;
  pal: typeof PALETTES[keyof typeof PALETTES];
  style: React.CSSProperties;
  blockKey?: string;
}) {
  return (
    <Draggable blockKey={blockKey} style={{ ...style, overflow: "hidden", background: pal.muted + "22" }}>
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
    </Draggable>
  );
}

function BodyColumns({
  data,
  pal,
  style,
  columns,
  fontSize = 28,
}: {
  data: ArticleData;
  pal: typeof PALETTES[keyof typeof PALETTES];
  style: React.CSSProperties;
  columns: number;
  fontSize?: number;
}) {
  const paragraphs = data.body.split(/\n\s*\n/).filter(Boolean);
  return (
    <Draggable
      blockKey="body"
      style={{
        ...style,
        columnCount: columns,
        columnGap: 80,
        columnFill: "auto",
        fontFamily: "var(--font-serif)",
        fontSize,
        lineHeight: 1.5,
        color: pal.fg,
      }}
    >
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: 0, marginBottom: 28, textIndent: i === 0 ? 0 : 36 }}>
          {i === 0 && data.dropCap ? (
            <>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  float: "left",
                  fontSize: fontSize * 4.5,
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
    </Draggable>
  );
}

function ArticleHeader({
  data,
  pal,
  top,
  left,
  right,
  headlineSize = 200,
}: {
  data: ArticleData;
  pal: typeof PALETTES[keyof typeof PALETTES];
  top: number;
  left: number;
  right: number;
  headlineSize?: number;
}) {
  return (
    <>
      <Draggable
        blockKey="section"
        style={{
          position: "absolute",
          top,
          left,
          right,
          fontFamily: "var(--font-sans)",
          fontSize: 24,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: pal.rule,
          fontWeight: 600,
        }}
      >
        {data.section}
      </Draggable>
      <Draggable
        blockKey="headline"
        style={{
          position: "absolute",
          top: top + 60,
          left,
          right,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: headlineSize,
            lineHeight: 0.95,
            letterSpacing: -3,
            margin: 0,
            color: pal.fg,
          }}
        >
          {data.headline}
        </h1>
      </Draggable>
    </>
  );
}

function ArticleByline({
  data,
  pal,
  top,
  left,
  right,
}: {
  data: ArticleData;
  pal: typeof PALETTES[keyof typeof PALETTES];
  top: number;
  left: number;
  right: number;
}) {
  return (
    <>
      <Draggable
        blockKey="dek"
        style={{
          position: "absolute",
          top,
          left,
          right,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 38,
            lineHeight: 1.3,
            margin: 0,
            color: pal.fg,
            opacity: 0.9,
          }}
        >
          {data.dek}
        </p>
      </Draggable>
      <Draggable
        blockKey="byline"
        style={{
          position: "absolute",
          top: top + 160,
          left,
          right,
          fontFamily: "var(--font-sans)",
          fontSize: 22,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: pal.muted,
        }}
      >
        {data.byline}
      </Draggable>
    </>
  );
}

function ArticleFooter({
  data,
  pal,
}: {
  data: ArticleData;
  pal: typeof PALETTES[keyof typeof PALETTES];
}) {
  return (
    <Draggable
      blockKey="article-footer"
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
    </Draggable>
  );
}

const ArticlePreview = forwardRef<HTMLDivElement, { data: ArticleData; dim?: { w: number; h: number }; hideFolio?: boolean }>(function ArticlePreview(
  { data, dim, hideFolio },
  ref,
) {
  const pal = PALETTES[data.palette];
  const L: ArticleLayout = data.layout ?? "image-top-2col";

  // Page bounds:
  //   width 3200, height 4267
  //   safe margin 160, header band uses top 175 for folio rule
  const M = 160;
  const TOP = 240;
  const BOT = 220; // leaves room for ArticleFooter

  // Build a per-layout element set
  const blocks: React.ReactNode[] = [];

  switch (L) {
    case "image-top-2col":
    case "image-top-3col": {
      const cols = L === "image-top-3col" ? 3 : 2;
      blocks.push(<ArticleHeader key="h" data={data} pal={pal} top={TOP} left={M} right={M} />);
      blocks.push(
        <ArticleByline key="b" data={data} pal={pal} top={620} left={M} right={M + 700} />,
      );
      blocks.push(
        <ImageBox
          key="img"
          data={data}
          pal={pal}
          style={{ position: "absolute", top: 900, left: M, right: M, height: 1200 }}
        />,
      );
      blocks.push(
        <Draggable
          key="cap"
          blockKey="caption"
          style={{
            position: "absolute",
            top: 2120,
            left: M,
            right: M,
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 22,
            color: pal.muted,
          }}
        >
          {data.imageCaption}
        </Draggable>,
      );
      blocks.push(
        <BodyColumns
          key="body"
          data={data}
          pal={pal}
          columns={cols}
          style={{ position: "absolute", top: 2200, left: M, right: M, bottom: BOT }}
        />,
      );
      break;
    }

    case "image-left-1col":
    case "image-left-2col": {
      const cols = L === "image-left-2col" ? 2 : 1;
      blocks.push(<ArticleHeader key="h" data={data} pal={pal} top={TOP} left={M} right={M} />);
      blocks.push(
        <ArticleByline key="b" data={data} pal={pal} top={620} left={M} right={M} />,
      );
      blocks.push(
        <ImageBox
          key="img"
          data={data}
          pal={pal}
          style={{ position: "absolute", top: 900, left: M, width: 1300, bottom: BOT }}
        />,
      );
      blocks.push(
        <BodyColumns
          key="body"
          data={data}
          pal={pal}
          columns={cols}
          fontSize={cols === 1 ? 30 : 26}
          style={{ position: "absolute", top: 900, left: 1520, right: M, bottom: BOT }}
        />,
      );
      break;
    }

    case "image-right-1col":
    case "image-right-2col": {
      const cols = L === "image-right-2col" ? 2 : 1;
      blocks.push(<ArticleHeader key="h" data={data} pal={pal} top={TOP} left={M} right={M} />);
      blocks.push(
        <ArticleByline key="b" data={data} pal={pal} top={620} left={M} right={M} />,
      );
      blocks.push(
        <ImageBox
          key="img"
          data={data}
          pal={pal}
          style={{ position: "absolute", top: 900, right: M, width: 1300, bottom: BOT }}
        />,
      );
      blocks.push(
        <BodyColumns
          key="body"
          data={data}
          pal={pal}
          columns={cols}
          fontSize={cols === 1 ? 30 : 26}
          style={{ position: "absolute", top: 900, left: M, right: 1520, bottom: BOT }}
        />,
      );
      break;
    }

    case "image-bottom-2col": {
      blocks.push(<ArticleHeader key="h" data={data} pal={pal} top={TOP} left={M} right={M} />);
      blocks.push(
        <ArticleByline key="b" data={data} pal={pal} top={620} left={M} right={M} />,
      );
      blocks.push(
        <BodyColumns
          key="body"
          data={data}
          pal={pal}
          columns={2}
          style={{ position: "absolute", top: 900, left: M, right: M, height: 1500 }}
        />,
      );
      blocks.push(
        <ImageBox
          key="img"
          data={data}
          pal={pal}
          style={{ position: "absolute", top: 2480, left: M, right: M, bottom: BOT }}
        />,
      );
      break;
    }

    case "full-image-overlay": {
      blocks.push(
        <ImageBox
          key="img"
          data={data}
          pal={pal}
          style={{ position: "absolute", inset: 0 }}
        />,
      );
      blocks.push(
        <div
          key="scrim"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)",
            pointerEvents: "none",
          }}
        />,
      );
      blocks.push(
        <Draggable
          key="section"
          blockKey="section"
          style={{
            position: "absolute",
            top: 240,
            left: M,
            right: M,
            fontFamily: "var(--font-sans)",
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#ffffff",
            fontWeight: 600,
          }}
        >
          {data.section}
        </Draggable>,
      );
      blocks.push(
        <Draggable
          key="hl"
          blockKey="headline"
          style={{
            position: "absolute",
            bottom: 700,
            left: M,
            right: M,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: 280,
              lineHeight: 0.92,
              letterSpacing: -3,
              margin: 0,
              color: "#ffffff",
            }}
          >
            {data.headline}
          </h1>
        </Draggable>,
      );
      blocks.push(
        <Draggable
          key="dek"
          blockKey="dek"
          style={{
            position: "absolute",
            bottom: 400,
            left: M,
            right: M,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 44,
              lineHeight: 1.3,
              margin: 0,
              color: "#ffffff",
              maxWidth: 2000,
            }}
          >
            {data.dek}
          </p>
        </Draggable>,
      );
      blocks.push(
        <Draggable
          key="by"
          blockKey="byline"
          style={{
            position: "absolute",
            bottom: 320,
            left: M,
            right: M,
            fontFamily: "var(--font-sans)",
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#ffffffcc",
          }}
        >
          {data.byline}
        </Draggable>,
      );
      break;
    }

    case "text-only-2col":
    case "text-only-3col": {
      const cols = L === "text-only-3col" ? 3 : 2;
      blocks.push(<ArticleHeader key="h" data={data} pal={pal} top={TOP} left={M} right={M} headlineSize={240} />);
      blocks.push(
        <ArticleByline key="b" data={data} pal={pal} top={780} left={M} right={M} />,
      );
      blocks.push(
        <BodyColumns
          key="body"
          data={data}
          pal={pal}
          columns={cols}
          fontSize={cols === 3 ? 24 : 28}
          style={{ position: "absolute", top: 1100, left: M, right: M, bottom: BOT }}
        />,
      );
      if (data.pullQuote) {
        blocks.push(
          <Draggable
            key="pq"
            blockKey="pull-quote"
            style={{
              position: "absolute",
              left: M,
              bottom: 320,
              width: 1400,
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
          </Draggable>,
        );
      }
      break;
    }
  }

  // Header folio (skip for full-image-overlay or when the page opts out)
  const showHeaderFolio = L !== "full-image-overlay" && !hideFolio;

  return (
    <Page innerRef={ref} pal={pal} dim={dim}>
      {showHeaderFolio && <Folio left={data.folio} right={`PAGE ${data.pageNumber}`} pal={pal} />}
      {blocks}
      {L !== "full-image-overlay" && <ArticleFooter data={data} pal={pal} />}
    </Page>
  );
});

/* — PHOTO ESSAY — */

const PhotoPreview = forwardRef<HTMLDivElement, { data: PhotoData; dim?: { w: number; h: number } }>(function PhotoPreview(
  { data, dim },
  ref,
) {
  const pal = PALETTES[data.palette];
  const isSplit = data.layout === "split";
  const isFramed = data.layout === "framed";

  return (
    <Page innerRef={ref} pal={pal} dim={dim}>
      <Draggable
        blockKey="image"
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
              pointerEvents: "none",
            }}
          />
        )}
      </Draggable>

      <Draggable
        blockKey="photo-header"
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
      </Draggable>

      <Draggable
        blockKey="copy"
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
      </Draggable>

      <Draggable
        blockKey="page-number"
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
      </Draggable>
    </Page>
  );
});

/* — CONTENTS — */

const ContentsPreview = forwardRef<HTMLDivElement, { data: ContentsData; dim?: { w: number; h: number }; hideFolio?: boolean }>(function ContentsPreview(
  { data, dim, hideFolio },
  ref,
) {
  const pal = PALETTES[data.palette];

  return (
    <Page innerRef={ref} pal={pal} dim={dim}>
      {!hideFolio && <Folio left={data.folio} right={`PAGE ${data.pageNumber}`} pal={pal} />}

      <Draggable
        blockKey="section"
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
      </Draggable>

      <Draggable
        blockKey="title"
        style={{
          position: "absolute",
          top: 320,
          left: 160,
          right: 160,
        }}
      >
        <h1
          style={{
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
      </Draggable>

      <Draggable
        blockKey="intro"
        style={{
          position: "absolute",
          top: 680,
          left: 160,
          right: 1200,
        }}
      >
        <p
          style={{
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
      </Draggable>

      <Draggable
        blockKey="entries"
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
            data-link-target={e.link || "none"}
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
        {data.entries.length === 0 && (
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: pal.muted,
              padding: 40,
              border: `1px dashed ${pal.muted}`,
            }}
          >
            Mark pages as “List in contents” to populate this index.
          </div>
        )}
      </Draggable>


      <Draggable
        blockKey="contents-footer"
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
      </Draggable>
    </Page>
  );
});

/* — AD — full-page brand placement — */

const AdPreview = forwardRef<HTMLDivElement, { data: AdData; dim?: { w: number; h: number } }>(function AdPreview(
  { data, dim },
  ref,
) {
  const pal = PALETTES[data.palette];
  const isSplit = data.layout === "split";
  const isFramed = data.layout === "framed";

  return (
    <Page innerRef={ref} pal={pal} dim={dim}>
      {/* Image */}
      <Draggable
        blockKey="image"
        style={{
          position: "absolute",
          top: isFramed ? 320 : 0,
          left: isFramed ? 240 : 0,
          right: isFramed ? 240 : isSplit ? "50%" : 0,
          bottom: isFramed ? 1500 : isSplit ? 0 : 1600,
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
              background: `repeating-linear-gradient(45deg, ${pal.bg} 0 40px, ${pal.muted}22 40px 80px)`,
            }}
          >
            Place ad image
          </div>
        )}
      </Draggable>

      {/* Eyebrow */}
      <Draggable
        blockKey="eyebrow"
        style={{
          position: "absolute",
          top: 120,
          left: isSplit ? "calc(50% + 120px)" : 160,
          right: 160,
          fontFamily: "var(--font-sans)",
          fontSize: 20,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: pal.rule,
          fontWeight: 600,
        }}
      >
        {data.eyebrow}
      </Draggable>

      {/* Copy block */}
      <Draggable
        blockKey="copy"
        style={{
          position: "absolute",
          left: isSplit ? "calc(50% + 120px)" : 160,
          right: 160,
          top: isSplit ? 480 : "auto",
          bottom: isSplit ? "auto" : 320,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 220,
            lineHeight: 0.9,
            color: data.logoColor,
            letterSpacing: -3,
            marginBottom: 60,
          }}
        >
          {data.brand}
        </div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 96,
            lineHeight: 1.05,
            margin: 0,
            color: pal.fg,
          }}
        >
          {data.headline}
        </h2>
        <div
          style={{
            marginTop: 48,
            borderTop: `1px solid ${pal.rule}`,
            paddingTop: 32,
            fontFamily: "var(--font-serif)",
            fontSize: 32,
            lineHeight: 1.5,
            color: pal.fg,
            maxWidth: 1400,
          }}
        >
          {data.body}
        </div>
        <div
          style={{
            marginTop: 56,
            fontFamily: "var(--font-sans)",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: pal.rule,
            fontWeight: 600,
          }}
        >
          {data.cta}
        </div>
      </Draggable>

      {/* Bottom folio */}
      <Draggable
        blockKey="ad-footer"
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
      </Draggable>
    </Page>
  );
});

/* — BACK COVER — closing page — */

const BackCoverPreview = forwardRef<HTMLDivElement, { data: BackCoverData; dim?: { w: number; h: number } }>(function BackCoverPreview(
  { data, dim },
  ref,
) {
  const pal = PALETTES[data.palette];

  return (
    <Page innerRef={ref} pal={pal} dim={dim}>
      {/* Optional background image */}
      {data.imageUrl && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <img
            src={data.imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `center ${data.imageY}%`,
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, ${pal.bg}99 0%, ${pal.bg}55 50%, ${pal.bg}cc 100%)`,
            }}
          />
        </div>
      )}

      <Draggable
        blockKey="masthead"
        style={{
          position: "absolute",
          top: 280,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "var(--font-display)",
          fontSize: 200,
          lineHeight: 1,
          letterSpacing: -2,
          color: data.logoColor,
        }}
      >
        {data.masthead}
      </Draggable>

      {/* Center quote */}
      <Draggable
        blockKey="quote"
        style={{
          position: "absolute",
          left: 280,
          right: 280,
          top: "42%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 140,
            lineHeight: 1.1,
            color: pal.fg,
          }}
        >
          {data.quote}
        </div>
        <div
          style={{
            marginTop: 60,
            fontFamily: "var(--font-sans)",
            fontSize: 24,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: pal.rule,
            fontWeight: 600,
          }}
        >
          {data.attribution}
        </div>
      </Draggable>

      {/* Bottom rule */}
      <Draggable
        blockKey="back-footer"
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 160,
          borderTop: `1px solid ${pal.rule}`,
          paddingTop: 28,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-sans)",
          fontSize: 22,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: pal.muted,
        }}
      >
        <span>The Arts Today · Pageluxe</span>
        <span>{data.pageNumber}</span>
      </Draggable>
    </Page>
  );
});
