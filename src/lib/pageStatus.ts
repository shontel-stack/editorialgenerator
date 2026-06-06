/**
 * Production status for an issue's pages.
 * Each row in `page_status` is keyed by (user_id, issue_id, page_id).
 */

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PAGE_LAYOUT, type PageLayout } from "@/lib/pageLayouts";

export const PAGE_STATUSES = [
  "idea",
  "writing",
  "editing",
  "review",
  "approved",
  "published",
  "archived",
] as const;

export type PageStatusValue = (typeof PAGE_STATUSES)[number];

export const STATUS_LABELS: Record<PageStatusValue, string> = {
  idea: "Idea",
  writing: "Writing",
  editing: "Editing",
  review: "Review",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
};

export const STATUS_TONES: Record<PageStatusValue, string> = {
  idea: "bg-muted text-muted-foreground",
  writing: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  editing: "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200",
  review: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200",
  approved: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  published: "bg-foreground text-background",
  archived: "bg-secondary text-muted-foreground line-through",
};

export type PageStatusRow = {
  id: string;
  user_id: string;
  publication_id: string | null;
  issue_id: string;
  page_id: string;
  page_label: string | null;
  status: PageStatusValue;
  assignee_role: string | null;
  due_date: string | null;
  notes: string | null;
  position: number;
  layout: PageLayout;
  column_widths: number[] | null;
  gutter_in: number | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_GUTTER_IN = 0.167;

/** Even-split column ratios summing to 1 for the given count. */
export function evenColumnWidths(count: number): number[] {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, () => 1 / n);
}

/** Normalize an arbitrary array of positive numbers to ratios summing to 1. */
export function normalizeColumnWidths(widths: number[]): number[] {
  const cleaned = widths.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = cleaned.reduce((a, b) => a + b, 0);
  if (sum <= 0) return evenColumnWidths(widths.length || 1);
  return cleaned.map((w) => w / sum);
}

export async function listPageStatusForIssue(
  userId: string,
  issueId: string,
): Promise<PageStatusRow[]> {
  const { data, error } = await supabase
    .from("page_status")
    .select("*")
    .eq("user_id", userId)
    .eq("issue_id", issueId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PageStatusRow[];
}

export async function listAllPageStatus(userId: string): Promise<PageStatusRow[]> {
  const { data, error } = await supabase
    .from("page_status")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PageStatusRow[];
}

export async function upsertPageStatus(input: {
  userId: string;
  publicationId: string | null;
  issueId: string;
  pageId: string;
  pageLabel?: string | null;
  status?: PageStatusValue;
  assigneeRole?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  position?: number;
  layout?: PageLayout;
}): Promise<PageStatusRow> {
  const payload = {
    user_id: input.userId,
    publication_id: input.publicationId,
    issue_id: input.issueId,
    page_id: input.pageId,
    page_label: input.pageLabel ?? null,
    status: input.status ?? "idea",
    assignee_role: input.assigneeRole ?? null,
    due_date: input.dueDate ?? null,
    notes: input.notes ?? null,
    position: input.position ?? 0,
    layout: input.layout ?? DEFAULT_PAGE_LAYOUT,
  };
  const { data, error } = await supabase
    .from("page_status")
    .upsert(payload, { onConflict: "user_id,issue_id,page_id" })
    .select()
    .single();
  if (error) throw error;
  return data as PageStatusRow;
}

export async function updatePageStatus(
  id: string,
  patch: Partial<
    Pick<
      PageStatusRow,
      | "status"
      | "assignee_role"
      | "due_date"
      | "notes"
      | "position"
      | "page_label"
      | "layout"
      | "column_widths"
      | "gutter_in"
    >
  >,
): Promise<void> {
  const { error } = await supabase.from("page_status").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePageStatus(id: string): Promise<void> {
  const { error } = await supabase.from("page_status").delete().eq("id", id);
  if (error) throw error;
}
