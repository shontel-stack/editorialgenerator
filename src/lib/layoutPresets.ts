/**
 * Saved column-tuning presets. Each preset captures a column-width ratio
 * array + gutter (inches), scoped to a specific page layout family so the
 * picker can filter relevant ones for the current page.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeColumnWidths } from "@/lib/pageStatus";
import type { PageLayout } from "@/lib/pageLayouts";

export type LayoutPresetRow = {
  id: string;
  user_id: string;
  name: string;
  layout: PageLayout;
  column_widths: number[];
  gutter_in: number;
  created_at: string;
  updated_at: string;
};

export async function listLayoutPresets(userId: string): Promise<LayoutPresetRow[]> {
  const { data, error } = await supabase
    .from("layout_presets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as unknown as LayoutPresetRow),
    column_widths: normalizeColumnWidths(
      Array.isArray(r.column_widths) ? (r.column_widths as number[]) : [1],
    ),
  }));
}

export async function createLayoutPreset(input: {
  userId: string;
  name: string;
  layout: PageLayout;
  column_widths: number[];
  gutter_in: number;
}): Promise<LayoutPresetRow> {
  const { data, error } = await supabase
    .from("layout_presets")
    .insert({
      user_id: input.userId,
      name: input.name,
      layout: input.layout,
      column_widths: normalizeColumnWidths(input.column_widths),
      gutter_in: input.gutter_in,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as LayoutPresetRow;
}

export async function deleteLayoutPreset(id: string): Promise<void> {
  const { error } = await supabase.from("layout_presets").delete().eq("id", id);
  if (error) throw error;
}
