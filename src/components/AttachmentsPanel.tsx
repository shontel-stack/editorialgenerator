import { useRef, useState } from "react";
import { X, Upload, FileText, Image as ImageIcon, FileType2, Paperclip, Trash2, ExternalLink, Loader2 } from "lucide-react";
import {
  ACCEPT_ATTR,
  isImage,
  isPdf,
  isWordDoc,
  type AttachmentWithUrl,
} from "@/lib/attachments";

type Props = {
  open: boolean;
  onClose: () => void;
  issueId: string;
  selectedPageId: string | null;
  selectedPageLabel?: string;
  attachments: {
    rows: AttachmentWithUrl[];
    loading: boolean;
    error: string | null;
    upload: (args: { pageId: string | null; kind: "template" | "reference"; file: File }) => Promise<void>;
    remove: (row: AttachmentWithUrl) => Promise<void>;
  };
};

function iconFor(mime: string) {
  if (isPdf(mime)) return FileText;
  if (isImage(mime)) return ImageIcon;
  if (isWordDoc(mime)) return FileType2;
  return Paperclip;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function AttachmentsPanel({
  open,
  onClose,
  issueId,
  selectedPageId,
  selectedPageLabel,
  attachments,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scope, setScope] = useState<"issue" | "page">("issue");
  const [kind, setKind] = useState<"reference" | "template">("reference");

  if (!open) return null;

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await attachments.upload({
        pageId: scope === "page" ? selectedPageId : null,
        kind,
        file,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background border-l border-border shadow-2xl flex flex-col"
      aria-label="Attachments"
    >
      <header className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Attachments</h2>
          <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
            Issue · {issueId.slice(0, 8)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close attachments panel"
          className="text-muted-foreground hover:text-foreground p-1 rounded-sm"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground flex flex-col gap-1">
            Kind
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "reference" | "template")}
              className="border border-input bg-background px-2 py-1.5 text-xs rounded-sm normal-case tracking-normal text-foreground"
            >
              <option value="reference">Reference</option>
              <option value="template">Template (whole issue)</option>
            </select>
          </label>
          <label className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground flex flex-col gap-1">
            Scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "issue" | "page")}
              disabled={kind === "template"}
              className="border border-input bg-background px-2 py-1.5 text-xs rounded-sm normal-case tracking-normal text-foreground disabled:opacity-50"
            >
              <option value="issue">Whole issue</option>
              <option value="page" disabled={!selectedPageId}>
                {selectedPageLabel ? `Page · ${selectedPageLabel}` : "Selected page"}
              </option>
            </select>
          </label>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => void handlePick(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-border bg-secondary/40 hover:bg-secondary px-3 py-3 text-xs uppercase tracking-[0.25em] text-foreground rounded-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Uploading…" : "Upload file"}
        </button>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
        <p className="text-[10px] text-muted-foreground">
          Only you can see and manage files for this issue. PDF, JPG, PNG, WEBP, DOCX up to 10 MB.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {attachments.loading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : attachments.error ? (
          <div className="p-4 text-xs text-destructive">{attachments.error}</div>
        ) : attachments.rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No attachments yet. Upload a file to get started.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {attachments.rows.map((row) => {
              const Icon = iconFor(row.mime_type);
              return (
                <li key={row.id} className="px-4 py-3 flex items-start gap-3">
                  {row.signedUrl && isImage(row.mime_type) ? (
                    <img
                      src={row.signedUrl}
                      alt=""
                      className="h-10 w-10 object-cover rounded-sm border border-border flex-shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 flex items-center justify-center border border-border rounded-sm flex-shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate" title={row.file_name}>
                      {row.file_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground tracking-wide">
                      {row.kind === "template" ? "Template" : "Reference"}
                      {row.page_id ? ` · page ${row.page_id.slice(-4)}` : " · issue"}
                      {" · "}
                      {formatSize(row.size_bytes)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {row.signedUrl && (
                      <a
                        href={row.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-sm hover:bg-secondary"
                        title="Open"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void attachments.remove(row)}
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded-sm hover:bg-secondary"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
