/**
 * Saved layout templates — full IssueDoc snapshots a user can keep as
 * reusable monthly starting points.
 */
import { supabase } from "@/integrations/supabase/client";
import type { IssueDoc } from "./coverDefaults";

export interface IssueTemplateRow {
  id: string;
  user_id: string;
  publication_id: string | null;
  name: string;
  description: string | null;
  data: IssueDoc;
  created_at: string;
  updated_at: string;
}

export async function listIssueTemplates(userId: string): Promise<IssueTemplateRow[]> {
  const { data, error } = await supabase
    .from("issue_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IssueTemplateRow[];
}

export async function saveIssueTemplate(input: {
  userId: string;
  publicationId: string | null;
  name: string;
  description?: string | null;
  data: IssueDoc;
}): Promise<IssueTemplateRow> {
  const { data, error } = await supabase
    .from("issue_templates")
    .insert({
      user_id: input.userId,
      publication_id: input.publicationId,
      name: input.name,
      description: input.description ?? null,
      data: input.data as never,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as IssueTemplateRow;
}

export async function updateIssueTemplate(
  id: string,
  patch: { name?: string; description?: string | null; data?: IssueDoc },
): Promise<void> {
  const payload: { name?: string; description?: string | null; data?: never } = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.data !== undefined) payload.data = patch.data as never;
  const { error } = await supabase.from("issue_templates").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteIssueTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("issue_templates").delete().eq("id", id);
  if (error) throw error;
}
