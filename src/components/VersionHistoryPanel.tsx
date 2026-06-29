import { useEffect, useState, useCallback } from "react";
import { History, Save, RotateCcw, Trash2, Loader2 } from "lucide-react";
import type { IssueDoc } from "@/lib/coverDefaults";
import {
  listIssueVersions,
  saveIssueVersion,
  deleteIssueVersion,
  type IssueVersionRow,
} from "@/lib/issueVersions";

interface Props {
  userId: string | null;
  issue: IssueDoc;
  onRestore: (next: IssueDoc) => void;
}

/**
 * Figma/Canva-style version history. Stores manual save-points of the current
 * IssueDoc in Supabase so the user can browse and restore prior layouts.
 */
export function VersionHistoryPanel({ userId, issue, onRestore }: Props) {
  const [rows, setRows] = useState<IssueVersionRow[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErr(null);
    try {
      setRows(await listIssueVersions(userId, issue.meta.issueId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, [userId, issue.meta.issueId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onSave = async () => {
    if (!userId) {
      setErr("Sign in to save a version.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await saveIssueVersion({
        userId,
        issueId: issue.meta.issueId,
        label: label.trim() || null,
        snapshot: issue,
      });
      setLabel("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save version");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this version?")) return;
    setBusy(true);
    try {
      await deleteIssueVersion(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onRestoreClick = (row: IssueVersionRow) => {
    if (!confirm(`Restore version from ${new Date(row.created_at).toLocaleString()}? Current unsaved work in this issue will be replaced.`)) return;
    onRestore(row.snapshot);
  };

  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Version label (optional)"
          className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-[12px]"
          disabled={busy || !userId}
        />
        <button
          type="button"
          onClick={onSave}
          disabled={busy || !userId}
          className="inline-flex items-center gap-1 rounded bg-foreground px-2 py-1.5 text-[11px] text-background hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-3 w-3" />
          Save
        </button>
      </div>
      {err && <p className="text-[11px] text-red-500">{err}</p>}
      {!userId && (
        <p className="text-[11px] text-muted-foreground">Sign in to keep a version history.</p>
      )}
      <div className="max-h-[260px] overflow-y-auto rounded border border-border divide-y divide-border">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground">
            <History className="h-3 w-3" /> No saved versions yet.
          </div>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium">
                {r.label || "Untitled"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()} · {r.snapshot.pages?.length ?? 0} pages
              </div>
            </div>
            <button
              type="button"
              title="Restore"
              onClick={() => onRestoreClick(r)}
              className="rounded p-1 hover:bg-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
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
