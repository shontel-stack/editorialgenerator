import { useRef, useState } from "react";
import { Paperclip, X, FileText, Image as ImageIcon, FileType2 } from "lucide-react";
import { ACCEPT_ATTR, isImage, isPdf, isWordDoc, type AttachmentWithUrl } from "@/lib/attachments";

type Props = {
  label: string;
  attachment: AttachmentWithUrl | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  compact?: boolean;
};

export function AttachmentControl({ label, attachment, onUpload, onRemove, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await onUpload(file);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const Icon = attachment
    ? isPdf(attachment.mime_type)
      ? FileText
      : isImage(attachment.mime_type)
        ? ImageIcon
        : isWordDoc(attachment.mime_type)
          ? FileType2
          : Paperclip
    : Paperclip;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={attachment ? `Replace reference: ${attachment.file_name}` : "Attach reference"}
          className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] tracking-[0.25em] uppercase rounded-sm transition disabled:opacity-50 ${
            attachment
              ? "border-[color:var(--ruby)] text-[color:var(--ruby)] hover:bg-[color:var(--ruby)]/5"
              : "border-border text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Icon className="h-3 w-3" />
          {busy ? "Uploading…" : attachment ? truncate(attachment.file_name, 22) : "Add reference"}
        </button>
        {attachment && (
          <button
            type="button"
            onClick={() => void onRemove()}
            title="Remove reference"
            className="text-muted-foreground hover:text-destructive p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {err && <span className="text-[10px] text-destructive">{err}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0])}
        />
        {attachment ? (
          <div className="flex items-center gap-2 border border-[color:var(--ruby)]/40 bg-[color:var(--ruby)]/5 rounded-sm pl-2 pr-1 py-1.5 max-w-[260px]">
            {attachment.signedUrl && isImage(attachment.mime_type) ? (
              <img
                src={attachment.signedUrl}
                alt=""
                className="h-7 w-7 object-cover rounded-sm border border-border"
              />
            ) : (
              <div className="h-7 w-7 flex items-center justify-center bg-background border border-border rounded-sm">
                <Icon className="h-3.5 w-3.5 text-[color:var(--ruby)]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[11px] truncate" title={attachment.file_name}>
                {attachment.file_name}
              </div>
              <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                {(attachment.size_bytes / 1024).toFixed(0)} KB · {labelForMime(attachment.mime_type)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground px-1.5"
            >
              {busy ? "…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={() => void onRemove()}
              title="Remove"
              className="text-muted-foreground hover:text-destructive p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 border border-dashed border-border px-3 py-1.5 text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:bg-secondary hover:text-foreground rounded-sm transition disabled:opacity-50"
          >
            <Paperclip className="h-3 w-3" />
            {busy ? "Uploading…" : "Upload PDF / image / Word"}
          </button>
        )}
      </div>
      {err && <div className="text-[10px] text-destructive">{err}</div>}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function labelForMime(m: string): string {
  if (isPdf(m)) return "PDF";
  if (isWordDoc(m)) return "Word";
  if (m === "image/jpeg") return "JPEG";
  if (m === "image/png") return "PNG";
  if (m === "image/webp") return "WEBP";
  return "File";
}
