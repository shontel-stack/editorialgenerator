import { z } from "zod";

/** Tool-call payloads returned to the client. The server `execute` for each
 *  tool simply echoes the validated arguments inside `patch`; the chat panel
 *  then applies the patch to the issue state. Keeping all mutation on the
 *  client avoids having to round-trip the entire issue through the server. */

export const ARTICLE_FIELDS = [
  "section",
  "headline",
  "dek",
  "byline",
  "body",
  "pullQuote",
  "imageCaption",
] as const;
export type ArticleField = (typeof ARTICLE_FIELDS)[number];

export const COVER_FIELDS = [
  "masthead",
  "tagline",
  "issue",
  "date",
  "headline",
  "dek",
  "feature",
  "credit",
  "price",
  "qrCaption",
] as const;
export type CoverField = (typeof COVER_FIELDS)[number];

export const PHOTO_FIELDS = ["section", "title", "caption", "credit"] as const;
export const AD_FIELDS = ["eyebrow", "brand", "headline", "body", "cta"] as const;
export const BACK_FIELDS = ["masthead", "quote", "attribution"] as const;
export const CONTENTS_FIELDS = ["issue", "date", "intro"] as const;

export const ARTICLE_LAYOUT_VALUES = [
  "image-top-2col",
  "image-top-3col",
  "image-left-1col",
  "image-left-2col",
  "image-right-1col",
  "image-right-2col",
  "image-bottom-2col",
  "full-image-overlay",
  "text-only-2col",
  "text-only-3col",
] as const;

export const FONT_LABELS = {
  display: [
    "Italiana",
    "Cormorant Garamond",
    "Playfair Display",
    "Cinzel",
    "Bodoni Moda",
    "Marcellus",
    "Abril Fatface",
    "DM Serif Display",
    "Cormorant Infant",
  ],
  serif: [
    "Cormorant Garamond",
    "EB Garamond",
    "Lora",
    "Crimson Pro",
    "Libre Caslon Text",
    "Source Serif 4",
    "Spectral",
    "Playfair Display",
  ],
  sans: [
    "Inter",
    "Work Sans",
    "DM Sans",
    "Jost",
    "Manrope",
    "Archivo",
    "IBM Plex Sans",
    "Outfit",
  ],
} as const;

export const updatePageFieldSchema = z.object({
  pageId: z.string().describe("Target page id from the issue snapshot."),
  field: z.string().describe(
    "Field name. Valid fields depend on pageType: " +
      `article=${ARTICLE_FIELDS.join("|")}; ` +
      `cover=${COVER_FIELDS.join("|")}; ` +
      `photo=${PHOTO_FIELDS.join("|")}; ` +
      `ad=${AD_FIELDS.join("|")}; ` +
      `back=${BACK_FIELDS.join("|")}; ` +
      `contents=${CONTENTS_FIELDS.join("|")}.`,
  ),
  value: z.string().describe("New text value. For body fields, use \\n\\n for paragraph breaks."),
});

export const setArticleLayoutSchema = z.object({
  pageId: z.string(),
  layout: z.enum(ARTICLE_LAYOUT_VALUES),
});

export const updateMasterSchema = z.object({
  publication: z.string().optional(),
  folioTemplate: z.string().optional().describe("Tokens: {publication} {issue} {date}"),
  pageNumberFormat: z.enum(["padded", "plain", "of-total", "none"]).optional(),
  showFolioOnArticles: z.boolean().optional(),
  showFolioOnPhotos: z.boolean().optional(),
  showFolioOnAds: z.boolean().optional(),
});

export const setFontsSchema = z.object({
  display: z.enum(FONT_LABELS.display as unknown as [string, ...string[]]).optional(),
  serif: z.enum(FONT_LABELS.serif as unknown as [string, ...string[]]).optional(),
  sans: z.enum(FONT_LABELS.sans as unknown as [string, ...string[]]).optional(),
});

export const addPageSchema = z.object({
  pageType: z.enum(["article", "photo", "ad", "contents"]),
});

export const addSpreadSchema = z.object({
  left: z.enum(["article", "photo", "ad"]),
  right: z.enum(["article", "photo", "ad"]),
});

export const removePageSchema = z.object({
  pageId: z.string(),
  removeSpread: z.boolean().optional().describe("Also remove the facing page of the spread."),
});

export const reorderPagesSchema = z.object({
  orderedPageIds: z.array(z.string()).describe(
    "Full list of page ids in the desired order. Cover and back will be locked at the ends automatically.",
  ),
});
