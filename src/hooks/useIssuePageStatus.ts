/**
 * Loads and live-syncs page_status rows for one issue. Auto-creates rows
 * for pages that don't have a status yet so the checklist is always complete.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listPageStatusForIssue,
  upsertPageStatus,
  updatePageStatus,
  type PageStatusRow,
  type PageStatusValue,
} from "@/lib/pageStatus";
import { DEFAULT_PAGE_LAYOUT, type PageLayout } from "@/lib/pageLayouts";

type PageRef = { id: string; label: string };

export function useIssuePageStatus(opts: {
  userId: string | null;
  issueId: string;
  publicationId: string | null;
  pages: PageRef[];
}) {
  const { userId, issueId, publicationId, pages } = opts;
  const [rows, setRows] = useState<PageStatusRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!userId || !issueId) return;
    setLoading(true);
    try {
      const data = await listPageStatusForIssue(userId, issueId);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [userId, issueId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Realtime subscription
  useEffect(() => {
    if (!userId || !issueId) return;
    const channel = supabase
      .channel(`page-status:${issueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_status", filter: `issue_id=eq.${issueId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, issueId, reload]);

  // Auto-create missing rows for current pages.
  useEffect(() => {
    if (!userId || !issueId || rows.length === 0 && pages.length === 0) return;
    const existing = new Set(rows.map((r) => r.page_id));
    const missing = pages.filter((p) => !existing.has(p.id));
    if (missing.length === 0) return;
    (async () => {
      for (const [i, p] of missing.entries()) {
        try {
          await upsertPageStatus({
            userId,
            publicationId,
            issueId,
            pageId: p.id,
            pageLabel: p.label,
            status: "idea",
            position: rows.length + i,
          });
        } catch {
          // ignore — realtime will reconcile
        }
      }
    })();
  }, [userId, issueId, publicationId, pages, rows]);

  const byPage = useMemo(() => {
    const m: Record<string, PageStatusRow> = {};
    for (const r of rows) m[r.page_id] = r;
    return m;
  }, [rows]);

  const setStatus = useCallback(
    async (pageId: string, status: PageStatusValue) => {
      const existing = byPage[pageId];
      const label = pages.find((p) => p.id === pageId)?.label ?? null;
      if (existing) await updatePageStatus(existing.id, { status });
      else if (userId)
        await upsertPageStatus({
          userId,
          publicationId,
          issueId,
          pageId,
          pageLabel: label,
          status,
        });
    },
    [byPage, pages, userId, publicationId, issueId],
  );

  const setAssignee = useCallback(
    async (pageId: string, assignee_role: string | null) => {
      const existing = byPage[pageId];
      const label = pages.find((p) => p.id === pageId)?.label ?? null;
      if (existing) await updatePageStatus(existing.id, { assignee_role });
      else if (userId)
        await upsertPageStatus({
          userId,
          publicationId,
          issueId,
          pageId,
          pageLabel: label,
          assigneeRole: assignee_role,
        });
    },
    [byPage, pages, userId, publicationId, issueId],
  );

  const setDueDate = useCallback(
    async (pageId: string, due_date: string | null) => {
      const existing = byPage[pageId];
      const label = pages.find((p) => p.id === pageId)?.label ?? null;
      if (existing) await updatePageStatus(existing.id, { due_date });
      else if (userId)
        await upsertPageStatus({
          userId,
          publicationId,
          issueId,
          pageId,
          pageLabel: label,
          dueDate: due_date,
        });
    },
    [byPage, pages, userId, publicationId, issueId],
  );

  const setLayout = useCallback(
    async (pageId: string, layout: PageLayout) => {
      const existing = byPage[pageId];
      const label = pages.find((p) => p.id === pageId)?.label ?? null;
      if (existing) await updatePageStatus(existing.id, { layout });
      else if (userId)
        await upsertPageStatus({
          userId,
          publicationId,
          issueId,
          pageId,
          pageLabel: label,
          layout,
        });
    },
    [byPage, pages, userId, publicationId, issueId],
  );

  const layoutOf = useCallback(
    (pageId: string): PageLayout => byPage[pageId]?.layout ?? DEFAULT_PAGE_LAYOUT,
    [byPage],
  );

  return { rows, byPage, loading, reload, setStatus, setAssignee, setDueDate, setLayout, layoutOf };
}
