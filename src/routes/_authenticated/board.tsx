/**
 * Production Kanban — every page across every issue, grouped by status.
 * Status changes are written back to `page_status` and stream in via realtime.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PAGE_STATUSES,
  STATUS_LABELS,
  STATUS_TONES,
  listAllPageStatus,
  updatePageStatus,
  type PageStatusRow,
  type PageStatusValue,
} from "@/lib/pageStatus";
import { STAFF_BY_ID } from "@/lib/staffRoles";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Production board — Pageluxe Issue Builder" },
      { name: "description", content: "Kanban view of every page in production." },
    ],
  }),
  component: BoardPage,
});

function BoardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<PageStatusRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listAllPageStatus(userId);
        if (!cancelled) setRows(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const channel = supabase
      .channel("board:page_status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "page_status" },
        () => {
          if (cancelled) return;
          listAllPageStatus(userId).then((d) => setRows(d)).catch(() => {});
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const grouped = useMemo(() => {
    const g: Record<PageStatusValue, PageStatusRow[]> = {
      idea: [], writing: [], editing: [], review: [],
      approved: [], published: [], archived: [],
    };
    for (const r of rows) g[r.status as PageStatusValue]?.push(r);
    return g;
  }, [rows]);

  const move = async (row: PageStatusRow, status: PageStatusValue) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      await updatePageStatus(row.id, { status });
    } catch {
      // realtime will reconcile
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to editor
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Production</div>
            <h1 className="text-lg font-medium">Board</h1>
          </div>
        </div>
        <Link to="/calendar" className="inline-flex items-center gap-2 border border-border px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-secondary">
          <CalendarIcon className="h-3.5 w-3.5" /> Calendar
        </Link>
      </header>

      <div className="p-6 overflow-x-auto">
        {loading && rows.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16">Loading board…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16">
            No pages tracked yet. Open the production checklist in the editor to start.
          </div>
        ) : (
          <div className="flex gap-4 min-w-max">
            {PAGE_STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                rows={grouped[status]}
                onMove={move}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Column({
  status,
  rows,
  onMove,
}: {
  status: PageStatusValue;
  rows: PageStatusRow[];
  onMove: (row: PageStatusRow, status: PageStatusValue) => void;
}) {
  return (
    <div className="w-72 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded-sm text-[10px] ${STATUS_TONES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
        <span className="text-[10px] text-muted-foreground">{rows.length}</span>
      </div>
      <div className="space-y-2 min-h-[200px]">
        {rows.map((r) => (
          <Card key={r.id} row={r} onMove={onMove} />
        ))}
      </div>
    </div>
  );
}

function Card({
  row,
  onMove,
}: {
  row: PageStatusRow;
  onMove: (row: PageStatusRow, status: PageStatusValue) => void;
}) {
  const assignee = row.assignee_role ? STAFF_BY_ID[row.assignee_role] : null;
  return (
    <div className="border border-border bg-card p-3 rounded-sm space-y-2">
      <div>
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground truncate">
          {row.issue_id}
        </div>
        <div className="text-sm font-medium truncate">{row.page_label ?? row.page_id}</div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
        <span className="truncate">{assignee?.title ?? "Unassigned"}</span>
        {row.due_date ? <span>{row.due_date}</span> : null}
      </div>
      <select
        value={row.status}
        onChange={(e) => onMove(row, e.target.value as PageStatusValue)}
        className="w-full text-xs border border-input bg-background px-2 py-1 rounded-sm"
      >
        {PAGE_STATUSES.map((s) => (
          <option key={s} value={s}>
            Move to {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
