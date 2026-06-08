// Best-effort IDML text extraction. IDML is a zip of XML; we only read the
// Stories/Story_*.xml files and pull the `Content` text runs out. This is
// metadata only — we never try to render the IDML visually.
import JSZip from "jszip";

export type IdmlExtract = {
  fileName: string;
  stories: string[]; // each entry is the concatenated text of one Story file
  flat: string;      // all stories joined with double newlines
};

export async function parseIdml(file: File): Promise<IdmlExtract> {
  const zip = await JSZip.loadAsync(file);
  const storyFiles = Object.keys(zip.files).filter(
    (name) => /^Stories\/Story_.*\.xml$/i.test(name),
  );
  const stories: string[] = [];
  for (const name of storyFiles) {
    const xml = await zip.files[name].async("string");
    // Extract everything inside <Content>...</Content>. IDML escapes < > & in
    // text, so the inner is plain text (after unescaping entities).
    const matches = [...xml.matchAll(/<Content>([\s\S]*?)<\/Content>/g)];
    const joined = matches
      .map((m) => unescapeXml(m[1]).trim())
      .filter(Boolean)
      .join(" ");
    if (joined) stories.push(joined);
  }
  return {
    fileName: file.name,
    stories,
    flat: stories.join("\n\n"),
  };
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Heuristic split of IDML stories into editorial fields. */
export function suggestFieldsFromIdml(extract: IdmlExtract): {
  section?: string;
  headline?: string;
  byline?: string;
  body?: string;
} {
  const runs = extract.stories
    .flatMap((s) => s.split(/\n+/))
    .map((s) => s.trim())
    .filter(Boolean);
  if (runs.length === 0) return {};
  // Section: first short ALL-CAPS run.
  const section = runs.find((r) => r.length <= 60 && r === r.toUpperCase() && /[A-Z]/.test(r));
  // Headline: first long-ish run that isn't the section.
  const headline = runs.find((r) => r !== section && r.length >= 12 && r.length <= 140);
  // Byline: line starting with "By "
  const byline = runs.find((r) => /^by\s/i.test(r));
  // Body: longest remaining run.
  const body = [...runs]
    .sort((a, b) => b.length - a.length)
    .find((r) => r !== section && r !== headline && r !== byline && r.length > 200);
  return { section, headline, byline, body };
}
