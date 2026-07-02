/**
 * Persistent offline sync queue for issue-draft uploads.
 *
 * When a cloud push fails (network down, server unreachable, transient
 * error), we stash the snapshot in localStorage so it survives reloads
 * and gets retried automatically once the device is back online.
 *
 * Dedup strategy: one entry per (userId, issueId). A newer enqueue
 * replaces an older pending one — only the latest snapshot matters.
 */

import { toast } from "sonner";

const PREFIX = "pageluxe.syncqueue.v1";

/** Refuse to queue any single item whose serialized form is larger than this. */
const MAX_QUEUE_ITEM_BYTES = 2 * 1024 * 1024; // 2 MB

export interface SyncQueueItem<T = unknown> {
  id: string; // stable per (issueId)
  issueId: string;
  publicationId: string | null;
  issueLabel: string | null;
  data: T;
  clientUpdatedAt: number; // epoch ms
  attempts: number;
  lastError?: string;
  queuedAt: number;
}

function queueKey(userId: string | null | undefined): string {
  return `${PREFIX}:${userId ?? "anon"}`;
}

function readAll<T>(userId: string | null | undefined): SyncQueueItem<T>[] {
  try {
    const raw = localStorage.getItem(queueKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SyncQueueItem<T>[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22)
  );
}

/**
 * Write the queue. Throws on failure (quota exceeded or storage unavailable)
 * so callers can decide whether to warn the user — silently dropping the
 * offline backup would strand their edits if they close the tab before
 * network returns.
 */
function writeAll<T>(userId: string | null | undefined, items: SyncQueueItem<T>[]): void {
  try {
    localStorage.setItem(queueKey(userId), JSON.stringify(items));
  } catch (err) {
    if (isQuotaError(err)) {
      toast.error("Offline backup couldn't be saved", {
        id: "syncqueue-quota",
        description:
          "Browser storage is full, so unsent changes can't survive a reload. Stay online until sync finishes.",
      });
    } else {
      toast.error("Offline backup unavailable", {
        id: "syncqueue-write",
        description: "Stay online until your changes finish syncing.",
      });
    }
    throw err;
  }
}

export function listQueue<T = unknown>(userId: string | null | undefined): SyncQueueItem<T>[] {
  return readAll<T>(userId);
}

export function queueSize(userId: string | null | undefined): number {
  return readAll(userId).length;
}

export function enqueueDraft<T>(
  userId: string | null | undefined,
  item: Omit<SyncQueueItem<T>, "id" | "attempts" | "queuedAt"> & { attempts?: number; lastError?: string },
): void {
  // Size guard: a single snapshot bigger than the cap almost certainly means
  // leftover base64 image data. Queueing it will just blow localStorage on
  // the next write.
  let serializedSize = 0;
  try {
    serializedSize = JSON.stringify(item.data ?? null).length;
  } catch {
    serializedSize = 0;
  }
  if (serializedSize > MAX_QUEUE_ITEM_BYTES) {
    console.warn(
      `[syncQueue] Refusing to queue oversized item (${(serializedSize / 1024).toFixed(0)} KB) ` +
        `for issue ${item.issueId}`,
    );
    toast.error("Offline backup skipped for this change", {
      id: "syncqueue-oversize",
      description:
        "This edit is too large to store offline. Stay online until sync completes so it isn't lost.",
    });
    return;
  }

  const items = readAll<T>(userId);
  const id = item.issueId;
  const next: SyncQueueItem<T> = {
    id,
    issueId: item.issueId,
    publicationId: item.publicationId,
    issueLabel: item.issueLabel,
    data: item.data,
    clientUpdatedAt: item.clientUpdatedAt,
    attempts: item.attempts ?? 0,
    lastError: item.lastError,
    queuedAt: Date.now(),
  };
  // Replace existing entry for the same issue with the newer snapshot.
  const filtered = items.filter((i) => i.id !== id);
  filtered.push(next);
  try {
    writeAll(userId, filtered);
  } catch {
    // Toast already shown by writeAll. Swallow so autosave callers aren't
    // forced to handle it — the cloud push itself will retry.
  }
}

export function removeFromQueue(userId: string | null | undefined, id: string): void {
  const items = readAll(userId);
  try {
    writeAll(
      userId,
      items.filter((i) => i.id !== id),
    );
  } catch {
    // ignore — removal failing just means the entry stays and will be
    // deduped/replaced on the next successful write.
  }
}

export function markAttempt(
  userId: string | null | undefined,
  id: string,
  error?: string,
): void {
  const items = readAll(userId);
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  items[idx] = {
    ...items[idx],
    attempts: items[idx].attempts + 1,
    lastError: error,
  };
  try {
    writeAll(userId, items);
  } catch {
    // ignore — attempt counter is best-effort telemetry.
  }
}

export function clearQueue(userId: string | null | undefined): void {
  try {
    localStorage.removeItem(queueKey(userId));
  } catch {
    // ignore
  }
}

/** Cross-tab listener for queue changes (storage event). */
export function subscribeQueue(
  userId: string | null | undefined,
  cb: () => void,
): () => void {
  const key = queueKey(userId);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
