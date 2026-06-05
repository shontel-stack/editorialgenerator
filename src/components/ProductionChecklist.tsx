/**
 * Per-issue production checklist. Slides in from the right of the editor.
 * Each row shows a page, its status, assignee, and due date — backed by
 * the `page_status` table with realtime sync.
 */

import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useIssuePageStatus } from "@/hooks/useIssuePageStatus";
import {
  PAGE_STATUSES,
  STATUS_LABELS,
  STATUS_TONES,
  type PageStatusValue,
} from "@/lib/pageStatus";
import { STAFF_ROLES } from "@/lib/staffRoles";

type PageRef = { id: string; label: string; pageType?: string };

export function ProductionChecklist(props: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  issueId: string;
  publicationId: string | null;
  pages: PageRef[];
  onSelectPage?: (pageId: string) => void;
}) {
  const { open, onClose, userId, issueId, publicationId, pages, onSelectPage } = props;
  const { byPage, setStatus, setAssignee, setDueDate, loading } = useIssuePageStatus({
    userId,
    issueId,
    publicationId,
    pages,
  });

  if (!open) return null;

  const totals = PAGE_STATUSES.reduce<Record<PageStatusValue, number>>((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {} as Record<PageStatusValue, number>);
  for (const p of pages) {
    const s = (byPage[p.id]?.status ?? "idea") as PageStatusValue;
    totals[s] += 1;
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Production
          </div>
          <div className="text-sm font-medium">Issue checklist</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/board"
            className="text-[10px] tracking-[0.3em] uppercase border border-border px-2 py-1 rounded-sm hover:bg-secondary"
          >
            Board
          </Link>
          <Link
            to="/calendar"
            className="text-[10px] tracking-[0.3em] uppercase border border-border px-2 py-1 rounded-sm hover:bg-secondary"
          >
            Calendar
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border flex flex-wrap gap-1.5 text-[10px]">
        {PAGE_STATUSES.map((s) => (
          <span
            key={s}
            className={`px-2 py-0.5 rounded-sm ${STATUS_TONES[s]}`}
          >
            {STATUS_LABELS[s]} · {totals[s]}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {loading && pages.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading…</div>
        ) : null}
        {pages.map((p, idx) => {
          const row = byPage[p.id];
          const status = (row?.status ?? "idea") as PageStatusValue;
          return (
            <div key={p.id} className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => onSelectPage?.(p.id)}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                    Page {String(idx + 1).padStart(2, "0")}
                    {p.pageType ? ` · ${p.pageType}` : ""}
                  </div>
                  <div className="text-sm font-medium truncate">{p.label}</div>
                </button>
                <span className={`px-2 py-0.5 rounded-sm text-[10px] ${STATUS_TONES[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={status}
                  onChange={(e) => void setStatus(p.id, e.target.value as PageStatusValue)}
                  className="text-xs border border-input bg-background px-2 py-1 rounded-sm"
                >
                  {PAGE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <select
                  value={row?.assignee_role ?? ""}
                  onChange={(e) => void setAssignee(p.id, e.target.value || null)}
                  className="text-xs border border-input bg-background px-2 py-1 rounded-sm"
                >
                  <option value="">Unassigned</option>
                  {STAFF_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={row?.due_date ?? ""}
                  onChange={(e) => void setDueDate(p.id, e.target.value || null)}
                  className="text-xs border border-input bg-background px-2 py-1 rounded-sm col-span-2"
                />
              </div>
            </div>
          );
        })}
        {pages.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            No pages in this issue yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
