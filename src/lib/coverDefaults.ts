// InDesign target: 10.6667 x 14.2222 inches (Pageluxe / The Arts Today)
// At 300 DPI: 3200 x 4267 px. Aspect ratio: 0.75 (3:4).
export const COVER_INCHES = { w: 10.6667, h: 14.2222 };
export const COVER_DPI = 300;
export const COVER_PX = {
  w: Math.round(COVER_INCHES.w * COVER_DPI), // 3200
  h: Math.round(COVER_INCHES.h * COVER_DPI), // 4267
};
export const COVER_RATIO = COVER_INCHES.w / COVER_INCHES.h; // 0.75

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
  imageY: number; // 0–100 vertical focal
  palette: "ivory" | "ink" | "bone" | "olive";
  layout: "classic" | "edge" | "framed";
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

export const PALETTES: Record<
  CoverData["palette"],
  { bg: string; fg: string; rule: string; muted: string; label: string }
> = {
  ivory: { bg: "#f6f1e7", fg: "#1a1814", rule: "#b48a3c", muted: "#7a6f5c", label: "Ivory" },
  ink:   { bg: "#15130f", fg: "#f1ead8", rule: "#caa25a", muted: "#9b937f", label: "Ink" },
  bone:  { bg: "#ece6d8", fg: "#2a241b", rule: "#8a6a2e", muted: "#6b6151", label: "Bone" },
  olive: { bg: "#373a2c", fg: "#efe8d2", rule: "#cba65a", muted: "#a59f86", label: "Olive" },
};
