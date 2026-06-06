import { useCallback, useEffect, useState } from "react";
import {
  deleteAttachment,
  listLibraryAttachments,
  signAttachmentUrl,
  uploadLibraryAttachment,
  type AttachmentRow,
  type AttachmentWithUrl,
} from "@/lib/attachments";

export function useLibraryAttachments(publicationId: string | null) {
  const [rows, setRows] = useState<AttachmentWithUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicationId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const raw = await listLibraryAttachments(publicationId);
      const hydrated = await Promise.all(
        raw.map(async (r) => ({ ...r, signedUrl: await signAttachmentUrl(r.file_path) })),
      );
      setRows(hydrated);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [publicationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      if (!publicationId) throw new Error("Select a publication first.");
      await uploadLibraryAttachment({ publicationId, file });
      await refresh();
    },
    [publicationId, refresh],
  );

  const remove = useCallback(
    async (row: AttachmentRow) => {
      await deleteAttachment(row);
      await refresh();
    },
    [refresh],
  );

  return { rows, loading, error, refresh, upload, remove };
}
