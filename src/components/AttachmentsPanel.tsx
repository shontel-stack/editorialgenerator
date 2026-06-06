import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Upload,
  FileText,
  Image as ImageIcon,
  FileType2,
  Paperclip,
  Trash2,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
import { PublicationBadge } from "@/components/PublicationBadge";
import {
  ACCEPT_ATTR,
  fetchAttachmentsPage,
  isImage,
  isPdf,
  isWordDoc,
  signAttachmentUrl,
  type AttachmentAssignment,
  type AttachmentRow,
  type AttachmentSortKey,
  type AttachmentWithUrl,
} from "@/lib/attachments";


const PAGE_SIZE = 20;

type PageRef = { id: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  issueId: string;
  publicationId: string | null;
  publicationName?: string | null;
  selectedPageId: string | null;
  selectedPageLabel?: string;
  pages?: PageRef[];
  attachments: {
    rows: AttachmentWithUrl[];
    loading: boolean;
    error: string | null;
    upload: (args: {
      pageId: string | null;
      kind: "template" | "reference";
      file: File;
    }) => Promise<void>;
    remove: (row: AttachmentWithUrl) => Promise<void>;
    updateAssignment?: (id: string, patch: AttachmentAssignment) => Promise<void>;
  };
  library?: {
    rows: AttachmentWithUrl[];
    loading: boolean;
    error: string | null;
    upload: (file: File) => Promise<void>;
    remove: (row: AttachmentWithUrl) => Promise<void>;
  };
  onInsertImage?: (row: AttachmentWithUrl) => void;
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

async function hydrateRows(raw: AttachmentRow[]): Promise<AttachmentWithUrl[]> {
  return Promise.all(
    raw.map(async (r) => ({ ...r, signedUrl: await signAttachmentUrl(r.file_path) })),
  );
}

export function AttachmentsPanel({
  open,
  onClose,
  issueId,
  publicationId,
  publicationName,
  selectedPageId,
  selectedPageLabel,
  pages = [],
  attachments,
  library,
  onInsertImage,
}: Props) {

  const inputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"issue" | "library">("issue");
  const [busy, setBusy] = useState(false);
  const [libBusy, setLibBusy] = useState(false);
  const [libErr, setLibErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scope, setScope] = useState<"issue" | "page">("issue");
  const [kind, setKind] = useState<"reference" | "template">("reference");

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortBy, setSortBy] = useState<AttachmentSortKey>("date_desc");

  const [items, setItems] = useState<AttachmentWithUrl[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchSeq = useRef(0);

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // The list resets whenever any of these inputs change, including after
  // an upload/delete (we use attachments.rows.length as a version signal).
  const resetKey = useMemo(
    () => `${issueId}|${publicationId ?? "_none"}|${debouncedQuery}|${sortBy}|${attachments.rows.length}`,
    [issueId, publicationId, debouncedQuery, sortBy, attachments.rows.length],
  );

  const loadPage = useCallback(
    async (from: number, replace: boolean) => {
      const seq = ++fetchSeq.current;
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const page = await fetchAttachmentsPage({
          issueId,
          publicationId,
          search: debouncedQuery,
          sort: sortBy,
          from,
          to: from + PAGE_SIZE - 1,
        });
        const hydrated = await hydrateRows(page.rows);
        if (seq !== fetchSeq.current) return; // stale
        setTotal(page.total);
        setItems((prev) => (replace ? hydrated : [...prev, ...hydrated]));
        setPageError(null);
      } catch (e) {
        if (seq !== fetchSeq.current) return;
        setPageError((e as Error).message);
      } finally {
        if (seq === fetchSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [issueId, publicationId, debouncedQuery, sortBy],
  );

  // Initial / reset fetch.
  useEffect(() => {
    if (!open) return;
    setItems([]);
    setTotal(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    void loadPage(0, true);
  }, [open, resetKey, loadPage]);

  const hasMore = items.length < total;

  // Infinite scroll via IntersectionObserver.
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !loading && !loadingMore) {
          void loadPage(items.length, false);
        }
      },
      { root, rootMargin: "120px" },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [open, hasMore, loading, loadingMore, items.length, loadPage]);

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

  const handleRemove = async (row: AttachmentWithUrl) => {
    // Optimistically remove from the visible list, then sync via the hook.
    setItems((prev) => prev.filter((r) => r.id !== row.id));
    setTotal((t) => Math.max(0, t - 1));
    await attachments.remove(row);
  };

  return (
    <aside
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-background border-l border-border shadow-2xl flex flex-col"
      aria-label="Attachments"
    >
      <header className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Attachments</h2>
          <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5 truncate">
            Issue · {issueId.slice(0, 8)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PublicationBadge name={publicationName} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attachments panel"
            className="text-muted-foreground hover:text-foreground p-1 rounded-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {library && (
        <div className="px-4 pt-3 flex gap-1 border-b border-border">
          {(["issue", "library"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "text-[10px] tracking-[0.25em] uppercase px-3 py-2 rounded-t-sm border-b-2 -mb-px " +
                (tab === t
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t === "issue" ? "Issue files" : "Library"}
            </button>
          ))}
        </div>
      )}

      {tab === "library" && library ? (
        <LibrarySection
          inputRef={libraryInputRef}
          publicationName={publicationName ?? null}
          library={library}
          busy={libBusy}
          err={libErr}
          onPick={async (file) => {
            if (!file) return;
            setLibBusy(true);
            setLibErr(null);
            try {
              await library.upload(file);
            } catch (e) {
              setLibErr((e as Error).message);
            } finally {
              setLibBusy(false);
              if (libraryInputRef.current) libraryInputRef.current.value = "";
            }
          }}
          onInsertImage={onInsertImage}
        />
      ) : (<>
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

      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full border border-input bg-background pl-7 pr-2 py-1.5 text-xs rounded-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as AttachmentSortKey)}
          aria-label="Sort attachments"
          className="border border-input bg-background px-2 py-1.5 text-xs rounded-sm text-foreground"
        >
          <option value="date_desc">Newest</option>
          <option value="date_asc">Oldest</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="kind">Kind</option>
          <option value="page">Page</option>
          <option value="size_desc">Largest</option>
          <option value="size_asc">Smallest</option>
        </select>
      </div>

      <div className="px-4 py-1.5 border-b border-border flex items-center justify-between text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        <span>
          {total === 0
            ? "0 files"
            : `Showing ${items.length} of ${total}${debouncedQuery ? " match" + (total === 1 ? "" : "es") : ""}`}
        </span>
        {(loading || loadingMore) && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : pageError ? (
          <div className="p-4 text-xs text-destructive">{pageError}</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {debouncedQuery
              ? "No files match your search."
              : "No attachments yet. Upload a file to get started."}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {items.map((row) => {
                const Icon = iconFor(row.mime_type);
                return (
                  <li key={row.id} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                    {row.signedUrl && isImage(row.mime_type) ? (
                      <img
                        src={row.signedUrl}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 object-cover rounded-sm border border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 flex items-center justify-center border border-border rounded-sm flex-shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs font-medium text-foreground truncate"
                        title={row.file_name}
                      >
                        {row.file_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground tracking-wide">
                        {row.kind === "template" ? "Template" : "Reference"}
                        {row.page_id ? ` · page ${row.page_id.slice(-4)}` : " · issue"}
                        {row.region ? ` · ${row.region}` : ""}
                        {row.position_x != null && row.position_y != null
                          ? ` · pin ${row.position_x.toFixed(2)},${row.position_y.toFixed(2)}`
                          : ""}
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
                        onClick={() => void handleRemove(row)}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-sm hover:bg-secondary"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    </div>
                    {row.kind === "reference" && attachments.updateAssignment && (
                      <div className="grid grid-cols-2 gap-1.5 pl-[52px]">
                        <label className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground flex flex-col gap-0.5">
                          Page
                          <select
                            value={row.page_id ?? ""}
                            onChange={(e) =>
                              void attachments.updateAssignment!(row.id, {
                                page_id: e.target.value || null,
                              })
                            }
                            className="border border-input bg-background px-1.5 py-1 text-[11px] rounded-sm normal-case tracking-normal text-foreground"
                          >
                            <option value="">— unassigned —</option>
                            {pages.map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground flex flex-col gap-0.5">
                          Region
                          <input
                            type="text"
                            list="region-suggestions"
                            value={row.region ?? ""}
                            placeholder="—"
                            onChange={(e) =>
                              void attachments.updateAssignment!(row.id, {
                                region: e.target.value || null,
                              })
                            }
                            className="border border-input bg-background px-1.5 py-1 text-[11px] rounded-sm normal-case tracking-normal text-foreground"
                          />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
              <datalist id="region-suggestions">
                <option value="column-1" />
                <option value="column-2" />
                <option value="column-3" />
                <option value="header" />
                <option value="footer" />
              </datalist>
            </ul>

            <div ref={sentinelRef} className="h-2" aria-hidden />
            {hasMore && (
              <div className="px-4 py-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadPage(items.length, false)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 border border-border bg-secondary/40 hover:bg-secondary px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-foreground rounded-sm disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                    </>
                  ) : (
                    <>Load more ({total - items.length} left)</>
                  )}
                </button>
              </div>
            )}
            {!hasMore && items.length > 0 && (
              <div className="p-3 text-center text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                End of list
              </div>
            )}

          </>
      </div>
      </>)}
    </aside>
  );
}

