import { supabase } from "@/integrations/supabase/client";

export interface IssueDraftRecord<T = unknown> {
  issue_id: string;
  publication_id: string | null;
  issue_label: string | null;
  data: T;
  client_updated_at: string; // ISO
  updated_at: string;
}

export async function fetchIssueDraft<T = unknown>(
  issueId: string,
): Promise<IssueDraftRecord<T> | null> {
  const { data, error } = await supabase
    .from("issue_drafts")
    .select("issue_id, publication_id, issue_label, data, client_updated_at, updated_at")
    .eq("issue_id", issueId)
    .maybeSingle();
  if (error) throw error;
  return (data as IssueDraftRecord<T> | null) ?? null;
}

export async function upsertIssueDraft<T = unknown>(input: {
  userId: string;
  issueId: string;
  publicationId: string | null;
  issueLabel: string | null;
  data: T;
  clientUpdatedAt: number; // epoch ms
}): Promise<IssueDraftRecord<T>> {
  const payload = {
    user_id: input.userId,
    issue_id: input.issueId,
    publication_id: input.publicationId,
    issue_label: input.issueLabel,
    data: input.data as unknown as Record<string, unknown>,
    client_updated_at: new Date(input.clientUpdatedAt).toISOString(),
  };
  const { data, error } = await supabase
    .from("issue_drafts")
    .upsert(payload, { onConflict: "user_id,issue_id" })
    .select("issue_id, publication_id, issue_label, data, client_updated_at, updated_at")
    .single();
  if (error) throw error;
  return data as IssueDraftRecord<T>;
}
