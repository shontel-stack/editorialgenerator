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

/** Keep at most this many versions per (user, issue). Older ones are pruned. */
const MAX_VERSIONS_PER_ISSUE = 30;
/** Legacy bloated snapshots (pre-image-storage migration) keep beyond this many. */
const MAX_LEGACY_BASE64_KEEP = 5;

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

/**
 * Delete all but the newest `MAX_VERSIONS_PER_ISSUE` versions for this
 * (user, issue). Runs after every save so the table can't grow unbounded.
 */
async function pruneOldVersions(userId: string, issueId: string): Promise<void> {
  const { data, error } = await supabase
    .from("issue_versions")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[issueVersions] prune list failed", error);
    return;
  }
  const rows = data ?? [];
  if (rows.length <= MAX_VERSIONS_PER_ISSUE) return;
  const stale = rows.slice(MAX_VERSIONS_PER_ISSUE).map((r) => r.id as string);
  if (stale.length === 0) return;
  const { error: delErr } = await supabase.from("issue_versions").delete().in("id", stale);
  if (delErr) console.warn("[issueVersions] prune delete failed", delErr);
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
  // Fire-and-forget prune — never block the save UI on cleanup.
  void pruneOldVersions(input.userId, input.issueId);
  return data as unknown as IssueVersionRow;
}

export async function deleteIssueVersion(id: string): Promise<void> {
  const { error } = await supabase.from("issue_versions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * One-time housekeeping: delete legacy versions that still contain
 * `data:image/...` base64 blobs, keeping only the newest few per issue in
 * case the user needs to recover something. Safe to call on every editor
 * mount — it's cheap when there's nothing bloated to clean up.
 */
export async function cleanupLegacyBase64Versions(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("issue_versions")
    .select("id, issue_id, created_at, snapshot")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[issueVersions] legacy cleanup list failed", error);
    return 0;
  }
  const rows = (data ?? []) as Array<{
    id: string;
    issue_id: string;
    created_at: string;
    snapshot: unknown;
  }>;

  // Group by issue, then find bloated rows past the newest N per issue.
  const byIssue = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byIssue.get(r.issue_id) ?? [];
    list.push(r);
    byIssue.set(r.issue_id, list);
  }

  const toDelete: string[] = [];
  for (const list of byIssue.values()) {
    // rows already sorted newest-first by outer query
    for (let i = MAX_LEGACY_BASE64_KEEP; i < list.length; i++) {
      const row = list[i];
      let serialized: string;
      try {
        serialized = JSON.stringify(row.snapshot);
      } catch {
        continue;
      }
      if (serialized.includes("data:image")) toDelete.push(row.id);
    }
  }

  if (toDelete.length === 0) return 0;
  const { error: delErr } = await supabase
    .from("issue_versions")
    .delete()
    .in("id", toDelete);
  if (delErr) {
    console.warn("[issueVersions] legacy cleanup delete failed", delErr);
    return 0;
  }
  return toDelete.length;
}
