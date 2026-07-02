/**
 * Shared helper for user-uploaded editor images.
 *
 * Storing raw base64 data URLs in the IssueDoc quickly blew past the
 * localStorage 5MB quota (autosave writes the whole doc as JSON). Instead we:
 *   1. Downscale to a sane max edge and compress to JPEG/WebP q≈0.85 on a canvas.
 *   2. Upload the resulting blob to the shared `issue-attachments` bucket
 *      (same RLS as page backgrounds).
 *   3. Store only the returned signed URL + storage path in the document.
 *   4. On load, detect any leftover `data:image/...` strings and migrate them.
 */
import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";

export const MAX_IMAGE_EDGE = 2400;
export const IMAGE_QUALITY = 0.85;
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

export type UploadedImage = {
  url: string;
  path: string;
  width: number;
  height: number;
};

async function loadHTMLImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Downscale + recompress an image blob/file. Returns a smaller JPEG (or PNG for transparency). */
export async function compressImage(
  input: Blob,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<{ blob: Blob; width: number; height: number; mime: string }> {
  const maxEdge = opts.maxEdge ?? MAX_IMAGE_EDGE;
  const quality = opts.quality ?? IMAGE_QUALITY;
  const url = URL.createObjectURL(input);
  try {
    const img = await loadHTMLImage(url);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    // Preserve alpha for PNGs; otherwise JPEG is much smaller.
    const keepAlpha = input.type === "image/png";
    const mime = keepAlpha ? "image/png" : "image/jpeg";
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");
    if (!keepAlpha) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, quality),
    );
    if (!blob) throw new Error("Failed to encode image");
    return { blob, width: w, height: h, mime };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convert a data:image/... URL to a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/png";
  const bin = atob(b64 ?? "");
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("You must be signed in to upload images.");
  return uid;
}

/** Downscale + upload an image blob/file into the shared attachments bucket. */
export async function uploadEditorImage(opts: {
  issueId: string;
  input: Blob;
  fileName?: string;
  folder?: string; // subfolder under `${uid}/${issueId}/img/`
}): Promise<UploadedImage> {
  const { issueId, input } = opts;
  const uid = await currentUserId();
  const { blob, width, height, mime } = await compressImage(input);
  const ext = mime === "image/png" ? "png" : "jpg";
  const baseName = (opts.fileName ?? "image").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
  const folder = opts.folder ? `${opts.folder}/` : "";
  const path = `${uid}/${issueId}/img/${folder}${Date.now()}-${baseName}.${ext}`;
  const up = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (up.error) throw up.error;
  const signed = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signed.error) throw signed.error;
  return { url: signed.data.signedUrl, path, width, height };
}

/** Re-sign a signed URL for a previously uploaded path. Returns null on failure. */
export async function resignImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data.signedUrl;
}

/** Recognise our own signed-URL path so we can re-sign on load. */
export function extractAttachmentPath(url: string | null | undefined): string | null {
  if (!url) return null;
  // Signed URL shape: .../storage/v1/object/sign/<bucket>/<path>?token=...
  const m = /\/object\/(?:sign|public)\/[^/]+\/([^?]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Walk an arbitrary JSON-serialisable value and replace every `data:image/...`
 * string with an uploaded storage URL. Returns { doc, migrated } — `migrated`
 * is true if anything changed so the caller can trigger a re-save.
 */
export async function migrateBase64Images<T>(
  doc: T,
  issueId: string,
): Promise<{ doc: T; migrated: number }> {
  let migrated = 0;

  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === "string") {
      if (v.startsWith("data:image/")) {
        try {
          const blob = dataUrlToBlob(v);
          const up = await uploadEditorImage({ issueId, input: blob, folder: "migrated" });
          migrated += 1;
          return up.url;
        } catch (err) {
          console.warn("[imageUpload] migration failed for one image", err);
          return v;
        }
      }
      return v;
    }
    if (Array.isArray(v)) {
      const out = new Array(v.length);
      for (let i = 0; i < v.length; i++) out[i] = await walk(v[i]);
      return out;
    }
    if (v && typeof v === "object") {
      const src = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(src)) out[k] = await walk(src[k]);
      return out;
    }
    return v;
  };

  const next = (await walk(doc)) as T;
  return { doc: next, migrated };
}
