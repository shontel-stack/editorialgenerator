/**
 * Publications = top-level workspaces. Each one has its own brand voice,
 * fonts, palette, and masthead. Switching publications changes defaults for
 * new issues and is recorded in `user_settings.active_publication_id`.
 */

import { supabase } from "@/integrations/supabase/client";

export type Publication = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  brand_voice: string | null;
  display_font: string | null;
  body_font: string | null;
  palette_key: string | null;
  masthead: string | null;
  page_width_in: number | null;
  page_height_in: number | null;
  margin_top_in: number | null;
  margin_right_in: number | null;
  margin_bottom_in: number | null;
  margin_left_in: number | null;
  bleed_in: number | null;
  created_at: string;
  updated_at: string;
};

export type PublicationInput = {
  name: string;
  slug?: string;
  tagline?: string;
  brand_voice?: string;
  display_font?: string;
  body_font?: string;
  palette_key?: string;
  masthead?: string;
  page_width_in?: number | null;
  page_height_in?: number | null;
  margin_top_in?: number | null;
  margin_right_in?: number | null;
  margin_bottom_in?: number | null;
  margin_left_in?: number | null;
  bleed_in?: number | null;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `pub-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listPublications(userId: string): Promise<Publication[]> {
  const { data, error } = await supabase
    .from("publications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Publication[];
}

export async function createPublication(
  userId: string,
  input: PublicationInput,
): Promise<Publication> {
  const slug = input.slug ?? slugify(input.name);
  const { data, error } = await supabase
    .from("publications")
    .insert({
      user_id: userId,
      name: input.name,
      slug,
      tagline: input.tagline ?? null,
      brand_voice: input.brand_voice ?? null,
      display_font: input.display_font ?? null,
      body_font: input.body_font ?? null,
      palette_key: input.palette_key ?? null,
      masthead: input.masthead ?? null,
      page_width_in: input.page_width_in ?? null,
      page_height_in: input.page_height_in ?? null,
      margin_top_in: input.margin_top_in ?? null,
      margin_right_in: input.margin_right_in ?? null,
      margin_bottom_in: input.margin_bottom_in ?? null,
      margin_left_in: input.margin_left_in ?? null,
      bleed_in: input.bleed_in ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Publication;
}

export async function updatePublication(
  id: string,
  patch: Partial<PublicationInput>,
): Promise<Publication> {
  const { data, error } = await supabase
    .from("publications")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Publication;
}

export async function deletePublication(id: string): Promise<void> {
  const { error } = await supabase.from("publications").delete().eq("id", id);
  if (error) throw error;
}

export async function getActivePublicationId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("active_publication_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.active_publication_id as string | null) ?? null;
}

export async function setActivePublicationId(
  userId: string,
  publicationId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, active_publication_id: publicationId },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

/** Per-publication "where we left off" — restores the last selected page when
 *  the user reopens that publication. issueId is recorded so we can detect
 *  fresh/different issues and fall back to pageIndex if the saved page id
 *  doesn't exist in the loaded issue. */
export type LastPosition = {
  issueId: string | null;
  pageId: string | null;
  pageIndex: number | null;
};

export async function getLastPositions(
  userId: string,
): Promise<Record<string, LastPosition>> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("last_positions")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const raw = (data as { last_positions?: unknown } | null)?.last_positions;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, LastPosition>;
}

export async function setLastPosition(
  userId: string,
  publicationId: string,
  position: LastPosition,
): Promise<void> {
  const current = await getLastPositions(userId);
  const next = { ...current, [publicationId]: position };
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, last_positions: next },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}
