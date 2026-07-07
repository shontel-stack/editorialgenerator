// Default InDesign target: 10.6667 x 14.2222 inches (Pageluxe / The Arts Today)
// At 300 DPI: 3200 x 4267 px. Aspect ratio: 0.75 (3:4).
// Each publication may override these via `page_width_in` / `page_height_in`
// on the `publications` table — see `getPageDimensions` below.
export const COVER_INCHES = { w: 10.6667, h: 14.2222 };
export const COVER_DPI = 300;
export const COVER_PX = {
  w: Math.round(COVER_INCHES.w * COVER_DPI), // 3200
  h: Math.round(COVER_INCHES.h * COVER_DPI), // 4267
};
export const COVER_RATIO = COVER_INCHES.w / COVER_INCHES.h; // 0.75

export type PageDimensions = {
  inches: { w: number; h: number };
  px: { w: number; h: number };
  ratio: number;
};

export const DEFAULT_PAGE_DIMENSIONS: PageDimensions = {
  inches: { w: COVER_INCHES.w, h: COVER_INCHES.h },
  px: { w: COVER_PX.w, h: COVER_PX.h },
  ratio: COVER_RATIO,
};

/** Per-edge margins (safe area) and uniform bleed (crop), in inches. */
export type PageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  bleed: number;
};

/** Industry-standard defaults: 0.75 in margins, 0.125 in bleed. */
export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 0.75,
  right: 0.75,
  bottom: 0.75,
  left: 0.75,
  bleed: 0.125,
};

/** Curated print presets, in inches. The "custom" entry signals the UI to
 *  reveal width/height inputs and is not a real size on its own. */
export const DIMENSION_PRESETS: { key: string; label: string; w: number; h: number }[] = [
  { key: "pageluxe",  label: "Pageluxe (10.6667 × 14.2222 in)", w: 10.6667, h: 14.2222 },
  { key: "letter",    label: "US Letter (8.5 × 11 in)",         w: 8.5,     h: 11 },
  { key: "legal",     label: "US Legal (8.5 × 14 in)",          w: 8.5,     h: 14 },
  { key: "tabloid",   label: "Tabloid (11 × 17 in)",            w: 11,      h: 17 },
  { key: "a4",        label: "A4 (8.27 × 11.69 in)",            w: 8.2677,  h: 11.6929 },
  { key: "a5",        label: "A5 (5.83 × 8.27 in)",             w: 5.8268,  h: 8.2677 },
  { key: "a3",        label: "A3 (11.69 × 16.54 in)",           w: 11.6929, h: 16.5354 },
  { key: "square",    label: "Square (10 × 10 in)",             w: 10,      h: 10 },
  { key: "magazine",  label: "Magazine (8.375 × 10.875 in)",    w: 8.375,   h: 10.875 },
  { key: "custom",    label: "Custom…",                         w: 0,       h: 0 },
];

/** Convert publication row fields to a full PageDimensions object. */
export function getPageDimensions(
  source: { page_width_in?: number | null; page_height_in?: number | null } | null | undefined,
): PageDimensions {
  const w = source?.page_width_in ?? null;
  const h = source?.page_height_in ?? null;
  if (!w || !h || w <= 0 || h <= 0) return DEFAULT_PAGE_DIMENSIONS;
  return {
    inches: { w, h },
    px: { w: Math.round(w * COVER_DPI), h: Math.round(h * COVER_DPI) },
    ratio: w / h,
  };
}

/** Resolve margin/bleed (in inches) from publication row, with sane defaults. */
export function getPageMargins(
  source:
    | {
        margin_top_in?: number | null;
        margin_right_in?: number | null;
        margin_bottom_in?: number | null;
        margin_left_in?: number | null;
        bleed_in?: number | null;
      }
    | null
    | undefined,
): PageMargins {
  const pick = (v: number | null | undefined, d: number) =>
    typeof v === "number" && isFinite(v) && v >= 0 ? v : d;
  return {
    top: pick(source?.margin_top_in, DEFAULT_PAGE_MARGINS.top),
    right: pick(source?.margin_right_in, DEFAULT_PAGE_MARGINS.right),
    bottom: pick(source?.margin_bottom_in, DEFAULT_PAGE_MARGINS.bottom),
    left: pick(source?.margin_left_in, DEFAULT_PAGE_MARGINS.left),
    bleed: pick(source?.bleed_in, DEFAULT_PAGE_MARGINS.bleed),
  };
}

/** Try to match (w,h) inches to a preset key. Returns "custom" if no match. */
export function matchPresetKey(w: number, h: number): string {
  const eps = 0.01;
  const hit = DIMENSION_PRESETS.find(
    (p) => p.key !== "custom" && Math.abs(p.w - w) < eps && Math.abs(p.h - h) < eps,
  );
  return hit?.key ?? "custom";
}

export type PageType = "cover" | "contents" | "article" | "photo" | "ad" | "back" | "blank" | "custom-contents";

export type Palette = "paper" | "ink" | "burgundy";

export const LOGO_COLORS: { value: string; label: string }[] = [
  { value: "#6b1320", label: "Burgundy" },
  { value: "#0a0a0a", label: "Black" },
  { value: "#ffffff", label: "White" },
];

export type CoverTocEntry = {
  /** Short caption above the page number, e.g. "PORTFOLIO". */
  label: string;
  /** Page-number caption as shown, e.g. "1" or "24". */
  page: string;
  /** Optional link to a page in the same issue (id). Clicking navigates the editor. */
  targetPageId?: string | null;
};

export type CoverData = {
  masthead: string;
  tagline: string;
  issue: string;
  date: string;
  headline: string;
  dek: string;
  feature: string;
  credit: string;
  price: string;
  /** Aligned "featuring" row: one column per entry, page numbers linked to article pages. */
  tocEntries?: CoverTocEntry[];
  imageUrl: string | null;
  imageFit: "cover" | "contain";
  imageY: number;
  palette: Palette;
  layout: "classic" | "edge" | "framed";
  logoColor: string;
  qrUrl: string;       // URL the QR encodes (empty = hide QR)
  qrCaption: string;   // small caption below the QR
  mastheadLogoUrl?: string | null; // if set, replaces the text masthead title
};

export type ArticleLayout =
  | "image-top-2col"
  | "image-top-3col"
  | "image-left-1col"
  | "image-left-2col"
  | "image-right-1col"
  | "image-right-2col"
  | "image-bottom-2col"
  | "full-image-overlay"
  | "text-only-2col"
  | "text-only-3col";

export const ARTICLE_LAYOUTS: { value: ArticleLayout; label: string }[] = [
  { value: "image-top-2col",     label: "Image top · 2 col" },
  { value: "image-top-3col",     label: "Image top · 3 col" },
  { value: "image-left-1col",    label: "Image left · 1 col" },
  { value: "image-left-2col",    label: "Image left · 2 col" },
  { value: "image-right-1col",   label: "Image right · 1 col" },
  { value: "image-right-2col",   label: "Image right · 2 col" },
  { value: "image-bottom-2col",  label: "Image bottom · 2 col" },
  { value: "full-image-overlay", label: "Full image · overlay" },
  { value: "text-only-2col",     label: "Text only · 2 col" },
  { value: "text-only-3col",     label: "Text only · 3 col" },
];

export type ArticleData = {
  section: string;        // e.g. "FEATURE  ·  IN CONVERSATION"
  folio: string;
  pageNumber: string;
  headline: string;
  dek: string;
  byline: string;
  body: string;           // paragraphs separated by blank lines
  pullQuote: string;
  dropCap: boolean;
  imageUrl: string | null;
  imageCaption: string;
  imageY: number;
  palette: Palette;
  layout: ArticleLayout;
  /** When true, this article shows up in custom-contents slot pickers. */
  featuredInContents?: boolean;
};

// Backwards-compatible alias — earlier code referenced FeatureData.
export type FeatureData = ArticleData;

export type PhotoData = {
  folio: string;
  pageNumber: string;
  section: string;
  title: string;
  caption: string;
  credit: string;
  imageUrl: string | null;
  imageFit: "cover" | "contain";
  imageY: number;
  layout: "full-bleed" | "framed" | "split";
  palette: Palette;
};

export type AdData = {
  folio: string;
  pageNumber: string;
  eyebrow: string;        // e.g. "ADVERTISEMENT"
  brand: string;
  headline: string;
  body: string;
  cta: string;
  imageUrl: string | null;
  imageY: number;
  layout: "full-bleed" | "framed" | "split";
  palette: Palette;
  logoColor: string;
};

export type BackCoverData = {
  masthead: string;
  pageNumber: string;
  quote: string;
  attribution: string;
  imageUrl: string | null;
  imageY: number;
  palette: Palette;
  logoColor: string;
};

export type ContentsEntry = {
  section: string;
  title: string;
  byline: string;
  page: string;
  link: string;           // node id of target page, or "none"
};

export type ContentsData = {
  folio: string;
  pageNumber: string;
  issue: string;
  date: string;
  intro: string;
  entries: ContentsEntry[]; // derived at render time from the issue
  palette: Palette;
};

/* --- Issue document — dynamic list of pages --- */

export type BlankData = {
  folio: string;
  pageNumber: string;
  palette: Palette;
};

/**
 * Featured-article slot on a custom-contents page. Authors can either link a
 * slot to a real article page (the slot then auto-fills with that article's
 * headline / byline / page number / lead image) or fill the override fields
 * manually. Overrides always win when present.
 *
 * Blocks on the page reference slots via `slotBinding` (see CustomBlock).
 */
export type ContentsSlotField = "headline" | "byline" | "pageNumber" | "image";

export type ContentsSlot = {
  id: string;
  label: string;
  articlePageId?: string;
  overrides?: {
    headline?: string;
    byline?: string;
    pageNumber?: string;
    imageUrl?: string;
  };
};

export type CustomContentsData = {
  folio: string;
  pageNumber: string;
  palette: Palette;
  slots: ContentsSlot[];
};

export type AnyPageData =
  | { pageType: "cover"; data: CoverData }
  | { pageType: "contents"; data: ContentsData }
  | { pageType: "article"; data: ArticleData }
  | { pageType: "photo"; data: PhotoData }
  | { pageType: "ad"; data: AdData }
  | { pageType: "back"; data: BackCoverData }
  | { pageType: "blank"; data: BlankData }
  | { pageType: "custom-contents"; data: CustomContentsData };

/** Binds a text or image block to one field of a custom-contents slot.
 *  When set, the block renders the resolved slot value (or stays as a
 *  placeholder when the slot is empty). */
export type SlotBinding = {
  slotId: string;
  field: ContentsSlotField;
};

/** Frame shape applied to image blocks via CSS clip-path. */
export type ImageFrameShape = "rect" | "ellipse" | "polygon" | "path";

export type CustomBlock =
  | {
      id: string;
      kind: "text";
      x: number; y: number; w: number; h: number; z?: number; name?: string; hidden?: boolean; groupId?: string;
      text: string;
      fontFamily?: "display" | "serif" | "sans" | string;
      fontSize?: number;
      fontWeight?: number;
      italic?: boolean;
      align?: "left" | "center" | "right" | "justify";
      paragraphAligns?: Array<"left" | "center" | "right" | "justify" | null>;
      paragraphSpaceBefore?: Array<number | null>;
      paragraphSpaceAfter?: Array<number | null>;
      paragraphLineHeight?: Array<number | null>;
      color?: string;
      bg?: string;
      rotate?: number;
      link?: string;
      columns?: number;
      columnGap?: number;
      /** Custom-contents page only — pull text from a slot field. */
      slotBinding?: SlotBinding;
    }
  | {
      id: string;
      kind: "image";
      x: number; y: number; w: number; h: number; z?: number; name?: string; hidden?: boolean; groupId?: string;
      imageUrl: string;
      imageFit?: "cover" | "contain";
      rotate?: number;
      borderWidth?: number;
      borderColor?: string;
      bg?: string;
      link?: string;
      /** Custom-contents page only — pull the image from a slot. */
      slotBinding?: SlotBinding;
      /** Skew in degrees, applied as CSS skew transform. */
      skewX?: number;
      skewY?: number;
      /** Frame shape applied as CSS clip-path. */
      frameShape?: ImageFrameShape;
      /** Corner radius when frameShape === "rect" (page-px). */
      cornerRadius?: number;
      /** Sides for frameShape === "polygon" (3–12). */
      polygonSides?: number;
      /** SVG path-data string for frameShape === "path" (in a 0..100 viewBox). */
      clipPath?: string;
    }
  | {
      id: string;
      kind: "shape";
      x: number; y: number; w: number; h: number; z?: number; name?: string; hidden?: boolean; groupId?: string;
      shape: "rect" | "line" | "ellipse";
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
      opacity?: number;
      rotate?: number;
      link?: string;
    }
  | {
      id: string;
      kind: "embed";
      x: number; y: number; w: number; h: number; z?: number; name?: string; hidden?: boolean; groupId?: string;
      embed: "qr" | "button";
      url: string;
      label?: string;
      color?: string;
      bg?: string;
      rotate?: number;
      link?: string;
    }

  | {
      id: string;
      kind: "video";
      x: number; y: number; w: number; h: number; z?: number; name?: string; hidden?: boolean; groupId?: string;
      url: string;
      autoplay?: boolean;
      muted?: boolean;
      loop?: boolean;
      rotate?: number;
      link?: string;
      /** Optional thumbnail shown before playback (HTML video poster). */
      poster?: string;
      /** Default volume 0..1 (ignored while muted). */
      volume?: number;
      /** Show native player controls. */
      controls?: boolean;
      /** Inline playback on iOS rather than fullscreen takeover. */
      playsInline?: boolean;
      /** How aggressively the browser preloads the source. */
      preload?: "none" | "metadata" | "auto";
    };

export type IssuePageNode = AnyPageData & {
  id: string;
  includeInContents: boolean;
  /** Per-block pixel offsets (intrinsic 3200x4267 space). Set by drag-to-reposition. */
  positionOverrides?: Record<string, { dx: number; dy: number }>;
  /** Per-block CSS transform scale applied to the block's contents (1 = default). */
  textScales?: Record<string, number>;
  /** Per-block link URL — block becomes an anchor in preview / export. */
  blockLinks?: Record<string, string>;
  /** Free-form blocks added on top of the template (text/image/shape/embed). */
  customBlocks?: CustomBlock[];
  /** Per-page override for snap settings (rotation angles, tolerances). When
   *  any field is set, it wins over the global user setting for this page. */
  snapOverride?: {
    edgeTolerancePx?: number;
    rotationTolerance?: number;
    rotationAngles?: number[];
  };
  /**
   * Number of *unprinted* physical sheets that occupy positions immediately
   * before this page (e.g. a tip-in insert, a blank divider, or a folded
   * outsert that lives in the bound copy but carries no folio). Used to
   * keep verso/recto parity aligned with the physical sheet position
   * instead of the array index. Default 0.
   */
  paritySkip?: number;
  /** Hide the running header (folio + rule) on this page in both preview and export. */
  hideFolio?: boolean;
  /** Uploaded artwork used as the page background (PDF page raster or image).
   *  In "replace" mode, the template renderer is skipped and only custom blocks
   *  render on top. In "overlay" mode, template + blocks render over the art. */
  backgroundArtwork?: {
    url: string;
    sourceKind: "pdf" | "image" | "idml+pdf";
    sourcePath?: string;      // storage path of rendered PNG (for deletion)
    sourceFileName?: string;  // original upload filename for UI display
    pdfPageIndex?: number;    // 1-based, when from PDF
    crop?: "left" | "right" | "full"; // when one PDF page is split across a spread
    mode: "overlay" | "replace";
    width: number;
    height: number;
  };
};


/* --- Master pages — issue-wide folio / page-number defaults --- */

export type PageNumberFormat = "padded" | "plain" | "of-total" | "none";

export const PAGE_NUMBER_FORMATS: { value: PageNumberFormat; label: string }[] = [
  { value: "padded",   label: "Padded (003)" },
  { value: "plain",    label: "Plain (3)" },
  { value: "of-total", label: "Of total (3 / 88)" },
  { value: "none",     label: "Hide page numbers" },
];

export type IssueFonts = {
  display: string; // CSS font-family stack for headlines / masthead
  serif: string;   // CSS font-family stack for body / editorial copy
  sans: string;    // CSS font-family stack for labels / folio / UI bits
};

/** Curated Google Fonts, grouped by role. `family` is the Google Fonts name
 *  (spaces as `+`); `stack` is the CSS font-family value to apply. */
export type FontOption = { label: string; family: string; stack: string };

export const DISPLAY_FONTS: FontOption[] = [
  { label: "Italiana",           family: "Italiana",            stack: `"Italiana", "Cormorant Garamond", serif` },
  { label: "Cormorant Garamond", family: "Cormorant+Garamond",  stack: `"Cormorant Garamond", Georgia, serif` },
  { label: "Playfair Display",   family: "Playfair+Display",    stack: `"Playfair Display", Georgia, serif` },
  { label: "Cinzel",             family: "Cinzel",              stack: `"Cinzel", "Trajan Pro", serif` },
  { label: "Bodoni Moda",        family: "Bodoni+Moda",         stack: `"Bodoni Moda", "Didot", serif` },
  { label: "Marcellus",          family: "Marcellus",           stack: `"Marcellus", "Trajan Pro", serif` },
  { label: "Abril Fatface",      family: "Abril+Fatface",       stack: `"Abril Fatface", Georgia, serif` },
  { label: "DM Serif Display",   family: "DM+Serif+Display",    stack: `"DM Serif Display", Georgia, serif` },
  { label: "Cormorant Infant",   family: "Cormorant+Infant",    stack: `"Cormorant Infant", Georgia, serif` },
];

export const SERIF_FONTS: FontOption[] = [
  { label: "Cormorant Garamond", family: "Cormorant+Garamond",  stack: `"Cormorant Garamond", Georgia, serif` },
  { label: "EB Garamond",        family: "EB+Garamond",         stack: `"EB Garamond", Georgia, serif` },
  { label: "Lora",               family: "Lora",                stack: `"Lora", Georgia, serif` },
  { label: "Crimson Pro",        family: "Crimson+Pro",         stack: `"Crimson Pro", Georgia, serif` },
  { label: "Libre Caslon Text",  family: "Libre+Caslon+Text",   stack: `"Libre Caslon Text", Georgia, serif` },
  { label: "Source Serif 4",     family: "Source+Serif+4",      stack: `"Source Serif 4", Georgia, serif` },
  { label: "Spectral",           family: "Spectral",            stack: `"Spectral", Georgia, serif` },
  { label: "Playfair Display",   family: "Playfair+Display",    stack: `"Playfair Display", Georgia, serif` },
];

export const SANS_FONTS: FontOption[] = [
  { label: "Inter",         family: "Inter",         stack: `"Inter", system-ui, sans-serif` },
  { label: "Work Sans",     family: "Work+Sans",     stack: `"Work Sans", system-ui, sans-serif` },
  { label: "DM Sans",       family: "DM+Sans",       stack: `"DM Sans", system-ui, sans-serif` },
  { label: "Jost",          family: "Jost",          stack: `"Jost", system-ui, sans-serif` },
  { label: "Manrope",       family: "Manrope",       stack: `"Manrope", system-ui, sans-serif` },
  { label: "Archivo",       family: "Archivo",       stack: `"Archivo", system-ui, sans-serif` },
  { label: "IBM Plex Sans", family: "IBM+Plex+Sans", stack: `"IBM Plex Sans", system-ui, sans-serif` },
  { label: "Outfit",        family: "Outfit",        stack: `"Outfit", system-ui, sans-serif` },
];

export const DEFAULT_FONTS: IssueFonts = {
  display: DISPLAY_FONTS[0].stack,
  serif:   SERIF_FONTS[0].stack,
  sans:    SANS_FONTS[0].stack,
};

/** Build a single Google Fonts URL that loads the three chosen families with
 *  weights covering headings, body, italics, and UI labels. */
export function googleFontsUrl(fonts: IssueFonts): string {
  const families = new Set<string>();
  const all = [...DISPLAY_FONTS, ...SERIF_FONTS, ...SANS_FONTS];
  for (const stack of [fonts.display, fonts.serif, fonts.sans]) {
    const opt = all.find((o) => o.stack === stack);
    if (opt) families.add(opt.family);
  }
  if (!families.size) return "";
  const params = Array.from(families)
    .map((f) => `family=${f}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/**
 * Folio template per side of the spread. Verso = left-hand page, recto =
 * right-hand page. Editors typically put the page number on the outer
 * corner of one side and a copyright / publication line on the other.
 */
export type FolioTemplate = {
  left: string;
  right: string;
};

export type IssueMaster = {
  // Folio template uses tokens: {publication} {issue} {date} {copyright}
  folioTemplate: FolioTemplate;
  publication: string;
  pageNumberFormat: PageNumberFormat;
  showFolioOnArticles: boolean;
  showFolioOnPhotos: boolean;
  showFolioOnAds: boolean;
  fonts: IssueFonts;
};

export const DEFAULT_MASTER: IssueMaster = {
  folioTemplate: {
    left: "{publication}  ·  {issue}",
    right: "© {copyright}",
  },
  publication: "THE ARTS TODAY",
  pageNumberFormat: "padded",
  showFolioOnArticles: true,
  showFolioOnPhotos: true,
  showFolioOnAds: false,
  fonts: DEFAULT_FONTS,
};

export type IssueDoc = {
  meta: {
    issue: string;
    date: string;
    issueId: string;
    /** Optional magazine layout style (preset + margins + columns). */
    layoutStyle?: import("./magazineLayoutStyles").MagazineLayoutStyle;
  };
  master: IssueMaster;
  pages: IssuePageNode[];
};

/**
 * Tolerantly coerce a stored folio template (legacy drafts may hold a single
 * string, or an object missing one side) into a complete `FolioTemplate`.
 */
export function normalizeFolioTemplate(v: unknown): FolioTemplate {
  if (typeof v === "string") return { left: v, right: v };
  if (v && typeof v === "object") {
    const o = v as { left?: unknown; right?: unknown };
    const left = typeof o.left === "string" ? o.left : "";
    const right = typeof o.right === "string" ? o.right : left;
    return { left, right };
  }
  return { left: "", right: "" };
}

/**
 * Page-side parity. Page 1 (cover, index 0) is a right-hand (recto) page;
 * sides alternate from there. Matches the spread-pairing convention used by
 * the canvas (cover stands alone, then 2-3, 4-5, ...).
 */
export function folioSideForIndex(index0Based: number): "left" | "right" {
  return index0Based % 2 === 0 ? "right" : "left";
}

/**
 * Hard cap on per-page `paritySkip`. Real publications almost never need
 * more than a handful of unprinted inserts in front of a single page;
 * clamping prevents a stray input (or malicious draft) from producing an
 * absurd physical-index drift that would break the canvas and exports.
 */
export const MAX_PARITY_SKIP = 16;

/**
 * Coerce any incoming value into a safe integer in `[0, MAX_PARITY_SKIP]`.
 * Rejects negatives, NaN, Infinity, and non-finite numbers. Returns 0 for
 * anything that can't be parsed — never throws so the renderer stays
 * resilient to legacy/corrupt data.
 */
export function normalizeParitySkip(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_PARITY_SKIP, Math.floor(n));
}

/**
 * Compute the *physical* 0-based sheet index for each page in `pages`,
 * accounting for `paritySkip` (unprinted inserts that occupy a sheet but
 * carry no printed page). The returned array has the same length as
 * `pages`; `result[i]` is the physical position of the i-th printed page.
 *
 * Example: pages [cover, article, insert(skip=1), article]
 *   →     phys [0,     1,       3,                4]
 *   →    side [right, left,    left,              right]
 *
 * Use this in concert with `folioSideForIndex` whenever a renderer needs
 * verso/recto parity to follow the physical layout.
 */
export function computePhysicalIndices(pages: { paritySkip?: number }[]): number[] {
  const out: number[] = new Array(pages.length);
  let shift = 0;
  for (let i = 0; i < pages.length; i++) {
    shift += normalizeParitySkip(pages[i].paritySkip);
    out[i] = i + shift;
  }
  return out;
}

/**
 * Render the folio string for a single page. The `side` argument picks the
 * verso (left) or recto (right) template; defaults to "right" so legacy
 * call sites keep working.
 */
export function renderFolio(
  master: IssueMaster,
  meta: IssueDoc["meta"],
  side: "left" | "right" = "right",
): string {
  const tpl = normalizeFolioTemplate(master.folioTemplate);
  const raw = side === "left" ? tpl.left : tpl.right;
  // Derive {copyright} as "<year> <publication>". Year parsed from
  // meta.date when present, otherwise the current year.
  const yearMatch = meta.date.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : String(new Date().getFullYear());
  const copyright = `${year} ${master.publication}`.trim();
  return raw
    .replace(/\{publication\}/g, master.publication)
    .replace(/\{issue\}/g, meta.issue)
    .replace(/\{date\}/g, meta.date)
    .replace(/\{copyright\}/g, copyright);
}

export function formatPageNumber(
  master: IssueMaster,
  index1Based: number,
  total: number,
): string {
  switch (master.pageNumberFormat) {
    case "none":     return "";
    case "plain":    return String(index1Based);
    case "of-total": return `${index1Based} / ${total}`;
    case "padded":
    default:         return index1Based.toString().padStart(3, "0");
  }
}

export const PAGE_LABELS: Record<PageType, string> = {
  cover: "Cover",
  contents: "Contents",
  article: "Article",
  photo: "Photo Essay",
  ad: "Advertisement",
  back: "Back Cover",
  blank: "Blank (footer only)",
  "custom-contents": "Custom contents",
};

export const PALETTES: Record<
  Palette,
  { bg: string; fg: string; rule: string; muted: string; label: string }
> = {
  paper:    { bg: "#ffffff", fg: "#0a0a0a", rule: "#6b1320", muted: "#666666", label: "White" },
  ink:      { bg: "#0a0a0a", fg: "#ffffff", rule: "#6b1320", muted: "#8a8a8a", label: "Black" },
  burgundy: { bg: "#6b1320", fg: "#ffffff", rule: "#ffffff", muted: "#e8c8cc", label: "Burgundy" },
};

/* --- Defaults --- */

export const DEFAULT_COVER: CoverData = {
  masthead: "The Arts Today",
  tagline: "An ezine of contemporary art & culture",
  issue: "VOL. IV · NO. III",
  date: "JUNE MMXXVI",
  headline: "Quiet Light",
  dek: "On stillness, the studio, and the slow return of figurative painting.",
  feature: "FEATURING ·  ATELIER NOTES  ·  PORTFOLIO  ·  IN CONVERSATION",
  credit: "Cover: Untitled, 2026 — courtesy of the artist",
  price: "ISSUE №03",
  tocEntries: [
    { label: "FEATURING",      page: "1", targetPageId: null },
    { label: "ATELIER NOTES",  page: "2", targetPageId: null },
    { label: "PORTFOLIO",      page: "3", targetPageId: null },
    { label: "IN CONVERSATION", page: "4", targetPageId: null },
  ],
  imageUrl: null,
  imageFit: "cover",
  imageY: 50,
  palette: "paper",
  layout: "classic",
  logoColor: "#6b1320",
  qrUrl: "https://theartstoday.com/issues/vol-iv-no-iii",
  qrCaption: "SCAN · READ ONLINE",
};

export const DEFAULT_ARTICLE: ArticleData = {
  section: "FEATURE  ·  IN CONVERSATION",
  folio: "THE ARTS TODAY  ·  VOL. IV  NO. III",
  pageNumber: "024",
  headline: "The Patient Hand",
  dek: "A long conversation with painter Mira Solano on slowness, repetition, and the studio as a moral space.",
  byline: "By Elena Marchetti  ·  Photographs by Yusuf Adel",
  body: `There is a particular quiet in Mira Solano's studio that you notice before anything else. The light falls in long bars across the floor, and the canvases — there are perhaps a dozen leaning against the walls — seem to be waiting for something only she can hear.

We had agreed to meet at noon, but I arrived early and she did not mind. She made coffee in the small kitchen at the back, and we talked for a while about nothing in particular: the weather, the noise of the street, an exhibition we had both recently seen.

When the conversation finally turned to her work, she spoke slowly, weighing each sentence, as though she were placing brushstrokes. "I have learned," she said, "that the things I am most certain of are usually the things I have not yet looked at closely enough."

Her recent paintings — quiet interiors, half-lit figures, a recurring window — have a stillness that resists summary. They reward the kind of attention most of us no longer give to anything.`,
  pullQuote: "“The things I am most certain of are usually the things I have not yet looked at closely enough.”",
  dropCap: true,
  imageUrl: null,
  imageCaption: "Mira Solano in her studio, May 2026.",
  imageY: 50,
  palette: "paper",
  layout: "image-top-2col",
};

// Backwards-compatible alias.
export const DEFAULT_FEATURE = DEFAULT_ARTICLE;

export const DEFAULT_PHOTO: PhotoData = {
  folio: "THE ARTS TODAY  ·  VOL. IV  NO. III",
  pageNumber: "048",
  section: "PORTFOLIO",
  title: "Rooms of Their Own",
  caption: "From the series Rooms of Their Own, 2024–2026. Twelve photographs of artists' studios after hours, made over eighteen months in four cities.",
  credit: "Photographs · Yusuf Adel",
  imageUrl: null,
  imageFit: "cover",
  imageY: 50,
  layout: "full-bleed",
  palette: "ink",
};

export const DEFAULT_AD: AdData = {
  folio: "THE ARTS TODAY",
  pageNumber: "036",
  eyebrow: "ADVERTISEMENT",
  brand: "Maison Léa",
  headline: "Quiet objects for quiet rooms.",
  body: "A small atelier in the south making lamps, vessels, and linen by hand. Limited editions, available through select galleries.",
  cta: "maisonlea.com",
  imageUrl: null,
  imageY: 50,
  layout: "split",
  palette: "ink",
  logoColor: "#6b1320",
};

export const DEFAULT_BACK: BackCoverData = {
  masthead: "The Arts Today",
  pageNumber: "088",
  quote: "To look slowly is the only honest way to look.",
  attribution: "— Mira Solano, in this issue",
  imageUrl: null,
  imageY: 50,
  palette: "ink",
  logoColor: "#6b1320",
};

export const DEFAULT_CONTENTS: ContentsData = {
  folio: "THE ARTS TODAY",
  pageNumber: "003",
  issue: "VOL. IV  ·  NO. III",
  date: "JUNE MMXXVI",
  intro: "An issue about stillness — what survives the quiet hours of the studio, and what does not.",
  entries: [],
  palette: "paper",
};

export const DEFAULT_BLANK: BlankData = {
  folio: "THE ARTS TODAY",
  pageNumber: "000",
  palette: "paper",
};

export const DEFAULT_CUSTOM_CONTENTS: CustomContentsData = {
  folio: "THE ARTS TODAY",
  pageNumber: "005",
  palette: "paper",
  slots: [
    { id: "s1", label: "Feature 1" },
    { id: "s2", label: "Feature 2" },
    { id: "s3", label: "Feature 3" },
  ],
};

/* --- Helpers --- */

let _seq = 0;
export function newId(): string {
  // crypto.randomUUID isn't in every runtime; this is plenty unique per session.
  _seq += 1;
  return `p_${Date.now().toString(36)}_${_seq.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeNode<T extends AnyPageData["pageType"]>(
  pageType: T,
  data: Extract<AnyPageData, { pageType: T }>["data"],
  includeInContents = true,
): IssuePageNode {
  return { id: newId(), pageType, data, includeInContents } as IssuePageNode;
}

/** Stable, randomly-generated issue id; works in browsers and edge runtimes. */
export function newIssueId(): string {
  const g = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (g?.randomUUID) return g.randomUUID();
  return `iss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a fresh default issue with a unique chat id. */
export function makeDefaultIssue(): IssueDoc {
  return {
    meta: { issue: DEFAULT_COVER.issue, date: DEFAULT_COVER.date, issueId: newIssueId() },
    master: DEFAULT_MASTER,
    pages: [
      makeNode("cover", DEFAULT_COVER, false),
      makeNode("contents", DEFAULT_CONTENTS, false),
      makeNode("article", DEFAULT_ARTICLE, true),
      makeNode("ad", DEFAULT_AD, false),
      makeNode("photo", DEFAULT_PHOTO, true),
      makeNode("back", DEFAULT_BACK, false),
    ],
  };
}

/** @deprecated use makeDefaultIssue() so each session gets its own chat id. */
export const DEFAULT_ISSUE: IssueDoc = makeDefaultIssue();

/**
 * Derive a Contents page's entries from the surrounding issue. Each entry
 * carries the *node id* of its target so the interactive PDF exporter can
 * wire up cross-page links by id rather than by page type.
 */
export function deriveContentsEntries(issue: IssueDoc): ContentsEntry[] {
  return issue.pages
    .filter((p) => p.includeInContents)
    .map((p) => {
      const pageNum = pageNumberFor(issue, p.id);
      switch (p.pageType) {
        case "article":
          return {
            section: p.data.section,
            title: p.data.headline,
            byline: p.data.byline,
            page: pageNum,
            link: p.id,
          };
        case "photo":
          return {
            section: p.data.section,
            title: p.data.title,
            byline: p.data.credit,
            page: pageNum,
            link: p.id,
          };
        case "ad":
          return {
            section: p.data.eyebrow,
            title: p.data.brand,
            byline: p.data.headline,
            page: pageNum,
            link: p.id,
          };
        case "cover":
          return { section: "COVER", title: p.data.headline, byline: "—", page: pageNum, link: p.id };
        case "back":
          return { section: "BACK", title: p.data.quote, byline: "—", page: pageNum, link: p.id };
        case "contents":
          return { section: "CONTENTS", title: "Inside this issue", byline: "—", page: pageNum, link: p.id };
        case "blank":
          return { section: "", title: "", byline: "", page: pageNum, link: p.id };
        case "custom-contents":
          return { section: "", title: "", byline: "", page: pageNum, link: p.id };
      }
    });
}

/** Resolve a slot's effective values for rendering. Overrides win over the
 *  linked article's fields. Returns empty strings when nothing is set. */
export function resolveContentsSlot(
  issue: IssueDoc,
  slot: ContentsSlot,
): { headline: string; byline: string; pageNumber: string; imageUrl: string } {
  const linked = slot.articlePageId
    ? issue.pages.find((p) => p.id === slot.articlePageId)
    : undefined;
  const art =
    linked && linked.pageType === "article" ? (linked.data as ArticleData) : null;
  const o = slot.overrides ?? {};
  return {
    headline: o.headline ?? art?.headline ?? "",
    byline: o.byline ?? art?.byline ?? "",
    pageNumber: o.pageNumber ?? (linked ? pageNumberFor(issue, linked.id) : ""),
    imageUrl: o.imageUrl ?? art?.imageUrl ?? "",
  };
}

/** 1-indexed printable page number for a node, padded to 3 digits. */
export function pageNumberFor(issue: IssueDoc, nodeId: string): string {
  const idx = issue.pages.findIndex((p) => p.id === nodeId);
  const n = idx < 0 ? 0 : idx + 1;
  return n.toString().padStart(3, "0");
}

/**
 * Token context passed through the LayoutEdit provider so free-form text
 * blocks placed as headers/footers can show live page numbers, section
 * names, publication metadata, etc. — and stay accurate as pages are
 * reordered or the master is edited.
 */
export type TokenContext = {
  page: number;        // 1-indexed page number in this issue
  pages: number;       // total pages in this issue
  pageLabel: string;   // formatted per master.pageNumberFormat
  publication: string;
  issue: string;
  date: string;
  copyright: string;
  section: string;     // section/title if the page has one, else page type
};

/** Build a TokenContext for one page given the full issue doc. */
export function buildTokenContext(doc: IssueDoc, pageId: string): TokenContext {
  const idx = doc.pages.findIndex((p) => p.id === pageId);
  const page = idx < 0 ? 1 : idx + 1;
  const total = doc.pages.length;
  const pageLabel = formatPageNumber(doc.master, page, total);
  const yearMatch = doc.meta.date.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : String(new Date().getFullYear());
  const copyright = `${year} ${doc.master.publication}`.trim();
  const node = idx >= 0 ? doc.pages[idx] : undefined;
  const d = (node?.data ?? {}) as { section?: string; title?: string; headline?: string };
  const section = d.section || d.title || d.headline || (node ? PAGE_LABELS[node.pageType] : "");
  return {
    page,
    pages: total,
    pageLabel,
    publication: doc.master.publication,
    issue: doc.meta.issue,
    date: doc.meta.date,
    copyright,
    section,
  };
}

/**
 * Substitute supported tokens in a text string. Tokens use curly braces so
 * they survive copy/paste round-trips and don't collide with regular text:
 *   {page} {pages} {page#} {publication} {issue} {date} {copyright} {section}
 */
export function resolveTextTokens(text: string, ctx: TokenContext): string {
  if (!text || text.indexOf("{") === -1) return text;
  return text
    .replace(/\{page#\}/g, ctx.pageLabel)
    .replace(/\{page\}/g, String(ctx.page))
    .replace(/\{pages\}/g, String(ctx.pages))
    .replace(/\{publication\}/g, ctx.publication)
    .replace(/\{issue\}/g, ctx.issue)
    .replace(/\{date\}/g, ctx.date)
    .replace(/\{copyright\}/g, ctx.copyright)
    .replace(/\{section\}/g, ctx.section);
}

export const TOKEN_PRESETS: { label: string; token: string }[] = [
  { label: "Page #", token: "{page#}" },
  { label: "Page", token: "{page}" },
  { label: "Of total", token: "{page} / {pages}" },
  { label: "Section", token: "{section}" },
  { label: "Publication", token: "{publication}" },
  { label: "Issue", token: "{issue}" },
  { label: "Date", token: "{date}" },
  { label: "Copyright", token: "© {copyright}" },
];

