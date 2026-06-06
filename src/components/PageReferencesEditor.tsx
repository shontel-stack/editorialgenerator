import { useRef, useState } from "react";
import { Paperclip, X, FileText, Image as ImageIcon, FileType2, MapPin } from "lucide-react";
import {
  ACCEPT_ATTR,
  isImage,
  isPdf,
  isWordDoc,
  type AttachmentAssignment,
  type AttachmentWithUrl,
} from "@/lib/attachments";

type Props = {
  pageId: string;
  references: AttachmentWithUrl[];
  columnCount: number;
  onUpload: (file: File) => Promise<void>;
  onRemove: (row: AttachmentWithUrl) => Promise<void>;
  onAssign: (id: string, patch: AttachmentAssignment) => Promise<void>;
};

function iconFor(mime: string) {
  if (isPdf(mime)) return FileText;
  if (isImage(mime)) return ImageIcon;
  if (isWordDoc(mime)) return FileType2;
  return Paperclip;
}

function regionOptionsFor(columnCount: number): string[] {
  const base = ["header", "footer"];
  if (columnCount > 1) {
    for (let i = 1; i <= columnCount; i++) base.unshift(`column-${i}`);
    base.reverse();
  }
  return base;
}

export function PageReferencesEditor({
  references,
  columnCount,
  onUpload,
  onRemove,
  onAssign,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const regions = regionOptionsFor(columnCount);

  const pick = async (file: File | undefined) => {
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

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {references.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">No references attached to this page yet.</p>
      ) : (
        <ul className="space-y-2">
          {references.map((r) => {
            const Icon = iconFor(r.mime_type);
            return (
              <li
                key={r.id}
                className="border border-border bg-card rounded-sm p-2 space-y-1.5"
              >
                <div className="flex items-start gap-2">
                  {r.signedUrl && isImage(r.mime_type) ? (
                    <img
                      src={r.signedUrl}
                      alt=""
                      className="h-9 w-9 object-cover rounded-sm border border-border flex-shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 flex items-center justify-center border border-border rounded-sm flex-shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate" title={r.file_name}>{r.file_name}</p>
                    <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                      {(r.size_bytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRemove(r)}
                    title="Remove"
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <label className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground flex flex-col gap-1">
                    Region
                    <select
                      value={r.region ?? ""}
                      onChange={(e) =>
                        void onAssign(r.id, { region: e.target.value || null })
                      }
                      className="border border-input bg-background px-1.5 py-1 text-[11px] rounded-sm normal-case tracking-normal text-foreground"
                    >
                      <option value="">— whole page —</option>
                      {regions.map((rn) => (
                        <option key={rn} value={rn}>{rn}</option>
                      ))}
                    </select>
                  </label>
                  <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground flex flex-col gap-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" /> Pin (x, y)
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        placeholder="—"
                        value={r.position_x ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          void onAssign(r.id, {
                            position_x: v === "" ? null : Number(v),
                          });
                        }}
                        className="w-full border border-input bg-background px-1.5 py-1 text-[11px] rounded-sm normal-case tracking-normal text-foreground"
                      />
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        placeholder="—"
                        value={r.position_y ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          void onAssign(r.id, {
                            position_y: v === "" ? null : Number(v),
                          });
                        }}
                        className="w-full border border-input bg-background px-1.5 py-1 text-[11px] rounded-sm normal-case tracking-normal text-foreground"
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-1.5 border border-dashed border-border px-2 py-1.5 text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:bg-secondary hover:text-foreground rounded-sm transition disabled:opacity-50"
      >
        <Paperclip className="h-3 w-3" />
        {busy ? "Uploading…" : "Add reference to this page"}
      </button>
      {err && <p className="text-[10px] text-destructive">{err}</p>}
    </div>
  );
}
