import { useCallback, useEffect, useState } from "react";
import {
  deleteAttachment,
  listAttachments,
  signAttachmentUrl,
  uploadAttachment,
  type AttachmentRow,
  type AttachmentWithUrl,
} from "@/lib/attachments";

export function useIssueAttachments(issueId: string) {
  const [rows, setRows] = useState<AttachmentWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(async (raw: AttachmentRow[]) => {
    const withUrls = await Promise.all(
      raw.map(async (r) => ({ ...r, signedUrl: await signAttachmentUrl(r.file_path) })),
    );
    setRows(withUrls);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await listAttachments(issueId);
      await hydrate(raw);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [issueId, hydrate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (args: { pageId: string | null; kind: "template" | "reference"; file: File }) => {
      try {
        await uploadAttachment({ issueId, ...args });
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    },
    [issueId, refresh],
  );

  const remove = useCallback(
    async (row: AttachmentRow) => {
      await deleteAttachment(row);
      await refresh();
    },
    [refresh],
  );

  const template = rows.find((r) => r.kind === "template") ?? null;
  const referencesByPage = new Map<string, AttachmentWithUrl>();
  for (const r of rows) {
    if (r.kind === "reference" && r.page_id) referencesByPage.set(r.page_id, r);
  }

  return { rows, template, referencesByPage, loading, error, refresh, upload, remove };
}
