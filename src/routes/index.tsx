import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PagePreview } from "@/components/PagePreview";
import {
  COVER_INCHES,
  COVER_PX,
  COVER_RATIO,
  DEFAULT_CONTENTS,
  DEFAULT_COVER,
  DEFAULT_FEATURE,
  DEFAULT_PHOTO,
  PAGE_LABELS,
  PALETTES,
  type ContentsData,
  type ContentsEntry,
  type CoverData,
  type FeatureData,
  type PageType,
  type Palette,
  type PhotoData,
} from "@/lib/coverDefaults";
import {
  exportIssuePdf,
  exportJpeg,
  exportPdf,
  exportPng,
  type IssuePage,
} from "@/lib/exportCover";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Arts Today — Page Generator" },
      {
        name: "description",
        content:
          "Editorial cover & interior page generator for The Arts Today on Pageluxe. Exports print-ready files at 10.6667 × 14.2222 in for Adobe InDesign, Canva, and Adobe Fresco.",
      },
      { property: "og:title", content: "The Arts Today — Page Generator" },
      {
        property: "og:description",
        content:
          "Cover, feature article, photo essay, and contents pages — export PDF / PNG / JPG at exact Pageluxe dimensions.",
      },
    ],
  }),
  component: Index,
});

type AllData = {
  cover: CoverData;
  feature: FeatureData;
  photo: PhotoData;
  contents: ContentsData;
};

function Index() {
  const [pageType, setPageType] = useState<PageType>("cover");
  const [all, setAll] = useState<AllData>({
    cover: DEFAULT_COVER,
    feature: DEFAULT_FEATURE,
    photo: DEFAULT_PHOTO,
    contents: DEFAULT_CONTENTS,
  });
  const [busy, setBusy] = useState<string | null>(null);

  // One off-screen ref per page type — these are what the exporter captures.
  // Always-mounted hidden stage keeps every page render-ready so the Issue PDF
  // can capture them all without flipping tabs.
  const refs = {
    cover: useRef<HTMLDivElement>(null),
    feature: useRef<HTMLDivElement>(null),
    photo: useRef<HTMLDivElement>(null),
    contents: useRef<HTMLDivElement>(null),
  } as const;

  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setScale(Math.min(w / COVER_PX.w, h / COVER_PX.h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = all[pageType] as AllData[PageType];

  function update<T extends PageType>(t: T, patch: Partial<AllData[T]>) {
    setAll((a) => ({ ...a, [t]: { ...a[t], ...patch } }));
  }

  const issueSlug = useMemo(
    () =>
      (all.cover.issue || "issue")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
        .replace(/^-|-$/g, ""),
    [all.cover.issue],
  );

  const doExport = async (kind: "pdf" | "png" | "jpg") => {
    const node = refs[pageType].current;
    if (!node) return;
    setBusy(kind.toUpperCase());
    try {
      const name = `arts-today-${issueSlug}-${pageType}`;
      if (kind === "pdf") await exportPdf(node, `${name}.pdf`);
      else if (kind === "png") await exportPng(node, `${name}.png`);
      else await exportJpeg(node, `${name}.jpg`);
    } finally {
      setBusy(null);
    }
  };

  const doExportIssue = async () => {
    setBusy("ISSUE");
    try {
      // Order in the bundled PDF — also the bookmark order.
      const order: PageType[] = ["cover", "contents", "feature", "photo"];
      const pages: IssuePage[] = order
        .map((t) => {
          const node = refs[t].current;
          if (!node) return null;
          return { pageType: t, node, label: PAGE_LABELS[t] };
        })
        .filter((p): p is IssuePage => p !== null);

      await exportIssuePdf(
        pages,
        {
          title: `The Arts Today — ${all.cover.issue}`,
          author: "The Arts Today",
          subject: all.cover.headline,
        },
        `arts-today-${issueSlug}-issue.pdf`,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1700px] px-8 py-6 flex items-end justify-between gap-8 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.4em] uppercase text-muted-foreground">
              Pageluxe · The Arts Today
            </div>
            <h1
              className="text-4xl mt-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Monthly Page Generator
            </h1>
          </div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            Output · {COVER_INCHES.w}″ × {COVER_INCHES.h}″ · 300 DPI ·{" "}
            {COVER_PX.w}×{COVER_PX.h}px
          </div>
        </div>

        {/* Page type tabs */}
        <div className="mx-auto max-w-[1700px] px-8 pb-0 flex gap-0 border-t border-border">
          {(Object.keys(PAGE_LABELS) as PageType[]).map((t) => (
            <button
              key={t}
              onClick={() => setPageType(t)}
              className={`px-5 py-4 text-[11px] tracking-[0.3em] uppercase border-r border-border transition ${
                pageType === t
                  ? "bg-foreground text-background"
                  : "hover:bg-secondary text-foreground"
              }`}
            >
              {PAGE_LABELS[t]}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-[1700px] px-8 py-8 grid gap-8 lg:grid-cols-[400px_1fr]">
        <aside className="space-y-6">
          {pageType === "cover" && (
            <CoverEditor data={all.cover} set={(p) => update("cover", p)} />
          )}
          {pageType === "feature" && (
            <FeatureEditor data={all.feature} set={(p) => update("feature", p)} />
          )}
          {pageType === "photo" && (
            <PhotoEditor data={all.photo} set={(p) => update("photo", p)} />
          )}
          {pageType === "contents" && (
            <ContentsEditor data={all.contents} set={(p) => update("contents", p)} />
          )}

          <Section title="Export · this page">
            <div className="grid grid-cols-3 gap-2">
              <ExportBtn onClick={() => doExport("pdf")} busy={busy === "PDF"}>
                PDF
              </ExportBtn>
              <ExportBtn onClick={() => doExport("png")} busy={busy === "PNG"}>
                PNG
              </ExportBtn>
              <ExportBtn onClick={() => doExport("jpg")} busy={busy === "JPG"}>
                JPG
              </ExportBtn>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground mt-3">
              Single-page export at exact {COVER_INCHES.w}″ × {COVER_INCHES.h}″ for InDesign,
              Canva, and Fresco.
            </p>
          </Section>

          <Section title="Export · interactive issue">
            <button
              onClick={doExportIssue}
              disabled={busy === "ISSUE"}
              className="w-full border border-[color:var(--gold)] bg-[color:var(--gold)] text-background px-3 py-3 text-[11px] uppercase tracking-[0.3em] hover:bg-background hover:text-[color:var(--gold)] transition disabled:opacity-60"
            >
              {busy === "ISSUE" ? "Assembling…" : "Download Issue PDF"}
            </button>
            <p className="text-[11px] leading-relaxed text-muted-foreground mt-3">
              Bundles all four pages into one PDF with bookmarks and a clickable contents
              page that jumps to each section. Set per-entry targets in the Contents editor.
            </p>
          </Section>
        </aside>

        <section
          ref={stageRef}
          className="relative bg-secondary/60 border border-border overflow-hidden"
          style={{ minHeight: "85vh", aspectRatio: `${COVER_RATIO}` }}
        >
          <div
            className="absolute left-1/2 top-1/2 origin-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]"
            style={{
              transform: `translate(-50%, -50%) scale(${scale})`,
              width: COVER_PX.w,
              height: COVER_PX.h,
            }}
          >
            {/* Visible preview — re-renders identical content to the hidden
                ref'd copy below; exporter always captures the hidden node so
                the active tab's state can't get out of sync. */}
            <PagePreview pageType={pageType} data={data} />
          </div>
        </section>
      </div>

      {/* Off-screen capture stage — every page mounted with its own ref so the
          Issue PDF assembler can render them in order without flipping tabs. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -100000,
          top: 0,
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <PagePreview ref={refs.cover} pageType="cover" data={all.cover} />
        <PagePreview ref={refs.contents} pageType="contents" data={all.contents} />
        <PagePreview ref={refs.feature} pageType="feature" data={all.feature} />
        <PagePreview ref={refs.photo} pageType="photo" data={all.photo} />
      </div>


      <footer className="border-t border-border mt-8">
        <div className="mx-auto max-w-[1700px] px-8 py-6 text-[11px] tracking-[0.3em] uppercase text-muted-foreground flex justify-between flex-wrap gap-4">
          <span>The Arts Today · Editorial Page System</span>
          <span>Pageluxe Spec · 10.6667 × 14.2222 in</span>
        </div>
      </footer>
    </main>
  );
}

/* — EDITORS — */

function CoverEditor({
  data,
  set,
}: {
  data: CoverData;
  set: (p: Partial<CoverData>) => void;
}) {
  return (
    <>
      <Section title="Issue">
        <Field label="Issue line"><Input value={data.issue} onChange={(v) => set({ issue: v })} /></Field>
        <Field label="Date"><Input value={data.date} onChange={(v) => set({ date: v })} /></Field>
        <Field label="Issue badge"><Input value={data.price} onChange={(v) => set({ price: v })} /></Field>
      </Section>
      <Section title="Masthead">
        <Field label="Title"><Input value={data.masthead} onChange={(v) => set({ masthead: v })} /></Field>
        <Field label="Tagline"><Input value={data.tagline} onChange={(v) => set({ tagline: v })} /></Field>
      </Section>
      <Section title="Cover Story">
        <Field label="Headline"><Input value={data.headline} onChange={(v) => set({ headline: v })} /></Field>
        <Field label="Dek"><Textarea value={data.dek} onChange={(v) => set({ dek: v })} rows={3} /></Field>
        <Field label="Feature line"><Input value={data.feature} onChange={(v) => set({ feature: v })} /></Field>
        <Field label="Image credit"><Input value={data.credit} onChange={(v) => set({ credit: v })} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit={data.imageFit}
        onFit={(f) => set({ imageFit: f })}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
      />
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
        <Field label="Layout">
          <div className="flex gap-2 flex-wrap">
            {(["classic", "edge", "framed"] as const).map((l) => (
              <Chip key={l} active={data.layout === l} onClick={() => set({ layout: l })}>
                {l}
              </Chip>
            ))}
          </div>
        </Field>
      </Section>
    </>
  );
}

function FeatureEditor({
  data,
  set,
}: {
  data: FeatureData;
  set: (p: Partial<FeatureData>) => void;
}) {
  return (
    <>
      <Section title="Folio">
        <Field label="Folio (top header)"><Input value={data.folio} onChange={(v) => set({ folio: v })} /></Field>
        <Field label="Section eyebrow"><Input value={data.section} onChange={(v) => set({ section: v })} /></Field>
        <Field label="Page number"><Input value={data.pageNumber} onChange={(v) => set({ pageNumber: v })} /></Field>
      </Section>
      <Section title="Headline">
        <Field label="Headline"><Textarea value={data.headline} onChange={(v) => set({ headline: v })} rows={2} /></Field>
        <Field label="Dek"><Textarea value={data.dek} onChange={(v) => set({ dek: v })} rows={3} /></Field>
        <Field label="Byline"><Input value={data.byline} onChange={(v) => set({ byline: v })} /></Field>
      </Section>
      <Section title="Body">
        <Field label="Body copy (blank line = paragraph)">
          <Textarea value={data.body} onChange={(v) => set({ body: v })} rows={12} />
        </Field>
        <Field label="Pull quote"><Textarea value={data.pullQuote} onChange={(v) => set({ pullQuote: v })} rows={3} /></Field>
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <input
            type="checkbox"
            checked={data.dropCap}
            onChange={(e) => set({ dropCap: e.target.checked })}
            className="accent-[color:var(--gold)]"
          />
          Drop cap
        </label>
      </Section>
      <Section title="Image">
        <Field label="Caption"><Textarea value={data.imageCaption} onChange={(v) => set({ imageCaption: v })} rows={2} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit="cover"
        onFit={() => {}}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
        hideFit
      />
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
    </>
  );
}

function PhotoEditor({
  data,
  set,
}: {
  data: PhotoData;
  set: (p: Partial<PhotoData>) => void;
}) {
  return (
    <>
      <Section title="Folio">
        <Field label="Folio"><Input value={data.folio} onChange={(v) => set({ folio: v })} /></Field>
        <Field label="Section"><Input value={data.section} onChange={(v) => set({ section: v })} /></Field>
        <Field label="Page number"><Input value={data.pageNumber} onChange={(v) => set({ pageNumber: v })} /></Field>
      </Section>
      <Section title="Content">
        <Field label="Title"><Input value={data.title} onChange={(v) => set({ title: v })} /></Field>
        <Field label="Caption"><Textarea value={data.caption} onChange={(v) => set({ caption: v })} rows={4} /></Field>
        <Field label="Credit"><Input value={data.credit} onChange={(v) => set({ credit: v })} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit={data.imageFit}
        onFit={(f) => set({ imageFit: f })}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
      />
      <Section title="Style">
        <Field label="Layout">
          <div className="flex gap-2 flex-wrap">
            {(["full-bleed", "framed", "split"] as const).map((l) => (
              <Chip key={l} active={data.layout === l} onClick={() => set({ layout: l })}>
                {l}
              </Chip>
            ))}
          </div>
        </Field>
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
    </>
  );
}

function ContentsEditor({
  data,
  set,
}: {
  data: ContentsData;
  set: (p: Partial<ContentsData>) => void;
}) {
  const updateEntry = (i: number, patch: Partial<ContentsData["entries"][number]>) => {
    const next = data.entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    set({ entries: next });
  };
  const removeEntry = (i: number) =>
    set({ entries: data.entries.filter((_, idx) => idx !== i) });
  const addEntry = () =>
    set({
      entries: [
        ...data.entries,
        { section: "SECTION", title: "Untitled", byline: "—", page: "000", link: "none" },
      ],
    });

  return (
    <>
      <Section title="Header">
        <Field label="Folio"><Input value={data.folio} onChange={(v) => set({ folio: v })} /></Field>
        <Field label="Issue"><Input value={data.issue} onChange={(v) => set({ issue: v })} /></Field>
        <Field label="Date"><Input value={data.date} onChange={(v) => set({ date: v })} /></Field>
        <Field label="Page number"><Input value={data.pageNumber} onChange={(v) => set({ pageNumber: v })} /></Field>
        <Field label="Intro"><Textarea value={data.intro} onChange={(v) => set({ intro: v })} rows={3} /></Field>
      </Section>
      <Section title="Entries">
        <div className="space-y-3">
          {data.entries.map((e, i) => (
            <div key={i} className="border border-border p-3 space-y-2 bg-background">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                  #{i + 1}
                </span>
                <button
                  onClick={() => removeEntry(i)}
                  className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
              <Input value={e.section} onChange={(v) => updateEntry(i, { section: v })} />
              <Input value={e.title} onChange={(v) => updateEntry(i, { title: v })} />
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <Input value={e.byline} onChange={(v) => updateEntry(i, { byline: v })} />
                <Input value={e.page} onChange={(v) => updateEntry(i, { page: v })} />
              </div>
              <label className="block">
                <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                  Link → (interactive PDF)
                </div>
                <select
                  value={e.link}
                  onChange={(ev) =>
                    updateEntry(i, { link: ev.target.value as ContentsEntry["link"] })
                  }
                  className="w-full border border-input bg-background px-2 py-1.5 text-xs uppercase tracking-widest focus:outline-none focus:border-foreground"
                >
                  <option value="none">No link</option>
                  <option value="cover">Cover</option>
                  <option value="contents">Contents</option>
                  <option value="feature">Feature Article</option>
                  <option value="photo">Photo Essay</option>
                </select>
              </label>
            </div>
          ))}
        </div>
        <button
          onClick={addEntry}
          className="mt-3 w-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary"
        >
          + Add entry
        </button>
      </Section>
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
    </>
  );
}

/* — primitives — */

function ImageBlock({
  url,
  onUrl,
  fit,
  onFit,
  y,
  onY,
  hideFit,
}: {
  url: string | null;
  onUrl: (u: string | null) => void;
  fit: "cover" | "contain";
  onFit: (f: "cover" | "contain") => void;
  y: number;
  onY: (y: number) => void;
  hideFit?: boolean;
}) {
  const handle = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => onUrl(String(r.result));
    r.readAsDataURL(file);
  };
  return (
    <Section title="Image">
      <input
        type="file"
        accept="image/*"
        onChange={(e) => handle(e.target.files?.[0])}
        className="block w-full text-sm file:mr-3 file:rounded-none file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest file:cursor-pointer"
      />
      {url && (
        <button
          onClick={() => onUrl(null)}
          className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-destructive"
        >
          Remove image
        </button>
      )}
      {!hideFit && (
        <Field label="Fit">
          <div className="flex gap-2">
            {(["cover", "contain"] as const).map((f) => (
              <Chip key={f} active={fit === f} onClick={() => onFit(f)}>
                {f}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <Field label={`Focal · ${y}%`}>
        <input
          type="range"
          min={0}
          max={100}
          value={y}
          onChange={(e) => onY(Number(e.target.value))}
          className="w-full accent-[color:var(--gold)]"
        />
      </Field>
    </Section>
  );
}

function PaletteField({
  value,
  onChange,
}: {
  value: Palette;
  onChange: (p: Palette) => void;
}) {
  return (
    <Field label="Palette">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(PALETTES) as Palette[]).map((p) => {
          const pal = PALETTES[p];
          const active = value === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`flex items-center gap-3 border px-3 py-2 text-xs uppercase tracking-widest transition ${
                active ? "border-foreground" : "border-border hover:border-foreground/50"
              }`}
            >
              <span className="h-5 w-5 border border-border" style={{ background: pal.bg }} />
              <span className="h-5 w-5 -ml-2 border border-border" style={{ background: pal.rule }} />
              {pal.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-4">
        {title}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}
function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-foreground"
      style={{ fontFamily: "var(--font-serif)" }}
    />
  );
}
function Textarea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none"
      style={{ fontFamily: "var(--font-serif)" }}
    />
  );
}
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 border text-[10px] uppercase tracking-[0.3em] transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:border-foreground/50"
      }`}
    >
      {children}
    </button>
  );
}
function ExportBtn({
  onClick,
  busy,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="border border-foreground bg-foreground text-background px-3 py-3 text-[11px] uppercase tracking-[0.3em] hover:bg-background hover:text-foreground transition disabled:opacity-60"
    >
      {busy ? "…" : children}
    </button>
  );
}
