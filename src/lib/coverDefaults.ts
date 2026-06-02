// InDesign target: 10.6667 x 14.2222 inches (Pageluxe / The Arts Today)
// At 300 DPI: 3200 x 4267 px. Aspect ratio: 0.75 (3:4).
export const COVER_INCHES = { w: 10.6667, h: 14.2222 };
export const COVER_DPI = 300;
export const COVER_PX = {
  w: Math.round(COVER_INCHES.w * COVER_DPI), // 3200
  h: Math.round(COVER_INCHES.h * COVER_DPI), // 4267
};
export const COVER_RATIO = COVER_INCHES.w / COVER_INCHES.h; // 0.75

export type PageType = "cover" | "contents" | "article" | "photo" | "ad" | "back";

export type Palette = "paper" | "ink" | "burgundy";

export const LOGO_COLORS: { value: string; label: string }[] = [
  { value: "#6b1320", label: "Burgundy" },
  { value: "#0a0a0a", label: "Black" },
  { value: "#ffffff", label: "White" },
];

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
  imageUrl: string | null;
  imageFit: "cover" | "contain";
  imageY: number;
  palette: Palette;
  layout: "classic" | "edge" | "framed";
  logoColor: string;
  qrUrl: string;       // URL the QR encodes (empty = hide QR)
  qrCaption: string;   // small caption below the QR
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

export type AnyPageData =
  | { pageType: "cover"; data: CoverData }
  | { pageType: "contents"; data: ContentsData }
  | { pageType: "article"; data: ArticleData }
  | { pageType: "photo"; data: PhotoData }
  | { pageType: "ad"; data: AdData }
  | { pageType: "back"; data: BackCoverData };

export type IssuePageNode = AnyPageData & {
  id: string;
  includeInContents: boolean;
};

/* --- Master pages — issue-wide folio / page-number defaults --- */

export type PageNumberFormat = "padded" | "plain" | "of-total" | "none";

export const PAGE_NUMBER_FORMATS: { value: PageNumberFormat; label: string }[] = [
  { value: "padded",   label: "Padded (003)" },
  { value: "plain",    label: "Plain (3)" },
  { value: "of-total", label: "Of total (3 / 88)" },
  { value: "none",     label: "Hide page numbers" },
];

export type IssueMaster = {
  // Folio template uses tokens: {publication} {issue} {date}
  folioTemplate: string;
  publication: string;
  pageNumberFormat: PageNumberFormat;
  showFolioOnArticles: boolean;
  showFolioOnPhotos: boolean;
  showFolioOnAds: boolean;
};

export const DEFAULT_MASTER: IssueMaster = {
  folioTemplate: "{publication}  ·  {issue}",
  publication: "THE ARTS TODAY",
  pageNumberFormat: "padded",
  showFolioOnArticles: true,
  showFolioOnPhotos: true,
  showFolioOnAds: false,
};

export type IssueDoc = {
  meta: { issue: string; date: string };
  master: IssueMaster;
  pages: IssuePageNode[];
};

export function renderFolio(master: IssueMaster, meta: IssueDoc["meta"]): string {
  return master.folioTemplate
    .replace(/\{publication\}/g, master.publication)
    .replace(/\{issue\}/g, meta.issue)
    .replace(/\{date\}/g, meta.date);
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

export const DEFAULT_ISSUE: IssueDoc = {
  meta: { issue: DEFAULT_COVER.issue, date: DEFAULT_COVER.date },
  pages: [
    makeNode("cover", DEFAULT_COVER, false),
    makeNode("contents", DEFAULT_CONTENTS, false),
    makeNode("article", DEFAULT_ARTICLE, true),
    makeNode("ad", DEFAULT_AD, false),
    makeNode("photo", DEFAULT_PHOTO, true),
    makeNode("back", DEFAULT_BACK, false),
  ],
};

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
      }
    });
}

/** 1-indexed printable page number for a node, padded to 3 digits. */
export function pageNumberFor(issue: IssueDoc, nodeId: string): string {
  const idx = issue.pages.findIndex((p) => p.id === nodeId);
  const n = idx < 0 ? 0 : idx + 1;
  return n.toString().padStart(3, "0");
}
