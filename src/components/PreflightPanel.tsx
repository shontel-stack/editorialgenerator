/**
 * Preflight panel — pre-export checks (resolution, copyfit, safe area,
 * placeholders, links) with a jump-to-page action for each finding.
 */

import { useEffect, useMemo, useState } from "react";
import { X, AlertTriangle, AlertOctagon, Info, RefreshCw } from "lucide-react";
import type { IssuePageNode, PageMargins } from "@/lib/coverDefaults";
import { runPreflight, summarize, type PreflightFinding, type PreflightSeverity } from "@/lib/preflight";

type Props = {
  open: boolean;
  onClose: () => void;
  pages: IssuePageNode[];
  dim: { w: number; h: number };
  inches: { w: number; h: number };
  margins: PageMargins;
  onSelectPage?: (pageId: string) => void;
};

const SEV_ICON: Record<PreflightSeverity, typeof Info> = {
  error: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

const SEV_CLASS: Record<PreflightSeverity, string> = {
  error: "text-destructive",
  warning: "text-amber-600",
  info: "text-muted-foreground",
};

/** Measure natural sizes of every placed image so effective DPI is real. */
function useImageSizes(pages: IssuePageNode[], enabled: boolean) {
  const urls = useMemo(() => {
    const set = new Set<string>();
    for (const p of pages) {
      for (const b of p.customBlocks ?? []) {
        if (b.kind === "image" && b.imageUrl && !b.imageUrl.startsWith("data:")) set.add(b.imageUrl);
      }
    }
    return Array.from(set);
  }, [pages]);

  const [sizes, setSizes] = useState<Record<string, { w: number; h: number } | undefined>>({});

  useEffect(() => {
    if (!enabled || urls.length === 0) return;
    let cancelled = false;
    const next: Record<string, { w: number; h: number } | undefined> = {};
    let remaining = urls.length;
    const done = () => {
      remaining -= 1;
      if (remaining === 0 && !cancelled) setSizes(next);
    };
    for (const url of urls) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        next[url] = { w: img.naturalWidth, h: img.naturalHeight };
        done();
      };
      img.onerror = () => done();
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [urls, enabled]);

  return sizes;
}

export function PreflightPanel({ open, onClose, pages, dim, inches, margins, onSelectPage }: Props) {
  const [tick, setTick] = useState(0);
  const imageSizes = useImageSizes(pages, open);
  const findings: PreflightFinding[] = useMemo(
    () => (open ? runPreflight({ pages, dim, inches, margins, imageSizes }) : []),
    // `tick` forces a manual re-run
    [open, pages, dim, inches, margins, imageSizes, tick],
  );
  const counts = summarize(findings);
  const [filter, setFilter] = useState<PreflightSeverity | "all">("all");

  if (!open) return null;
  const visible = filter === "all" ? findings : findings.filter((f) => f.severity === filter);

  return (
    <aside className="fixed right-4 top-24 z-50 w-[380px] max-h-[70vh] overflow-hidden flex flex-col border border-border bg-card shadow-xl rounded-sm">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Preflight</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            title="Re-run checks"
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={14} />
          </button>
          <button type="button" onClick={onClose} aria-label="Close preflight" className="p-1 text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs">
        {(["all", "error", "warning", "info"] as const).map((f) => {
          const n =
            f === "all" ? findings.length : f === "error" ? counts.errors : f === "warning" ? counts.warnings : counts.infos;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded-sm border text-[10px] tracking-[0.2em] uppercase ${
                filter === f ? "bg-foreground text-background border-foreground" : "border-border hover:bg-secondary"
              }`}
            >
              {f === "all" ? "All" : f}
              <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-y-auto flex-1">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">
            {findings.length === 0 ? "No issues found — this issue is clear to export." : "Nothing in this category."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((f) => {
              const Icon = SEV_ICON[f.severity];
              return (
                <li key={f.id} className="px-3 py-2 flex gap-2 items-start">
                  <Icon size={14} className={`mt-0.5 shrink-0 ${SEV_CLASS[f.severity]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-snug">{f.message}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{f.category}</span>
                      {f.pageId && (
                        <button
                          type="button"
                          onClick={() => onSelectPage?.(f.pageId!)}
                          className="text-[10px] tracking-[0.2em] uppercase underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        >
                          {f.pageLabel ?? "Go to page"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
