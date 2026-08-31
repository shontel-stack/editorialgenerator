/**
 * Ad-hoc web fonts for text blocks.
 *
 * Brand fonts (uploaded files) stay publication-scoped; this catalog covers the
 * one-off cases — an ad or a pull quote that needs a face outside the brand
 * kit. Fonts are pulled from Google Fonts on demand and cached per family.
 */

export type WebFontGroup = { label: string; families: string[] };

/** Curated editorial-friendly catalog, grouped by role. */
export const WEB_FONT_GROUPS: WebFontGroup[] = [
  {
    label: "Serif",
    families: [
      "Playfair Display",
      "Libre Baskerville",
      "Lora",
      "Cormorant Garamond",
      "EB Garamond",
      "Merriweather",
      "Source Serif 4",
      "Instrument Serif",
      "DM Serif Display",
      "Abril Fatface",
    ],
  },
  {
    label: "Sans",
    families: [
      "Inter",
      "Work Sans",
      "DM Sans",
      "Manrope",
      "Space Grotesk",
      "Montserrat",
      "Oswald",
      "Archivo",
      "Barlow Condensed",
      "Bebas Neue",
    ],
  },
  {
    label: "Display & script",
    families: [
      "Anton",
      "Syne",
      "Unbounded",
      "Righteous",
      "Dancing Script",
      "Great Vibes",
      "Pacifico",
      "Caveat",
    ],
  },
  {
    label: "Mono",
    families: ["JetBrains Mono", "Space Mono", "IBM Plex Mono", "Courier Prime"],
  },
];

export const WEB_FONT_FAMILIES: string[] = WEB_FONT_GROUPS.flatMap((g) => g.families);

const loaded = new Set<string>();

function fallbackFor(family: string): string {
  for (const g of WEB_FONT_GROUPS) {
    if (!g.families.includes(family)) continue;
    if (g.label === "Serif") return "serif";
    if (g.label === "Mono") return "monospace";
    return "sans-serif";
  }
  return "sans-serif";
}

/** Inject the Google Fonts stylesheet for `family` once per session. */
export function ensureWebFont(family: string): void {
  if (typeof document === "undefined") return;
  if (!family || loaded.has(family)) return;
  loaded.add(family);
  const href =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(family).replace(/%20/g, "+") +
    ":ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,700&display=swap";
  if (document.querySelector(`link[data-webfont="${CSS.escape(family)}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.webfont = family;
  document.head.appendChild(link);
}

/** CSS `font-family` value for a `web:<Family>` token. */
export function webFontStack(family: string): string {
  ensureWebFont(family);
  return `'${family}', ${fallbackFor(family)}`;
}
