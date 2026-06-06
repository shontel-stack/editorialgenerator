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

const PREFIX = "pageluxe.syncqueue.v1";

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

function writeAll<T>(userId: string | null | undefined, items: SyncQueueItem<T>[]): void {
  try {
    localStorage.setItem(queueKey(userId), JSON.stringify(items));
  } catch {
    // localStorage may be full or unavailable; drop silently.
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
  writeAll(userId, filtered);
}

export function removeFromQueue(userId: string | null | undefined, id: string): void {
  const items = readAll(userId);
  writeAll(
    userId,
    items.filter((i) => i.id !== id),
  );
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
  writeAll(userId, items);
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
