// Storage helper for per-page background artwork. Uses the existing
// `issue-attachments` bucket (RLS already scopes by owner) and writes under
// a dedicated `bg/` folder so background art doesn't show up in the regular
// attachments panel.
import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";

export type BackgroundUploadResult = {
  url: string;
  path: string;
  width: number;
  height: number;
};

/** Upload a rendered PNG (or raw image) blob and return a signed URL. */
export async function uploadPageBackground(opts: {
  issueId: string;
  pageId: string;
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
}): Promise<BackgroundUploadResult> {
  const { issueId, pageId, blob, fileName, width, height } = opts;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You must be signed in to upload backgrounds.");
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const path = `${uid}/${issueId}/bg/${pageId}/${Date.now()}-${safe}`;
  const up = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
  if (up.error) throw up.error;
  const signed = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
  if (signed.error) throw signed.error;
  return { url: signed.data.signedUrl, path, width, height };
}

/** Refresh a signed URL for a previously uploaded background. */
export async function resignBackground(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteBackground(path: string): Promise<void> {
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
}

export async function loadImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Unable to read image dimensions"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
