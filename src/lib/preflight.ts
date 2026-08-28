/**
 * Preflight — pre-export sanity checks over the whole issue.
 *
 * Pure functions only: given the pages plus page geometry, produce a list of
 * findings. The panel renders them and lets the editor jump to the page.
 */

import type { CustomBlock, IssuePageNode, PageMargins } from "./coverDefaults";

export type PreflightSeverity = "error" | "warning" | "info";

export type PreflightFinding = {
  id: string;
  severity: PreflightSeverity;
  category: string;
  message: string;
  pageId?: string;
  pageLabel?: string;
  blockId?: string;
};

export type PreflightInput = {
  pages: IssuePageNode[];
  /** Page trim size in page-px @ 300 DPI. */
  dim: { w: number; h: number };
  /** Page trim size in inches. */
  inches: { w: number; h: number };
  margins: PageMargins;
  /** Natural pixel size of placed images, keyed by URL (when known). */
  imageSizes?: Record<string, { w: number; h: number } | undefined>;
};

/** Minimum acceptable effective resolution for print. */
export const MIN_PRINT_DPI = 300;
/** Below this we treat it as an outright error rather than a warning. */
export const BAD_PRINT_DPI = 150;

function pageLabel(p: IssuePageNode, index: number): string {
  const d = p.data as { title?: string; headline?: string } | undefined;
  return `p.${index + 1} · ${d?.title ?? d?.headline ?? p.pageType}`;
}

function isBlank(s: unknown): boolean {
  return typeof s !== "string" || s.trim().length === 0;
}

export function runPreflight(input: PreflightInput): PreflightFinding[] {
  const { pages, dim, inches, margins, imageSizes } = input;
  const out: PreflightFinding[] = [];
  const pxPerIn = dim.w / Math.max(0.01, inches.w);
  const safe = {
    left: margins.left * pxPerIn,
    right: dim.w - margins.right * pxPerIn,
    top: margins.top * pxPerIn,
    bottom: dim.h - margins.bottom * pxPerIn,
  };
  const bleed = margins.bleed * pxPerIn;

  if (pages.length === 0) {
    out.push({ id: "doc-empty", severity: "error", category: "Document", message: "The issue has no pages." });
    return out;
  }
  if (pages.length % 4 !== 0) {
    out.push({
      id: "doc-signature",
      severity: "warning",
      category: "Document",
      message: `Page count is ${pages.length}. Saddle-stitch and perfect binding need a multiple of 4 — add ${4 - (pages.length % 4)} page(s) or confirm with your printer.`,
    });
  }

  pages.forEach((p, i) => {
    const label = pageLabel(p, i);
    const blocks: CustomBlock[] = p.customBlocks ?? [];

    blocks.forEach((b) => {
      if (b.hidden) return;
      const base = { pageId: p.id, pageLabel: label, blockId: b.id };
      const name = b.name ?? b.kind;

      // --- Geometry: outside the safe area / off the bleed ---
      const offPage = b.x + b.w < -bleed || b.y + b.h < -bleed || b.x > dim.w + bleed || b.y > dim.h + bleed;
      if (offPage) {
        out.push({ ...base, id: `${p.id}-${b.id}-offpage`, severity: "error", category: "Geometry", message: `“${name}” sits entirely outside the page and will not print.` });
      } else {
        const bleedsOff = b.x < 0 || b.y < 0 || b.x + b.w > dim.w || b.y + b.h > dim.h;
        const reachesBleed = b.x <= -bleed + 1 && b.x + b.w >= dim.w + bleed - 1;
        if (bleedsOff && !reachesBleed && b.kind !== "text") {
          out.push({ ...base, id: `${p.id}-${b.id}-partial-bleed`, severity: "warning", category: "Geometry", message: `“${name}” crosses the trim but stops short of full bleed — extend it past the bleed line or pull it inside the trim.` });
        }
        if (b.kind === "text" && (b.x < safe.left - 1 || b.y < safe.top - 1 || b.x + b.w > safe.right + 1 || b.y + b.h > safe.bottom + 1)) {
          out.push({ ...base, id: `${p.id}-${b.id}-unsafe-text`, severity: "warning", category: "Geometry", message: `Text “${name}” extends outside the safe margin and may be trimmed or lost in the gutter.` });
        }
      }

      // --- Content ---
      if (b.kind === "text") {
        if (isBlank(b.text) && !b.slotBinding) {
          out.push({ ...base, id: `${p.id}-${b.id}-empty-text`, severity: "warning", category: "Content", message: `Text frame “${name}” is empty.` });
        } else if (/lorem ipsum|placeholder|TK\b|XXX/i.test(b.text)) {
          out.push({ ...base, id: `${p.id}-${b.id}-placeholder-text`, severity: "error", category: "Content", message: `“${name}” still contains placeholder copy (lorem ipsum / TK / XXX).` });
        }
        // Crude copyfit estimate: rendered characters vs. frame area.
        const size = b.fontSize ?? 48;
        const lh = (b.lineHeight ?? 1.25) * size;
        const cols = Math.max(1, b.columns ?? 1);
        const charsPerLine = Math.max(1, Math.floor((b.w / cols) / (size * 0.5)));
        const lines = Math.ceil(b.text.length / charsPerLine) + b.text.split("\n").length - 1;
        if (lines * lh > b.h * 1.08) {
          out.push({ ...base, id: `${p.id}-${b.id}-overset`, severity: "error", category: "Copyfit", message: `“${name}” likely has overset text — copy exceeds the frame height.` });
        }
        if ((b.fontSize ?? 48) < 20) {
          out.push({ ...base, id: `${p.id}-${b.id}-tiny-type`, severity: "warning", category: "Typography", message: `“${name}” is set very small (${Math.round((b.fontSize ?? 48) / (pxPerIn / 72))} pt) — hard to read in print.` });
        }
      }

      if (b.kind === "image") {
        if (isBlank(b.imageUrl) && !b.slotBinding) {
          out.push({ ...base, id: `${p.id}-${b.id}-empty-image`, severity: "error", category: "Assets", message: `Image frame “${name}” has no picture placed.` });
        } else if (b.imageUrl.startsWith("data:")) {
          out.push({ ...base, id: `${p.id}-${b.id}-embedded-image`, severity: "warning", category: "Assets", message: `“${name}” is an embedded data image — re-upload it so it syncs to the cloud and exports cleanly.` });
        }
        const nat = imageSizes?.[b.imageUrl];
        if (nat && nat.w > 0 && b.w > 0) {
          const effDpi = Math.round((nat.w / (b.w / pxPerIn)));
          if (effDpi < BAD_PRINT_DPI) {
            out.push({ ...base, id: `${p.id}-${b.id}-lowres`, severity: "error", category: "Resolution", message: `“${name}” is only ${effDpi} DPI at its placed size — far below the ${MIN_PRINT_DPI} DPI print minimum.` });
          } else if (effDpi < MIN_PRINT_DPI) {
            out.push({ ...base, id: `${p.id}-${b.id}-softres`, severity: "warning", category: "Resolution", message: `“${name}” is ${effDpi} DPI at its placed size — under the ${MIN_PRINT_DPI} DPI print target.` });
          }
        }
      }

      if ((b.kind === "embed" || b.kind === "video") && isBlank(b.url)) {
        out.push({ ...base, id: `${p.id}-${b.id}-empty-url`, severity: "warning", category: "Content", message: `“${name}” has no URL set.` });
      }
      if (b.kind === "video") {
        out.push({ ...base, id: `${p.id}-${b.id}-video-print`, severity: "info", category: "Print", message: `“${name}” is a video — it exports as a still poster in print output.` });
      }

      const link = (b as { link?: string }).link;
      if (typeof link === "string" && link.trim() !== "" && !/^(https?:|mailto:|#|\/)/i.test(link.trim())) {
        out.push({ ...base, id: `${p.id}-${b.id}-bad-link`, severity: "warning", category: "Links", message: `“${name}” has a link that isn't a valid URL: ${link}` });
      }
    });

    if (p.backgroundArtwork && p.backgroundArtwork.width > 0) {
      const effDpi = Math.round(p.backgroundArtwork.width / Math.max(0.01, inches.w));
      if (effDpi < BAD_PRINT_DPI) {
        out.push({ pageId: p.id, pageLabel: label, id: `${p.id}-bg-lowres`, severity: "error", category: "Resolution", message: `Page background artwork is only ${effDpi} DPI.` });
      } else if (effDpi < MIN_PRINT_DPI) {
        out.push({ pageId: p.id, pageLabel: label, id: `${p.id}-bg-softres`, severity: "warning", category: "Resolution", message: `Page background artwork is ${effDpi} DPI, under the ${MIN_PRINT_DPI} DPI target.` });
      }
    }
  });

  const order: Record<PreflightSeverity, number> = { error: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function summarize(findings: PreflightFinding[]) {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
  };
}
