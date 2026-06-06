import { supabase } from "@/integrations/supabase/client";

export const ATTACHMENT_BUCKET = "issue-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB

export const ACCEPTED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,.docx";

export type AttachmentKind = "template" | "reference" | "library";

export type AttachmentRow = {
  id: string;
  issue_id: string | null;
  page_id: string | null;
  kind: AttachmentKind;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string | null;
  region: string | null;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
};


export type AttachmentWithUrl = AttachmentRow & { signedUrl: string | null };

export function isWordDoc(mime: string) {
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export function isImage(mime: string) {
  return mime.startsWith("image/");
}

export function isPdf(mime: string) {
  return mime === "application/pdf";
}

/** Extract text from a .docx in the browser using mammoth. */
async function extractDocxText(file: File): Promise<string | null> {
  try {
    const mammoth = await import("mammoth/mammoth.browser");
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value?.slice(0, 20000) ?? null;
  } catch (e) {
    console.warn("[attachments] docx text extraction failed", e);
    return null;
  }
}

function applyPublicationFilter<T extends { eq: (...a: unknown[]) => T; is: (...a: unknown[]) => T }>(
  q: T,
  publicationId: string | null,
): T {
  return publicationId === null
    ? q.is("publication_id", null)
    : q.eq("publication_id", publicationId);
}

export async function listAttachments(
  issueId: string,
  publicationId: string | null,
): Promise<AttachmentRow[]> {
  let q = supabase
    .from("issue_attachments")
    .select("*")
    .eq("issue_id", issueId);
  q = applyPublicationFilter(q as never, publicationId) as typeof q;
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AttachmentRow[];
}

export type AttachmentSortKey =
  | "date_desc"
  | "date_asc"
  | "name_asc"
  | "name_desc"
  | "kind"
  | "page"
  | "size_desc"
  | "size_asc";

export type AttachmentPage = {
  rows: AttachmentRow[];
  total: number;
  from: number;
  to: number;
};

export async function fetchAttachmentsPage(opts: {
  issueId: string;
  publicationId: string | null;
  search?: string;
  sort?: AttachmentSortKey;
  from: number;
  to: number;
}): Promise<AttachmentPage> {
  const { issueId, publicationId, search, sort = "date_desc", from, to } = opts;
  let q = supabase
    .from("issue_attachments")
    .select("*", { count: "exact" })
    .eq("issue_id", issueId);
  q = applyPublicationFilter(q as never, publicationId) as typeof q;

  if (search && search.trim().length > 0) {
    // Escape % and _ to keep them literal in ILIKE.
    const safe = search.trim().replace(/[\\%_]/g, (m) => `\\${m}`);
    q = q.ilike("file_name", `%${safe}%`);
  }

  switch (sort) {
    case "date_desc":
      q = q.order("created_at", { ascending: false });
      break;
    case "date_asc":
      q = q.order("created_at", { ascending: true });
      break;
    case "name_asc":
      q = q.order("file_name", { ascending: true });
      break;
    case "name_desc":
      q = q.order("file_name", { ascending: false });
      break;
    case "kind":
      q = q.order("kind", { ascending: true }).order("file_name", { ascending: true });
      break;
    case "page":
      q = q
        .order("page_id", { ascending: true, nullsFirst: true })
        .order("file_name", { ascending: true });
      break;
    case "size_desc":
      q = q.order("size_bytes", { ascending: false });
      break;
    case "size_asc":
      q = q.order("size_bytes", { ascending: true });
      break;
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;
  return {
    rows: (data ?? []) as AttachmentRow[],
    total: count ?? 0,
    from,
    to,
  };
}

export async function signAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60); // 1h
  if (error) {
    console.warn("[attachments] sign url failed", error.message);
    return null;
  }
  return data.signedUrl;
}

export async function uploadAttachment(opts: {
  issueId: string;
  publicationId: string | null;
  pageId: string | null;
  kind: "template" | "reference";
  file: File;
}): Promise<AttachmentRow> {
  const { issueId, publicationId, pageId, kind, file } = opts;
  if (!issueId || issueId.length < 8) {
    throw new Error("Issue is still initializing. Reload the page and try again.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`File too large (max ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB).`);
  }
  if (!ACCEPTED_MIME.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}.`);
  }

  // Templates are unique per (issue, publication) — replace on upload.
  // References can now have multiple per page; do NOT auto-replace.
  if (kind === "template") {
    let existingQ = supabase
      .from("issue_attachments")
      .select("id, file_path")
      .eq("issue_id", issueId)
      .eq("kind", kind)
      .filter("page_id", pageId === null ? "is" : "eq", pageId === null ? null : pageId);
    existingQ = applyPublicationFilter(existingQ as never, publicationId) as typeof existingQ;
    const existing = await existingQ;
    if (existing.data?.length) {
      const paths = existing.data.map((r) => r.file_path);
      await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
      await supabase
        .from("issue_attachments")
        .delete()
        .in("id", existing.data.map((r) => r.id));
    }
  }


  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload attachments.");

  const ext = file.name.split(".").pop() || "bin";
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  // Path is namespaced under the owner so storage RLS can verify ownership.
  const path = `${uid}/${issueId}/${kind}/${pageId ?? "_issue"}/${Date.now()}-${safe}`;

  const up = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;

  const extracted = isWordDoc(file.type) ? await extractDocxText(file) : null;

  const insert = await supabase
    .from("issue_attachments")
    .insert({
      issue_id: issueId,
      user_id: uid,
      publication_id: publicationId,
      page_id: pageId,
      kind,
      file_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      extracted_text: extracted,
    })
    .select("*")
    .single();
  if (insert.error) throw insert.error;
  return insert.data as AttachmentRow;
  void ext;
}

export async function deleteAttachment(row: AttachmentRow): Promise<void> {
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([row.file_path]);
  const { error } = await supabase.from("issue_attachments").delete().eq("id", row.id);
  if (error) throw error;
}

export type AttachmentAssignment = {
  page_id?: string | null;
  region?: string | null;
  position_x?: number | null;
  position_y?: number | null;
};

/** Reassign an attachment to a page / region / pin coordinates. */
export async function updateAttachmentAssignment(
  id: string,
  patch: AttachmentAssignment,
): Promise<void> {
  const payload: {
    page_id?: string | null;
    region?: string | null;
    position_x?: number | null;
    position_y?: number | null;
  } = {};
  if (patch.page_id !== undefined) payload.page_id = patch.page_id;
  if (patch.region !== undefined) payload.region = patch.region;
  if (patch.position_x !== undefined) {
    payload.position_x =
      patch.position_x === null ? null : Math.min(1, Math.max(0, patch.position_x));
  }
  if (patch.position_y !== undefined) {
    payload.position_y =
      patch.position_y === null ? null : Math.min(1, Math.max(0, patch.position_y));
  }
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("issue_attachments").update(payload).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Publication library: shared media bucket scoped to a publication (no issue).
// ---------------------------------------------------------------------------

export async function listLibraryAttachments(
  publicationId: string,
): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("issue_attachments")
    .select("*")
    .eq("kind", "library")
    .eq("publication_id", publicationId)
    .is("issue_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AttachmentRow[];
}

export async function uploadLibraryAttachment(opts: {
  publicationId: string;
  file: File;
}): Promise<AttachmentRow> {
  const { publicationId, file } = opts;
  if (!publicationId) {
    throw new Error("Select a publication before adding library files.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`File too large (max ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB).`);
  }
  if (!ACCEPTED_MIME.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}.`);
  }

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload library files.");

  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const path = `${uid}/_library/${publicationId}/${Date.now()}-${safe}`;

  const up = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;

  const extracted = isWordDoc(file.type) ? await extractDocxText(file) : null;

  const insert = await supabase
    .from("issue_attachments")
    .insert({
      issue_id: null,
      user_id: uid,
      publication_id: publicationId,
      page_id: null,
      kind: "library",
      file_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      extracted_text: extracted,
    })
    .select("*")
    .single();
  if (insert.error) throw insert.error;
  return insert.data as AttachmentRow;
}

