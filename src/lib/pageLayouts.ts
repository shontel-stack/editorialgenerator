/**
 * Per-page layout templates available in the editor.
 *
 * The chosen layout is persisted on `page_status.layout` for the current
 * (user, issue, page) and feeds:
 *  - the canvas guides (column count for column layouts)
 *  - the Layout dropdown in the canvas ribbon
 *  - the "Page Layout" section in the right-hand edit panel
 *
 * Changing a layout may reflow existing free-form blocks, so the UI shows a
 * confirmation when the page already has custom blocks or position
 * overrides.
 */

export const PAGE_LAYOUTS = [
  "free-form",
  "single-column",
  "two-column",
  "three-column",
  "image-top",
  "image-left",
  "image-right",
  "full-bleed-image",
] as const;

export type PageLayout = (typeof PAGE_LAYOUTS)[number];

export const DEFAULT_PAGE_LAYOUT: PageLayout = "free-form";

export const PAGE_LAYOUT_LABELS: Record<PageLayout, string> = {
  "free-form": "Free-form",
  "single-column": "Single column",
  "two-column": "Two column",
  "three-column": "Three column",
  "image-top": "Image top, text below",
  "image-left": "Image left, text right",
  "image-right": "Image right, text left",
  "full-bleed-image": "Full-bleed image",
};

export const PAGE_LAYOUT_DESCRIPTIONS: Record<PageLayout, string> = {
  "free-form": "No template — place blocks anywhere on the page.",
  "single-column": "One wide column of body content.",
  "two-column": "Two equal columns (classic editorial).",
  "three-column": "Three equal columns (newspaper-style).",
  "image-top": "Hero image across the top, text below.",
  "image-left": "Image on the left half, text on the right.",
  "image-right": "Image on the right half, text on the left.",
  "full-bleed-image": "Image fills the entire page with an optional caption.",
};

/**
 * Number of body-text columns implied by a layout. Used for column guides
 * and the snap-axes calculation.
 */
export const PAGE_LAYOUT_COLUMNS: Record<PageLayout, number> = {
  "free-form": 1,
  "single-column": 1,
  "two-column": 2,
  "three-column": 3,
  "image-top": 1,
  "image-left": 1,
  "image-right": 1,
  "full-bleed-image": 0,
};

export const isPageLayout = (v: unknown): v is PageLayout =>
  typeof v === "string" && (PAGE_LAYOUTS as readonly string[]).includes(v);

export const coercePageLayout = (v: unknown): PageLayout =>
  isPageLayout(v) ? v : DEFAULT_PAGE_LAYOUT;
