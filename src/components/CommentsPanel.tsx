import { useCallback, useEffect, useState } from "react";
import { MessageSquare, CheckCircle2, Circle, Trash2, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  addPageComment,
  deletePageComment,
  listPageComments,
  setCommentResolved,
  type PageCommentRow,
} from "@/lib/pageComments";

interface Props {
  userId: string | null;
  issueId: string;
  pageId: string;
  pageLabel?: string;
}

/**
 * Comments panel for the active page. Lightweight Canva-style note list — each
 * comment captures a body + optional resolved flag. Pin coordinates are stored
 * so an overlay can render them later, but this panel does not require the
 * overlay to be useful on its own.
 */
export function CommentsPanel({ userId, issueId, pageId, pageLabel }: Props) {
  const [rows, setRows] = useState<PageCommentRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await listPageComments(userId, issueId, pageId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [userId, issueId, pageId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAdd = async () => {
    if (!userId || !body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await addPageComment({
        userId,
        issueId,
        pageId,
        x: 0.5,
        y: 0.5,
        body: body.trim(),
      });
      setBody("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add comment");
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (row: PageCommentRow) => {
    await setCommentResolved(row.id, !row.resolved);
    await refresh();
  };
  const onDelete = async (id: string) => {
    if (!confirm("Delete comment?")) return;
    await deletePageComment(id);
    await refresh();
  };

  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex items-start gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={pageLabel ? `Note for ${pageLabel}…` : "Add a comment…"}
          className="flex-1 min-h-[54px] rounded border border-border bg-background px-2 py-1.5 text-[12px]"
          disabled={busy || !userId}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={busy || !userId || !body.trim()}
          className="self-stretch rounded bg-foreground px-3 text-[11px] text-background hover:opacity-90 disabled:opacity-50"
        >
          Post
        </button>
      </div>
      {err && <p className="text-[11px] text-red-500">{err}</p>}
      {!userId && (
        <p className="text-[11px] text-muted-foreground">Sign in to leave comments.</p>
      )}
      <div className="max-h-[260px] overflow-y-auto rounded border border-border divide-y divide-border">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground">
            <MessageSquare className="h-3 w-3" /> No comments on this page.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-start gap-2 px-2 py-1.5">
            <button
              type="button"
              title={r.resolved ? "Mark unresolved" : "Mark resolved"}
              onClick={() => onToggle(r)}
              className="mt-0.5 rounded p-0.5 hover:bg-secondary"
            >
              {r.resolved ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className={`text-[12px] whitespace-pre-wrap break-words ${r.resolved ? "line-through text-muted-foreground" : ""}`}>
                {r.body}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              title="Delete"
              onClick={() => onDelete(r.id)}
              className="rounded p-1 hover:bg-secondary"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
