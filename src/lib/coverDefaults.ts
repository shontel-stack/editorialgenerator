// InDesign target: 10.6667 x 14.2222 inches (Pageluxe / The Arts Today)
// At 300 DPI: 3200 x 4267 px. Aspect ratio: 0.75 (3:4).
export const COVER_INCHES = { w: 10.6667, h: 14.2222 };
export const COVER_DPI = 300;
export const COVER_PX = {
  w: Math.round(COVER_INCHES.w * COVER_DPI), // 3200
  h: Math.round(COVER_INCHES.h * COVER_DPI), // 4267
};
export const COVER_RATIO = COVER_INCHES.w / COVER_INCHES.h; // 0.75

export type PageType = "cover" | "feature" | "photo" | "contents";

export type Palette = "ivory" | "ink" | "bone" | "olive";

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
};

export type FeatureData = {
  section: string;        // e.g. "FEATURE  ·  IN CONVERSATION"
  folio: string;          // e.g. "THE ARTS TODAY  ·  VOL. IV  NO. III"
  pageNumber: string;     // e.g. "024"
  headline: string;
  dek: string;
  byline: string;
  body: string;           // long form, paragraphs separated by blank lines
  pullQuote: string;
  dropCap: boolean;
  imageUrl: string | null;
  imageCaption: string;
  imageY: number;
  palette: Palette;
};

export type PhotoData = {
  folio: string;
  pageNumber: string;
  section: string;        // e.g. "PORTFOLIO"
  title: string;
  caption: string;
  credit: string;
  imageUrl: string | null;
  imageFit: "cover" | "contain";
  imageY: number;
  layout: "full-bleed" | "framed" | "split";
  palette: Palette;
};

export type ContentsEntry = {
  section: string;
  title: string;
  byline: string;
  page: string;
  link: PageType | "none"; // interactive target in bundled issue PDF
};

export type ContentsData = {
  folio: string;
  pageNumber: string;
  issue: string;
  date: string;
  intro: string;
  entries: ContentsEntry[];
  palette: Palette;
};

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
  palette: "ivory",
  layout: "classic",
};

export const DEFAULT_FEATURE: FeatureData = {
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
  palette: "ivory",
};

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

export const DEFAULT_CONTENTS: ContentsData = {
  folio: "THE ARTS TODAY",
  pageNumber: "003",
  issue: "VOL. IV  ·  NO. III",
  date: "JUNE MMXXVI",
  intro: "An issue about stillness — what survives the quiet hours of the studio, and what does not.",
  entries: [
    { section: "EDITOR'S NOTE", title: "On the discipline of looking", byline: "Elena Marchetti", page: "008", link: "none" },
    { section: "ATELIER NOTES", title: "Three studios, before noon", byline: "Various", page: "012", link: "none" },
    { section: "IN CONVERSATION", title: "The patient hand — Mira Solano", byline: "Elena Marchetti", page: "024", link: "feature" },
    { section: "ESSAY", title: "After figuration, again", byline: "Idris Okafor", page: "038", link: "none" },
    { section: "PORTFOLIO", title: "Rooms of their own", byline: "Yusuf Adel", page: "048", link: "photo" },
    { section: "DISPATCH", title: "Letters from Lisbon and Mexico City", byline: "Various", page: "066", link: "none" },
    { section: "REVIEWS", title: "Six exhibitions, briefly", byline: "The Editors", page: "078", link: "none" },
    { section: "BACK PAGE", title: "A list of things worth slowing down for", byline: "—", page: "088", link: "none" },
  ],
  palette: "bone",
};

export const PALETTES: Record<
  Palette,
  { bg: string; fg: string; rule: string; muted: string; label: string }
> = {
  ivory: { bg: "#f6f1e7", fg: "#1a1814", rule: "#b48a3c", muted: "#7a6f5c", label: "Ivory" },
  ink:   { bg: "#15130f", fg: "#f1ead8", rule: "#caa25a", muted: "#9b937f", label: "Ink" },
  bone:  { bg: "#ece6d8", fg: "#2a241b", rule: "#8a6a2e", muted: "#6b6151", label: "Bone" },
  olive: { bg: "#373a2c", fg: "#efe8d2", rule: "#cba65a", muted: "#a59f86", label: "Olive" },
};

export const PAGE_LABELS: Record<PageType, string> = {
  cover: "Cover",
  feature: "Feature Article",
  photo: "Photo Essay",
  contents: "Contents",
};
