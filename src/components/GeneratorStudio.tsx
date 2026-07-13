import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wand2, Sparkles, Download, Save, RotateCw, Check, Type } from "lucide-react";
import { streamImage } from "@/lib/streamImage";
import {
  craftGenerationPrompt,
  craftAdCopy,
  saveGeneratedAssetRecord,
  type CreativeType,
} from "@/lib/generator.functions";
import { dataUrlToBlob, uploadEditorImage } from "@/lib/imageUpload";
import { renderAdComposite, type AdCopy, type AdPlacement } from "@/lib/adOverlay";


export type GeneratorBrandContext = {
  publication?: string;
  tagline?: string;
  paletteHex?: string[];
  fontLabel?: string;
  tone?: string;
};

const TYPES: Array<{ id: CreativeType; label: string; hint: string }> = [
  { id: "model", label: "Model shot", hint: "Editorial fashion / lifestyle portrait, styling, mood." },
  { id: "ad", label: "Full ad", hint: "Polished ad image; text is overlaid separately by the layout system." },
  { id: "product", label: "Product / still-life", hint: "Studio still-life or product hero." },
  { id: "hero", label: "Article hero", hint: "Cinematic story-hero art matching a headline." },
];

const ASPECTS: Array<{ id: "portrait" | "square" | "landscape"; label: string }> = [
  { id: "portrait", label: "Portrait 3:4" },
  { id: "square", label: "Square 1:1" },
  { id: "landscape", label: "Landscape 16:9" },
];

/**
 * Shared generator UI used by both the in-editor sidebar panel and the
 * standalone /generate page. Streams partial preview frames from the
 * server route at /api/generate-image and offers save / download / place.
 */
export function GeneratorStudio({
  brand,
  onUseImage,
  context,
}: {
  brand?: GeneratorBrandContext | null;
  onUseImage?: (url: string) => void;
  context: "editor" | "standalone";
}) {
  const [creativeType, setCreativeType] = useState<CreativeType>("model");
  const [aspect, setAspect] = useState<"portrait" | "square" | "landscape">("portrait");
  const [brief, setBrief] = useState("");
  const [refined, setRefined] = useState("");
  const [useBrand, setUseBrand] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [crafting, setCrafting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adCopy, setAdCopy] = useState<AdCopy | null>(null);
  const [composited, setComposited] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [variantCount, setVariantCount] = useState<number>(6);
  const [variants, setVariants] = useState<Array<{ url: string | null; final: boolean; error?: string }>>([]);
  const [variantsRunning, setVariantsRunning] = useState(false);
  const variantAbortsRef = useRef<AbortController[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const craft = useServerFn(craftGenerationPrompt);
  const craftCopy = useServerFn(craftAdCopy);
  const saveRow = useServerFn(saveGeneratedAssetRecord);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const brandForPrompt = () =>
    useBrand && brand
      ? {
          publication: brand.publication,
          tagline: brand.tagline,
          paletteHex: brand.paletteHex,
          fontLabel: brand.fontLabel,
          tone: brand.tone,
        }
      : null;

  async function handleEnhance() {
    if (!brief.trim()) {
      toast.error("Add a short brief first.");
      return;
    }
    setCrafting(true);
    try {
      const res = await craft({
        data: { creativeType, brief: brief.trim(), aspect, brand: brandForPrompt() },
      });
      setRefined(res.refined);
      toast.success("Prompt enhanced");
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to enhance prompt");
    } finally {
      setCrafting(false);
    }
  }

  async function handleGenerate() {
    const prompt = refined.trim() || brief.trim();
    if (!prompt) {
      toast.error("Add a brief or enhance a prompt first.");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGenerating(true);
    setImage(null);
    setIsFinal(false);
    setSaved(false);
    setAdCopy(null);
    setComposited(null);
    try {
      await streamImage(
        "/api/generate-image",
        prompt,
        (url, final) => {
          setImage(url);
          if (final) setIsFinal(true);
        },
        ctrl.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error((err as Error).message ?? "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  }

  const exportSrc = composited || image;

  async function handleSave() {
    if (!exportSrc || !isFinal) return;
    try {
      const blob = dataUrlToBlob(exportSrc);
      const up = await uploadEditorImage({
        issueId: "generated",
        input: blob,
        fileName: `${creativeType}-${Date.now()}.png`,
        folder: "generated",
      });
      await saveRow({
        data: {
          creativeType,
          prompt: brief.trim() || refined.trim(),
          refinedPrompt: refined.trim() || undefined,
          storagePath: up.path,
          publicUrl: up.url,
          brandApplied: useBrand,
          aspect,
        },
      });
      setSaved(true);
      toast.success("Saved to library");
    } catch (err) {
      toast.error((err as Error).message ?? "Save failed");
    }
  }

  function handleDownload() {
    if (!exportSrc || !isFinal) return;
    const a = document.createElement("a");
    a.href = exportSrc;
    a.download = `${creativeType}-${Date.now()}.png`;
    a.click();
  }

  async function handleUse() {
    if (!exportSrc || !isFinal || !onUseImage) return;
    try {
      const blob = dataUrlToBlob(exportSrc);
      const up = await uploadEditorImage({
        issueId: "generated",
        input: blob,
        fileName: `${creativeType}-${Date.now()}.png`,
        folder: "generated",
      });
      onUseImage(up.url);
      toast.success("Placed on page");
    } catch (err) {
      toast.error((err as Error).message ?? "Couldn't place image");
    }
  }

  async function handleGenerateCopy() {
    if (!brief.trim() && !refined.trim()) {
      toast.error("Add a brief first.");
      return;
    }
    setCopyLoading(true);
    try {
      const res = await craftCopy({
        data: {
          brief: brief.trim() || refined.trim(),
          refinedPrompt: refined.trim() || undefined,
          brand: brandForPrompt(),
        },
      });
      setAdCopy({
        headline: res.headline,
        subhead: res.subhead || "",
        body: res.body,
        cta: res.cta,
        placement: res.placement as AdPlacement,
        textPolarity: res.textPolarity,
        fontFamily: "serif",
        accent: brand?.paletteHex?.[0],
      });
      toast.success("Ad copy generated");
    } catch (err) {
      toast.error((err as Error).message ?? "Copy generation failed");
    } finally {
      setCopyLoading(false);
    }
  }

  // Re-composite whenever the image or ad copy changes.
  useEffect(() => {
    if (!image || !isFinal || !adCopy) {
      setComposited(null);
      return;
    }
    let cancelled = false;
    renderAdComposite(image, adCopy)
      .then((url) => {
        if (!cancelled) setComposited(url);
      })
      .catch((err) => {
        if (!cancelled) toast.error((err as Error).message ?? "Overlay render failed");
      });
    return () => {
      cancelled = true;
    };
  }, [image, isFinal, adCopy]);

  const displaySrc = composited || image;

  const previewAspectClass =
    aspect === "portrait" ? "aspect-[3/4]" : aspect === "landscape" ? "aspect-[16/9]" : "aspect-square";


  return (
    <div className="space-y-4">
      {/* Creative type picker */}
      <div>
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
          Creative type
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCreativeType(t.id)}
              className={
                "text-left px-3 py-2 border text-[11px] leading-tight transition-colors " +
                (creativeType === t.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground/40 bg-background")
              }
            >
              <div className="font-medium tracking-wide">{t.label}</div>
              <div
                className={
                  "text-[10px] mt-0.5 " +
                  (creativeType === t.id ? "text-background/70" : "text-muted-foreground")
                }
              >
                {t.hint}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Brief */}
      <div>
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-2">
          Brief
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder={
            creativeType === "model"
              ? "A model in oversized cream wool coat, backlit on a rain-slick Paris street, early evening"
              : creativeType === "ad"
                ? "Amber perfume bottle on marble, warm lamp light, negative space top-right for headline"
                : creativeType === "product"
                  ? "A single ceramic espresso cup on linen, morning window light, soft shadows"
                  : "Cinematic hero for a story about slow travel through the Dolomites in autumn"
          }
          className="w-full border border-border bg-background px-3 py-2 text-sm resize-y"
        />
      </div>

      {/* Aspect + brand toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAspect(a.id)}
              className={
                "px-2.5 py-1 border text-[10px] tracking-[0.2em] uppercase " +
                (aspect === a.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:border-foreground/40")
              }
            >
              {a.label}
            </button>
          ))}
        </div>
        {brand && (
          <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useBrand}
              onChange={(e) => setUseBrand(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            <span className="tracking-wide">Brand-aware</span>
          </label>
        )}
      </div>

      {/* Enhance + refined prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Refined prompt {refined ? "(editable)" : "(optional)"}
          </div>
          <button
            type="button"
            onClick={handleEnhance}
            disabled={crafting || !brief.trim()}
            className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase border border-border px-2.5 py-1 hover:border-foreground/40 disabled:opacity-40"
          >
            <Sparkles className="h-3 w-3" />
            {crafting ? "Enhancing…" : "Enhance"}
          </button>
        </div>
        <textarea
          value={refined}
          onChange={(e) => setRefined(e.target.value)}
          rows={3}
          placeholder="Click Enhance to expand your brief into a detailed image prompt, or type your own."
          className="w-full border border-border bg-background px-3 py-2 text-xs resize-y"
        />
      </div>

      {/* Generate */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || (!brief.trim() && !refined.trim())}
        className="w-full inline-flex items-center justify-center gap-2 border border-foreground bg-foreground text-background px-4 py-2.5 text-[11px] tracking-[0.3em] uppercase hover:bg-foreground/90 disabled:opacity-40"
      >
        <Wand2 className="h-3.5 w-3.5" />
        {generating ? "Generating…" : image ? "Regenerate" : "Generate"}
      </button>

      {/* Preview */}
      {image && (
        <div className="space-y-2">
          <div
            className={
              "relative w-full overflow-hidden border border-border bg-secondary " +
              previewAspectClass
            }
          >
            <img
              src={displaySrc || ""}
              alt=""
              className={
                "w-full h-full object-cover transition-[filter] duration-500 " +
                (isFinal ? "blur-0" : "blur-2xl scale-105")
              }
            />
            {!isFinal && (
              <div className="absolute inset-x-0 bottom-0 bg-background/70 backdrop-blur-sm text-[10px] tracking-[0.3em] uppercase px-3 py-1.5 text-center">
                Rendering…
              </div>
            )}
          </div>

          {/* Ad copy overlay — only for full ads */}
          {creativeType === "ad" && isFinal && (
            <AdCopyPanel
              adCopy={adCopy}
              onChange={setAdCopy}
              onGenerate={handleGenerateCopy}
              loading={copyLoading}
              accentSwatches={brand?.paletteHex ?? []}
            />
          )}
          <div className="flex flex-wrap gap-1.5">
            {context === "editor" && onUseImage && (
              <button
                type="button"
                onClick={handleUse}
                disabled={!isFinal}
                className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-1.5 border border-foreground bg-foreground text-background px-3 py-1.5 text-[10px] tracking-[0.25em] uppercase disabled:opacity-40"
              >
                <Check className="h-3 w-3" />
                Use on this page
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isFinal || saved}
              className="inline-flex items-center justify-center gap-1.5 border border-border px-3 py-1.5 text-[10px] tracking-[0.25em] uppercase hover:border-foreground/40 disabled:opacity-40"
            >
              <Save className="h-3 w-3" />
              {saved ? "Saved" : "Save to library"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!isFinal}
              className="inline-flex items-center justify-center gap-1.5 border border-border px-3 py-1.5 text-[10px] tracking-[0.25em] uppercase hover:border-foreground/40 disabled:opacity-40"
            >
              <Download className="h-3 w-3" />
              PNG
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center justify-center gap-1.5 border border-border px-3 py-1.5 text-[10px] tracking-[0.25em] uppercase hover:border-foreground/40 disabled:opacity-40"
            >
              <RotateCw className="h-3 w-3" />
              Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PLACEMENTS: Array<{ id: AdPlacement; label: string }> = [
  { id: "top-left", label: "↖" },
  { id: "top-center", label: "↑" },
  { id: "top-right", label: "↗" },
  { id: "bottom-left", label: "↙" },
  { id: "bottom-center", label: "↓" },
  { id: "bottom-right", label: "↘" },
];

function AdCopyPanel({
  adCopy,
  onChange,
  onGenerate,
  loading,
  accentSwatches,
}: {
  adCopy: AdCopy | null;
  onChange: (next: AdCopy | null) => void;
  onGenerate: () => void;
  loading: boolean;
  accentSwatches: string[];
}) {
  const set = <K extends keyof AdCopy>(k: K, v: AdCopy[K]) => {
    if (!adCopy) return;
    onChange({ ...adCopy, [k]: v });
  };
  return (
    <div className="border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground inline-flex items-center gap-1.5">
          <Type className="h-3 w-3" /> Ad copy overlay
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase border border-border px-2.5 py-1 hover:border-foreground/40 disabled:opacity-40"
        >
          <Sparkles className="h-3 w-3" />
          {loading ? "Writing…" : adCopy ? "Rewrite" : "Generate copy"}
        </button>
      </div>

      {adCopy ? (
        <div className="space-y-2">
          <input
            value={adCopy.headline}
            onChange={(e) => set("headline", e.target.value)}
            placeholder="Headline"
            className="w-full border border-border bg-background px-2.5 py-1.5 text-sm font-serif"
          />
          <input
            value={adCopy.subhead ?? ""}
            onChange={(e) => set("subhead", e.target.value)}
            placeholder="Subhead (optional)"
            className="w-full border border-border bg-background px-2.5 py-1.5 text-xs italic"
          />
          <textarea
            value={adCopy.body ?? ""}
            onChange={(e) => set("body", e.target.value)}
            rows={2}
            placeholder="Body"
            className="w-full border border-border bg-background px-2.5 py-1.5 text-xs resize-y"
          />
          <input
            value={adCopy.cta ?? ""}
            onChange={(e) => set("cta", e.target.value)}
            placeholder="CTA"
            className="w-full border border-border bg-background px-2.5 py-1.5 text-xs tracking-wider uppercase"
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-1">
                Placement
              </div>
              <div className="grid grid-cols-3 gap-1">
                {PLACEMENTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set("placement", p.id)}
                    className={
                      "h-7 border text-xs " +
                      (adCopy.placement === p.id
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/40")
                    }
                    title={p.id}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-1">
                Text tone
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("textPolarity", t)}
                    className={
                      "h-7 border text-[10px] tracking-[0.2em] uppercase " +
                      (adCopy.textPolarity === t
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/40")
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mt-2 mb-1">
                Font
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(["serif", "sans"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set("fontFamily", f)}
                    className={
                      "h-7 border text-[10px] tracking-[0.2em] uppercase " +
                      ((adCopy.fontFamily ?? "serif") === f
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/40")
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-1">
              CTA accent
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[undefined, ...(accentSwatches || []), "#000000", "#ffffff"].map((c, i) => (
                <button
                  key={`${c ?? "auto"}-${i}`}
                  type="button"
                  onClick={() => set("accent", c)}
                  className={
                    "h-6 w-6 border " +
                    ((adCopy.accent ?? undefined) === c
                      ? "ring-2 ring-foreground border-foreground"
                      : "border-border")
                  }
                  style={{ background: c ?? "transparent" }}
                  title={c ?? "auto"}
                >
                  {c === undefined && <span className="text-[9px]">A</span>}
                </button>
              ))}
              <input
                type="color"
                value={adCopy.accent ?? "#111111"}
                onChange={(e) => set("accent", e.target.value)}
                className="h-6 w-8 border border-border bg-background p-0"
                title="Custom color"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">
          Generate ad copy to overlay headline, body, and CTA on this image — then edit any field
          and save the composited ad.
        </div>
      )}
    </div>
  );
}

