import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CoverPreview } from "@/components/CoverPreview";
import {
  COVER_INCHES,
  COVER_PX,
  COVER_RATIO,
  DEFAULT_COVER,
  PALETTES,
  type CoverData,
} from "@/lib/coverDefaults";
import { exportJpeg, exportPdf, exportPng } from "@/lib/exportCover";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Arts Today — Cover Generator" },
      {
        name: "description",
        content:
          "Editorial cover layout generator for The Arts Today on Pageluxe. Exports print-ready files at 10.6667 × 14.2222 in for Adobe InDesign, Canva, and Adobe Fresco.",
      },
      { property: "og:title", content: "The Arts Today — Cover Generator" },
      {
        property: "og:description",
        content:
          "Monthly editorial cover generator. Export PDF / PNG / JPG at exact Pageluxe dimensions.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [data, setData] = useState<CoverData>(DEFAULT_COVER);
  const [busy, setBusy] = useState<string | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  // Fit the 3200×4267 cover into the available preview column
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const s = Math.min(w / COVER_PX.w, h / COVER_PX.h);
      setScale(s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const set = <K extends keyof CoverData>(k: K, v: CoverData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const handleImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("imageUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  const filenameBase = useMemo(
    () =>
      `arts-today-${data.issue
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
        .replace(/^-|-$/g, "")}-cover`,
    [data.issue],
  );

  const doExport = async (kind: "pdf" | "png" | "jpg") => {
    if (!coverRef.current) return;
    setBusy(kind.toUpperCase());
    try {
      if (kind === "pdf") await exportPdf(coverRef.current, `${filenameBase}.pdf`);
      else if (kind === "png") await exportPng(coverRef.current, `${filenameBase}.png`);
      else await exportJpeg(coverRef.current, `${filenameBase}.jpg`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-8 py-6 flex items-end justify-between gap-8 flex-wrap">
          <div>
            <div className="text-[11px] tracking-[0.4em] uppercase text-muted-foreground">
              Pageluxe · The Arts Today
            </div>
            <h1 className="font-display text-4xl mt-1" style={{ fontFamily: "var(--font-display)" }}>
              Monthly Cover Generator
            </h1>
          </div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            Output · {COVER_INCHES.w}″ × {COVER_INCHES.h}″ · 300 DPI ·{" "}
            {COVER_PX.w}×{COVER_PX.h}px
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-8 py-8 grid gap-8 lg:grid-cols-[380px_1fr]">
        {/* Controls */}
        <aside className="space-y-6">
          <Section title="Issue">
            <Field label="Issue line">
              <Input value={data.issue} onChange={(v) => set("issue", v)} />
            </Field>
            <Field label="Date">
              <Input value={data.date} onChange={(v) => set("date", v)} />
            </Field>
            <Field label="Issue badge">
              <Input value={data.price} onChange={(v) => set("price", v)} />
            </Field>
          </Section>

          <Section title="Masthead">
            <Field label="Title">
              <Input value={data.masthead} onChange={(v) => set("masthead", v)} />
            </Field>
            <Field label="Tagline">
              <Input value={data.tagline} onChange={(v) => set("tagline", v)} />
            </Field>
          </Section>

          <Section title="Cover Story">
            <Field label="Headline">
              <Input value={data.headline} onChange={(v) => set("headline", v)} />
            </Field>
            <Field label="Dek (deck / sub)">
              <Textarea value={data.dek} onChange={(v) => set("dek", v)} rows={3} />
            </Field>
            <Field label="Bottom feature line">
              <Input value={data.feature} onChange={(v) => set("feature", v)} />
            </Field>
            <Field label="Image credit">
              <Input value={data.credit} onChange={(v) => set("credit", v)} />
            </Field>
          </Section>

          <Section title="Cover Image">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImage(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-none file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest file:cursor-pointer"
            />
            <Field label="Fit">
              <div className="flex gap-2">
                {(["cover", "contain"] as const).map((f) => (
                  <Chip key={f} active={data.imageFit === f} onClick={() => set("imageFit", f)}>
                    {f}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={`Focal point · ${data.imageY}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={data.imageY}
                onChange={(e) => set("imageY", Number(e.target.value))}
                className="w-full accent-[color:var(--gold)]"
              />
            </Field>
          </Section>

          <Section title="Style">
            <Field label="Palette">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PALETTES) as CoverData["palette"][]).map((p) => {
                  const pal = PALETTES[p];
                  const active = data.palette === p;
                  return (
                    <button
                      key={p}
                      onClick={() => set("palette", p)}
                      className={`flex items-center gap-3 border px-3 py-2 text-xs uppercase tracking-widest transition ${
                        active ? "border-foreground" : "border-border hover:border-foreground/50"
                      }`}
                    >
                      <span
                        className="h-5 w-5 border border-border"
                        style={{ background: pal.bg }}
                      />
                      <span
                        className="h-5 w-5 -ml-2 border border-border"
                        style={{ background: pal.rule }}
                      />
                      {pal.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Layout">
              <div className="flex gap-2 flex-wrap">
                {(["classic", "edge", "framed"] as const).map((l) => (
                  <Chip key={l} active={data.layout === l} onClick={() => set("layout", l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Export">
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
              Files export at exact {COVER_INCHES.w}″ × {COVER_INCHES.h}″ — drop directly into
              Adobe InDesign, Canva, or Adobe Fresco.
            </p>
          </Section>
        </aside>

        {/* Preview stage */}
        <section
          ref={stageRef}
          className="relative bg-secondary/60 border border-border overflow-hidden"
          style={{ minHeight: "80vh", aspectRatio: `${COVER_RATIO}` }}
        >
          <div
            className="absolute left-1/2 top-1/2 origin-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]"
            style={{
              transform: `translate(-50%, -50%) scale(${scale})`,
              width: COVER_PX.w,
              height: COVER_PX.h,
            }}
          >
            <CoverPreview ref={coverRef} data={data} />
          </div>
        </section>
      </div>

      <footer className="border-t border-border mt-8">
        <div className="mx-auto max-w-[1600px] px-8 py-6 text-[11px] tracking-[0.3em] uppercase text-muted-foreground flex justify-between flex-wrap gap-4">
          <span>The Arts Today · Cover System</span>
          <span>Pageluxe Spec · 10.6667 × 14.2222 in</span>
        </div>
      </footer>
    </main>
  );
}

/* — UI primitives — */

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
      className="w-full border border-input bg-background px-3 py-2 text-sm font-serif focus:outline-none focus:border-foreground"
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
      className="w-full border border-input bg-background px-3 py-2 text-sm font-serif focus:outline-none focus:border-foreground resize-none"
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
