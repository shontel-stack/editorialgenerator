/**
 * Versioned snapshots of an IssueDoc. Lets the editor act like Figma/Canva —
 * manual save-point, browse, restore.
 */
import { supabase } from "@/integrations/supabase/client";
import type { IssueDoc } from "./coverDefaults";

export interface IssueVersionRow {
  id: string;
  user_id: string;
  issue_id: string;
  label: string | null;
  snapshot: IssueDoc;
  created_at: string;
}

export async function listIssueVersions(
  userId: string,
  issueId: string,
): Promise<IssueVersionRow[]> {
  const { data, error } = await supabase
    .from("issue_versions")
    .select("*")
    .eq("user_id", userId)
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as IssueVersionRow[];
}

export async function saveIssueVersion(input: {
  userId: string;
  issueId: string;
  label: string | null;
  snapshot: IssueDoc;
}): Promise<IssueVersionRow> {
  const { data, error } = await supabase
    .from("issue_versions")
    .insert({
      user_id: input.userId,
      issue_id: input.issueId,
      label: input.label,
      snapshot: input.snapshot as never,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as IssueVersionRow;
}

export async function deleteIssueVersion(id: string): Promise<void> {
  const { error } = await supabase.from("issue_versions").delete().eq("id", id);
  if (error) throw error;
}
