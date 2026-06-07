import { useRef, useState } from "react";
import { X, Upload, Trash2, Loader2, Type, Palette, Plus } from "lucide-react";
import { FONT_ACCEPT_ATTR, normalizeHex } from "@/lib/brandAssets";
import type { BrandFontsApi } from "@/hooks/useBrandFonts";
import type { BrandSwatchesApi } from "@/hooks/useBrandSwatches";
import { PublicationBadge } from "@/components/PublicationBadge";

type Tab = "fonts" | "swatches";

export function BrandKitPanel({
  open,
  onClose,
  publicationId,
  publicationName,
  fonts,
  swatches,
}: {
  open: boolean;
  onClose: () => void;
  publicationId: string | null;
  publicationName?: string | null;
  fonts: BrandFontsApi;
  swatches: BrandSwatchesApi;
}) {
  const [tab, setTab] = useState<Tab>("fonts");

  if (!open) return null;

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background border-l border-border shadow-2xl flex flex-col"
      aria-label="Brand kit"
    >
      <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Brand kit</h2>
          <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5 truncate">
            Fonts & swatches
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PublicationBadge name={publicationName} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close brand kit panel"
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="px-4 pt-3 flex gap-1 border-b border-border">
        {(
          [
            ["fonts", "Fonts", Type],
            ["swatches", "Swatches", Palette],
          ] as const
        ).map(([t, label, Icon]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "text-[10px] tracking-[0.25em] uppercase px-3 py-2 rounded-t-sm border-b-2 -mb-px inline-flex items-center gap-1.5 " +
              (tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>

      {!publicationId ? (
        <div className="p-6 text-xs text-muted-foreground">
          Select a publication to manage its brand kit.
        </div>
      ) : tab === "fonts" ? (
        <FontsSection fonts={fonts} />
      ) : (
        <SwatchesSection swatches={swatches} />
      )}
    </aside>
  );
}

/* ----------------------------- Fonts ----------------------------- */

function FontsSection({ fonts }: { fonts: BrandFontsApi }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await fonts.upload(file);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept={FONT_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => void handlePick(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-border bg-secondary/40 hover:bg-secondary px-3 py-3 text-xs uppercase tracking-[0.25em] text-foreground rounded-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Uploading…" : "Upload font"}
        </button>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
        <p className="text-[10px] text-muted-foreground">
          WOFF2, WOFF, TTF, or OTF, up to 5 MB. Upload only fonts you are licensed to use.
        </p>
      </div>

      {/* Slot assignment */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          Publication font slots
        </p>
        {(["display", "serif", "sans"] as const).map((slot) => {
          const current =
            slot === "display"
              ? fonts.overrides.display_font_custom_id
              : slot === "serif"
                ? fonts.overrides.serif_font_custom_id
                : fonts.overrides.sans_font_custom_id;
          return (
            <label key={slot} className="flex items-center gap-2 text-xs">
              <span className="w-16 capitalize text-muted-foreground">{slot}</span>
              <select
                value={current ?? ""}
                onChange={(e) => void fonts.assignSlot(slot, e.target.value || null)}
                className="flex-1 border border-input bg-background px-2 py-1.5 text-xs rounded-sm text-foreground"
              >
                <option value="">— system default —</option>
                {fonts.fonts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.family_name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {fonts.loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : fonts.fonts.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No fonts yet. Upload a file to get started.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {fonts.fonts.map((font) => (
              <FontRow key={font.id} font={font} api={fonts} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FontRow({
  font,
  api,
}: {
  font: import("@/lib/brandAssets").BrandFont;
  api: BrandFontsApi;
}) {
  const [name, setName] = useState(font.family_name);
  const css = api.cssFamilyFor(font);
  return (
    <li className="px-4 py-3 flex items-center gap-3">
      <div
        className="h-10 w-10 flex items-center justify-center border border-border rounded-sm flex-shrink-0 text-base"
        style={{ fontFamily: `'${css}', system-ui, sans-serif` }}
        aria-hidden
      >
        Aa
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim();
            if (v && v !== font.family_name) void api.rename(font.id, v);
            else setName(font.family_name);
          }}
          className="w-full border border-transparent hover:border-input focus:border-input bg-transparent px-1 py-0.5 text-xs rounded-sm text-foreground"
          style={{ fontFamily: `'${css}', system-ui, sans-serif` }}
        />
        <p className="text-[10px] text-muted-foreground tracking-wide truncate" title={font.file_name}>
          {font.format} · {font.weight} {font.style !== "normal" ? `· ${font.style}` : ""} · {(font.size_bytes / 1024).toFixed(1)} KB
        </p>
      </div>
      <button
        type="button"
        onClick={() => void api.remove(font)}
        className="text-muted-foreground hover:text-destructive p-1.5 rounded-sm hover:bg-secondary"
        title="Delete font"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/* --------------------------- Swatches --------------------------- */

function SwatchesSection({ swatches }: { swatches: BrandSwatchesApi }) {
  const [hex, setHex] = useState("#000000");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const normalized = normalizeHex(hex);
    if (!normalized) {
      setErr("Enter a valid hex color, e.g. #ff8800.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await swatches.add(normalized, name);
      setName("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={normalizeHex(hex) ?? "#000000"}
            onChange={(e) => setHex(e.target.value)}
            className="h-9 w-12 p-0 border border-input rounded-sm bg-background"
            aria-label="Pick hex color"
          />
          <input
            type="text"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#ff8800"
            className="w-24 border border-input bg-background px-2 py-1.5 text-xs rounded-sm text-foreground font-mono"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (optional)"
            className="flex-1 border border-input bg-background px-2 py-1.5 text-xs rounded-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy}
            className="inline-flex items-center gap-1 border border-input px-2 py-1.5 text-xs rounded-sm bg-secondary/40 hover:bg-secondary disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {swatches.loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : swatches.swatches.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No swatches yet. Add your brand colors to apply them quickly inside layouts.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 p-4">
            {swatches.swatches.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 border border-border rounded-sm px-2 py-1.5"
              >
                <span
                  className="w-7 h-7 rounded-sm border border-border flex-shrink-0"
                  style={{ background: s.hex }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate" title={s.name || s.hex}>
                    {s.name || s.hex}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{s.hex}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void swatches.remove(s.id)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded-sm hover:bg-secondary"
                  title="Delete swatch"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
