/**
 * Magazine layout styles — curated presets a user can pick as a starting
 * point, then customize (margins and column widths) and save into a reusable
 * issue template.
 *
 * All measurements are in inches so they compose with the existing
 * `PageMargins` / publication dimensions system.
 */

export type MagazineLayoutStyleKey =
  | "classic-editorial"
  | "modern-minimal"
  | "fashion-bold"
  | "news-grid"
  | "zine-compact"
  | "custom";

export interface MagazineLayoutStyle {
  /** Preset key. "custom" means the user diverged from any preset. */
  key: MagazineLayoutStyleKey;
  /** Short display label. */
  label: string;
  /** Per-edge safe-area margins, in inches. */
  margins: { top: number; right: number; bottom: number; left: number };
  /** Column count for body copy grids (1-6). */
  columns: number;
  /** Gutter (space between columns), in inches. */
  gutter: number;
}

export const MAGAZINE_LAYOUT_STYLES: MagazineLayoutStyle[] = [
  {
    key: "classic-editorial",
    label: "Classic editorial",
    margins: { top: 0.75, right: 0.75, bottom: 0.85, left: 0.75 },
    columns: 3,
    gutter: 0.2,
  },
  {
    key: "modern-minimal",
    label: "Modern minimal",
    margins: { top: 1.0, right: 1.0, bottom: 1.0, left: 1.0 },
    columns: 2,
    gutter: 0.25,
  },
  {
    key: "fashion-bold",
    label: "Fashion bold",
    margins: { top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 },
    columns: 1,
    gutter: 0.15,
  },
  {
    key: "news-grid",
    label: "News grid",
    margins: { top: 0.5, right: 0.5, bottom: 0.6, left: 0.5 },
    columns: 4,
    gutter: 0.15,
  },
  {
    key: "zine-compact",
    label: "Zine compact",
    margins: { top: 0.35, right: 0.35, bottom: 0.35, left: 0.35 },
    columns: 2,
    gutter: 0.12,
  },
];

export const DEFAULT_MAGAZINE_LAYOUT_STYLE: MagazineLayoutStyle =
  MAGAZINE_LAYOUT_STYLES[0];

/** Look up a preset by key. Returns `undefined` for "custom" or unknown. */
export function getMagazineLayoutStyle(
  key: MagazineLayoutStyleKey | string | null | undefined,
): MagazineLayoutStyle | undefined {
  if (!key || key === "custom") return undefined;
  return MAGAZINE_LAYOUT_STYLES.find((s) => s.key === key);
}

/** True when the two styles have identical numeric values (ignoring `key`/`label`). */
export function layoutStyleMatches(
  a: MagazineLayoutStyle,
  b: MagazineLayoutStyle,
): boolean {
  const eps = 1e-4;
  return (
    Math.abs(a.margins.top - b.margins.top) < eps &&
    Math.abs(a.margins.right - b.margins.right) < eps &&
    Math.abs(a.margins.bottom - b.margins.bottom) < eps &&
    Math.abs(a.margins.left - b.margins.left) < eps &&
    Math.abs(a.gutter - b.gutter) < eps &&
    a.columns === b.columns
  );
}
