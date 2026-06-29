/**
 * Templates panel: save the current IssueDoc as a reusable template
 * (e.g. monthly versions of a layout) and load any saved template back
 * into the editor.
 */
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, Copy, Pencil, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteIssueTemplate,
  duplicateIssueTemplate,
  listIssueTemplates,
  saveIssueTemplate,
  updateIssueTemplate,
  type IssueTemplateRow,
} from "@/lib/issueTemplates";
import type { IssueDoc } from "@/lib/coverDefaults";
import { newIssueId } from "@/lib/coverDefaults";

interface Props {
  userId: string | null;
  publicationId: string | null;
  issue: IssueDoc;
  onLoad: (next: IssueDoc) => void;
}

function suggestedName(issue: IssueDoc): string {
  const m = (issue.meta as { issue?: string; date?: string }) ?? {};
  const parts = [m.issue, m.date].filter(Boolean).join(" · ");
  return parts || "Untitled template";
}

export function IssueTemplatesPanel({ userId, publicationId, issue, onLoad }: Props) {
  const [rows, setRows] = useState<IssueTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(suggestedName(issue));
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (row: IssueTemplateRow) => {
    setRenamingId(row.id);
    setRenameValue(row.name);
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };
  const commitRename = async (row: IssueTemplateRow) => {
    const next = renameValue.trim();
    if (!next) {
      toast.error("Name can't be empty");
      return;
    }
    if (next === row.name) {
      cancelRename();
      return;
    }
    try {
      await updateIssueTemplate(row.id, { name: next });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: next } : r)));
      toast.success("Template renamed");
      cancelRename();
    } catch (e) {
      toast.error(`Could not rename: ${(e as Error).message}`);
    }
  };

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRows(await listIssueTemplates(userId));
    } catch (e) {
      toast.error(`Could not load templates: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setName(suggestedName(issue));
  }, [issue.meta?.issue, issue.meta?.date]);

  const onSave = async () => {
    if (!userId) {
      toast.error("Sign in to save templates");
      return;
    }
    if (!name.trim()) {
      toast.error("Give the template a name");
      return;
    }
    setBusy(true);
    try {
      await saveIssueTemplate({
        userId,
        publicationId,
        name: name.trim(),
        description: description.trim() || null,
        data: issue,
      });
      toast.success(`Saved template "${name.trim()}"`);
      setDescription("");
      await reload();
    } catch (e) {
      toast.error(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onPickLoad = (row: IssueTemplateRow) => {
    if (!confirm(`Load template "${row.name}"? Your current unsaved work on this issue will be replaced.`)) return;
    // Give the loaded doc a fresh issueId so the original template data
    // remains untouched and autosave doesn't collide with the source.
    const next: IssueDoc = {
      ...row.data,
      meta: { ...row.data.meta, issueId: newIssueId() },
    };
    onLoad(next);
    toast.success(`Loaded "${row.name}"`);
  };

  const onDelete = async (row: IssueTemplateRow) => {
    if (!confirm(`Delete template "${row.name}"?`)) return;
    try {
      await deleteIssueTemplate(row.id);
      toast.success("Template deleted");
      await reload();
    } catch (e) {
      toast.error(`Could not delete: ${(e as Error).message}`);
    }
  };

  const onDuplicate = async (row: IssueTemplateRow) => {
    try {
      await duplicateIssueTemplate(row);
      toast.success(`Duplicated "${row.name}"`);
      await reload();
    } catch (e) {
      toast.error(`Could not duplicate: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-sm border border-border bg-secondary/40 p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="h-3 w-3" /> Save current as template
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. March 2026 issue"
          className="w-full px-2 py-1.5 text-xs border border-border rounded-sm bg-background"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional note (cover style, sections, etc.)"
          className="w-full px-2 py-1.5 text-xs border border-border rounded-sm bg-background"
        />
        <button
          onClick={onSave}
          disabled={busy || !userId}
          className="w-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary rounded-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Save className="h-3 w-3" /> {busy ? "Saving…" : "Save template"}
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Saved templates {rows.length ? `(${rows.length})` : ""}
        </div>
        {loading ? (
          <div className="text-[11px] text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">
            No templates yet. Save the current issue to reuse it next month.
          </div>
        ) : (
          <ul className="space-y-1">
            {rows.map((r) => {
              const pages = Array.isArray(r.data?.pages) ? r.data.pages.length : 0;
              const when = new Date(r.created_at).toLocaleDateString();
              return (
                <li
                  key={r.id}
                  className="border border-border rounded-sm p-2 flex items-start gap-2 bg-background"
                >
                  <div className="flex-1 min-w-0">
                    {renamingId === r.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void commitRename(r);
                          else if (e.key === "Escape") cancelRename();
                        }}
                        className="w-full px-1.5 py-1 text-xs border border-border rounded-sm bg-background"
                      />
                    ) : (
                      <div className="text-xs font-medium truncate">{r.name}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {pages} page{pages === 1 ? "" : "s"} · {when}
                    </div>
                    {r.description ? (
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {r.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {renamingId === r.id ? (
                      <>
                        <button
                          onClick={() => void commitRename(r)}
                          title="Save name"
                          className="p-1.5 border border-border rounded-sm hover:bg-secondary"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={cancelRename}
                          title="Cancel"
                          className="p-1.5 border border-border rounded-sm hover:bg-secondary"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => void onDuplicate(r)}
                          title="Duplicate template"
                          className="p-1.5 border border-border rounded-sm hover:bg-secondary"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => startRename(r)}
                          title="Rename template"
                          className="p-1.5 border border-border rounded-sm hover:bg-secondary"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onPickLoad(r)}
                          title="Load this template into the editor"
                          className="p-1.5 border border-border rounded-sm hover:bg-secondary"
                        >
                          <Upload className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onDelete(r)}
                          title="Delete template"
                          className="p-1.5 border border-border rounded-sm hover:bg-secondary text-[color:var(--ruby)]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
