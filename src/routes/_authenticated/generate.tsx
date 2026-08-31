import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Copy as CopyIcon, Download } from "lucide-react";
import { GeneratorStudio } from "@/components/GeneratorStudio";
import { listGeneratedAssets, deleteGeneratedAsset } from "@/lib/generator.functions";
import { resignImageUrl, extractAttachmentPath } from "@/lib/imageUpload";

export const Route = createFileRoute("/_authenticated/generate")({
  head: () => ({
    meta: [
      { title: "AI Image Generator — Pageluxe" },
      {
        name: "description",
        content:
          "Generate editorial model shots, ads, still-life, and article hero images with AI. Save to your library and drop straight into your publication.",
      },
      { property: "og:title", content: "AI Image Generator — Pageluxe" },
      {
        property: "og:description",
        content:
          "Editorial-grade AI image generation for magazine covers, ads, and article art.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GeneratePage,
});

type AssetRow = {
  id: string;
  creative_type: string;
  prompt: string;
  refined_prompt: string | null;
  storage_path: string;
  public_url: string;
  brand_applied: boolean;
  aspect: string | null;
  created_at: string;
};

function GeneratePage() {
  const list = useServerFn(listGeneratedAssets);
  const del = useServerFn(deleteGeneratedAsset);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = (await list()) as AssetRow[];
        if (cancelled) return;
        setAssets(rows);
        // Refresh signed URLs — stored URLs expire after 7 days.
        const pairs = await Promise.all(
          rows.map(async (r) => {
            const path = extractAttachmentPath(r.public_url) ?? r.storage_path;
            const fresh = await resignImageUrl(path);
            return [r.id, fresh ?? r.public_url] as const;
          }),
        );
        if (cancelled) return;
        setSignedUrls(Object.fromEntries(pairs));
      } catch (err) {
        if (!cancelled) toast.error((err as Error).message ?? "Failed to load library");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [list, refreshTick]);

  async function handleDelete(id: string) {
    try {
      await del({ data: { id } });
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast.success("Deleted");
    } catch (err) {
      toast.error((err as Error).message ?? "Delete failed");
    }
  }

  async function handleCopyUrl(id: string) {
    const url = signedUrls[id];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <header className="mb-8 pb-6 border-b border-border">
          <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">
            Pageluxe · Studio
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-tight">AI Image Generator</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Craft model shots, full-page ads, product still-life, and article hero art with AI.
            Save the ones you like to your library and drop them into any issue from the in-editor panel.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <section>
            <div className="border border-border p-4">
              <GeneratorStudio
                context="standalone"
                brand={null}
                onUseImage={undefined}
              />
              <p className="mt-4 pt-4 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
                Tip: from inside an issue's editor, the same generator appears in the rail — with
                brand-awareness pre-wired to that publication's palette and fonts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              className="mt-3 text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-foreground"
            >
              Refresh library →
            </button>
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-serif">Library</h2>
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                {assets.length} saved
              </span>
            </div>
            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Loading"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-4 w-1/2" /><div className="skeleton h-4 w-3/5" /></div>
            ) : assets.length === 0 ? (
              <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nothing saved yet. Generate something and hit "Save to library".
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {assets.map((a) => (
                  <div key={a.id} className="border border-border bg-card group">
                    <div className="aspect-[3/4] overflow-hidden bg-secondary">
                      {signedUrls[a.id] && (
                        <img
                          src={signedUrls[a.id]}
                          alt={a.prompt.slice(0, 80)}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                        {a.creative_type}
                        {a.brand_applied && <span className="ml-1">· brand</span>}
                      </div>
                      <div className="text-[11px] text-foreground/80 mt-1 line-clamp-2">
                        {a.prompt}
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(a.id)}
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                          title="Copy URL"
                        >
                          <CopyIcon className="h-3.5 w-3.5" />
                        </button>
                        <a
                          href={signedUrls[a.id]}
                          download
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
