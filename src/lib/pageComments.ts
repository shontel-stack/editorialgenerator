/**
 * Page comments — pin notes anchored to a page in an issue. Modelled on
 * Figma/Canva's comment pins.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PageCommentRow {
  id: string;
  user_id: string;
  issue_id: string;
  page_id: string;
  x: number;
  y: number;
  body: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export async function listPageComments(
  userId: string,
  issueId: string,
  pageId: string,
): Promise<PageCommentRow[]> {
  const { data, error } = await supabase
    .from("page_comments")
    .select("*")
    .eq("user_id", userId)
    .eq("issue_id", issueId)
    .eq("page_id", pageId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PageCommentRow[];
}

export async function addPageComment(input: {
  userId: string;
  issueId: string;
  pageId: string;
  x: number;
  y: number;
  body: string;
}): Promise<PageCommentRow> {
  const { data, error } = await supabase
    .from("page_comments")
    .insert({
      user_id: input.userId,
      issue_id: input.issueId,
      page_id: input.pageId,
      x: input.x,
      y: input.y,
      body: input.body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PageCommentRow;
}

export async function setCommentResolved(id: string, resolved: boolean): Promise<void> {
  const { error } = await supabase
    .from("page_comments")
    .update({ resolved })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePageComment(id: string): Promise<void> {
  const { error } = await supabase.from("page_comments").delete().eq("id", id);
  if (error) throw error;
}
