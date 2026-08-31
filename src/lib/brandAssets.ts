import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";

export const MAX_FONT_BYTES = 5 * 1024 * 1024; // 5 MB

export const FONT_MIME_BY_EXT: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

export const FONT_FORMAT_BY_EXT: Record<string, string> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

export const FONT_ACCEPT_ATTR = ".woff2,.woff,.ttf,.otf";

export type BrandFont = {
  id: string;
  user_id: string;
  publication_id: string;
  family_name: string;
  file_path: string;
  file_name: string;
  format: string;
  weight: number;
  style: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type BrandFontWithUrl = BrandFont & { signedUrl: string | null };

export type BrandSwatch = {
  id: string;
  user_id: string;
  publication_id: string;
  name: string;
  hex: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type FontSlotOverrides = {
  display_font_custom_id: string | null;
  serif_font_custom_id: string | null;
  sans_font_custom_id: string | null;
};

// ------------------------- Fonts -------------------------

export async function listBrandFonts(publicationId: string): Promise<BrandFont[]> {
  const { data, error } = await supabase
    .from("brand_fonts")
    .select("*")
    .eq("publication_id", publicationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BrandFont[];
}

export async function signFontUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(path, 60 * 60 * 6); // 6 h
    if (error) {
      console.warn("[brandAssets] sign url failed", error.message);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    // Network failures (offline, token-refresh in flight) throw instead of
    // returning `{ error }`. Swallow so callers see a null URL rather than an
    // unhandled rejection.
    console.warn("[brandAssets] sign url failed", (e as Error).message);
    return null;
  }
}

function fileExt(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

function deriveFamilyName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Custom Font";
}

const WEIGHT_TOKENS: Array<[RegExp, number]> = [
  [/extra[\s_-]?black|ultra[\s_-]?black/i, 950],
  [/black|heavy|fat/i, 900],
  [/extra[\s_-]?bold|ultra[\s_-]?bold|xbold/i, 800],
  [/semi[\s_-]?bold|demi[\s_-]?bold/i, 600],
  [/bold/i, 700],
  [/medium/i, 500],
  [/extra[\s_-]?light|ultra[\s_-]?light/i, 200],
  [/light/i, 300],
  [/thin|hairline/i, 100],
  [/book|regular|normal|roman/i, 400],
];

/**
 * Best-effort weight/style detection from a font file name (e.g.
 * `SourceSansPro-SemiboldIt.otf` → 600 / italic). Without this every upload
 * lands as 400/normal, which makes the browser synthesize bold + italic on top
 * of faces that already carry them — the classic "my font looks the same"
 * symptom.
 */
export function inferFontMeta(fileName: string): { weight: number; style: string } {
  const base = fileName.replace(/\.[^.]+$/, "");
  const style = /italic|oblique|(?:^|[^a-z])it(?:$|[^a-z])/i.test(base) ? "italic" : "normal";
  let weight = 400;
  for (const [re, w] of WEIGHT_TOKENS) {
    if (re.test(base)) {
      weight = w;
      break;
    }
  }
  return { weight, style };
}

export async function uploadBrandFont(opts: {
  publicationId: string;
  file: File;
  familyName?: string;
  weight?: number;
  style?: string;
}): Promise<BrandFont> {
  const { publicationId, file } = opts;
  if (!publicationId) throw new Error("Select a publication before uploading fonts.");
  if (file.size > MAX_FONT_BYTES) {
    throw new Error(`Font too large (max ${Math.floor(MAX_FONT_BYTES / 1024 / 1024)} MB).`);
  }
  const ext = fileExt(file.name);
  if (!(ext in FONT_FORMAT_BY_EXT)) {
    throw new Error("Unsupported font format. Use WOFF2, WOFF, TTF, or OTF.");
  }

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload fonts.");

  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const path = `${uid}/_fonts/${publicationId}/${Date.now()}-${safe}`;

  const contentType = FONT_MIME_BY_EXT[ext] ?? "application/octet-stream";
  const up = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType });
  if (up.error) throw up.error;

  const insert = await supabase
    .from("brand_fonts")
    .insert({
      user_id: uid,
      publication_id: publicationId,
      family_name: opts.familyName?.trim() || deriveFamilyName(file.name),
      file_path: path,
      file_name: file.name,
      format: FONT_FORMAT_BY_EXT[ext],
      weight: opts.weight ?? inferFontMeta(file.name).weight,
      style: opts.style ?? inferFontMeta(file.name).style,
      size_bytes: file.size,
    })
    .select("*")
    .single();
  if (insert.error) throw insert.error;
  return insert.data as BrandFont;
}

export async function updateBrandFont(
  id: string,
  patch: Partial<Pick<BrandFont, "family_name" | "weight" | "style">>,
): Promise<void> {
  const { error } = await supabase.from("brand_fonts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBrandFont(font: BrandFont): Promise<void> {
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([font.file_path]);
  const { error } = await supabase.from("brand_fonts").delete().eq("id", font.id);
  if (error) throw error;
}

// ------------------------- Slot assignment -------------------------

export async function getFontSlotOverrides(
  publicationId: string,
): Promise<FontSlotOverrides> {
  const { data, error } = await supabase
    .from("publications")
    .select("display_font_custom_id, serif_font_custom_id, sans_font_custom_id")
    .eq("id", publicationId)
    .maybeSingle();
  if (error) throw error;
  return {
    display_font_custom_id: (data?.display_font_custom_id as string | null) ?? null,
    serif_font_custom_id: (data?.serif_font_custom_id as string | null) ?? null,
    sans_font_custom_id: (data?.sans_font_custom_id as string | null) ?? null,
  };
}

export async function setFontSlotOverride(
  publicationId: string,
  slot: "display" | "serif" | "sans",
  fontId: string | null,
): Promise<void> {
  const patch =
    slot === "display"
      ? { display_font_custom_id: fontId }
      : slot === "serif"
        ? { serif_font_custom_id: fontId }
        : { sans_font_custom_id: fontId };
  const { error } = await supabase
    .from("publications")
    .update(patch)
    .eq("id", publicationId);
  if (error) throw error;
}

// ------------------------- Swatches -------------------------

export async function listBrandSwatches(publicationId: string): Promise<BrandSwatch[]> {
  const { data, error } = await supabase
    .from("brand_swatches")
    .select("*")
    .eq("publication_id", publicationId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BrandSwatch[];
}

export async function addBrandSwatch(opts: {
  publicationId: string;
  hex: string;
  name?: string;
}): Promise<BrandSwatch> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to save swatches.");
  const hex = normalizeHex(opts.hex);
  if (!hex) throw new Error("Enter a valid hex color, e.g. #ff8800.");
  const { data, error } = await supabase
    .from("brand_swatches")
    .insert({
      user_id: uid,
      publication_id: opts.publicationId,
      hex,
      name: (opts.name ?? "").slice(0, 40),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BrandSwatch;
}

export async function updateBrandSwatch(
  id: string,
  patch: Partial<Pick<BrandSwatch, "hex" | "name" | "position">>,
): Promise<void> {
  const payload = { ...patch };
  if (payload.hex) {
    const h = normalizeHex(payload.hex);
    if (!h) throw new Error("Enter a valid hex color.");
    payload.hex = h;
  }
  const { error } = await supabase.from("brand_swatches").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteBrandSwatch(id: string): Promise<void> {
  const { error } = await supabase.from("brand_swatches").delete().eq("id", id);
  if (error) throw error;
}

export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    return (
      "#" +
      v
        .split("")
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return "#" + v.toLowerCase();
  if (/^[0-9a-fA-F]{8}$/.test(v)) return "#" + v.toLowerCase();
  return null;
}
