import { supabase } from "@/integrations/supabase/client";

export interface IssueDraftRecord<T = unknown> {
  issue_id: string;
  publication_id: string | null;
  issue_label: string | null;
  data: T;
  client_updated_at: string; // ISO
  updated_at: string;
}

/**
 * Warn if a doc getting pushed to the cloud is bigger than this. After the
 * base64 → Storage migration this should never fire; when it does it means
 * some embedded image slipped past `migrateBase64Images`.
 */
const DRAFT_SIZE_WARN_BYTES = 1_000_000; // 1 MB

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
  // Size guard: leftover base64 images balloon the JSON payload. Warn loudly
  // so the leak surfaces in the console instead of silently paying the
  // bandwidth + storage cost every autosave tick.
  try {
    const size = JSON.stringify(input.data ?? null).length;
    if (size > DRAFT_SIZE_WARN_BYTES) {
      console.warn(
        `[issueDrafts] Draft for issue ${input.issueId} is ${(size / 1024).toFixed(0)} KB — ` +
          `likely leftover base64 image data escaped migration.`,
      );
    }
  } catch {
    // JSON.stringify shouldn't throw on our own doc shape, but if it does
    // we don't want the guard itself to break the save.
  }
  const payload = {
    user_id: input.userId,
    issue_id: input.issueId,
    publication_id: input.publicationId,
    issue_label: input.issueLabel,
    data: input.data as never,
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
