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

export type AttachmentRow = {
  id: string;
  issue_id: string;
  page_id: string | null;
  kind: "template" | "reference";
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string | null;
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

export async function listAttachments(issueId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from("issue_attachments")
    .select("*")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AttachmentRow[];
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
  pageId: string | null;
  kind: "template" | "reference";
  file: File;
}): Promise<AttachmentRow> {
  const { issueId, pageId, kind, file } = opts;
  if (!issueId || issueId.length < 8) {
    throw new Error("Issue is still initializing. Reload the page and try again.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`File too large (max ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB).`);
  }
  if (!ACCEPTED_MIME.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}.`);
  }

  // Remove any existing attachment with the same unique scope.
  const existing = await supabase
    .from("issue_attachments")
    .select("id, file_path")
    .eq("issue_id", issueId)
    .eq("kind", kind)
    .filter("page_id", pageId === null ? "is" : "eq", pageId === null ? null : pageId);
  if (existing.data?.length) {
    const paths = existing.data.map((r) => r.file_path);
    await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
    await supabase
      .from("issue_attachments")
      .delete()
      .in("id", existing.data.map((r) => r.id));
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
