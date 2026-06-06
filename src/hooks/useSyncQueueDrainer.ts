import { useCallback, useEffect, useRef, useState } from "react";
import {
  listQueue,
  markAttempt,
  removeFromQueue,
  subscribeQueue,
  type SyncQueueItem,
} from "@/lib/syncQueue";

export interface UseSyncQueueDrainerOptions<T> {
  userId: string | null | undefined;
  /** Upload a single queued snapshot. Resolves on success, throws on failure. */
  push: (item: SyncQueueItem<T>) => Promise<void>;
  /** Poll interval (ms) used as a fallback when 'online' events don't fire. Default 30s. */
  pollMs?: number;
  /** Max attempts before an item is dropped to avoid poisoning the queue. Default 8. */
  maxAttempts?: number;
}

export interface UseSyncQueueDrainerResult {
  pending: number;
  draining: boolean;
  lastError: string | null;
  /** Drain on demand (e.g. from a "Retry" button). */
  drainNow: () => void;
}

/**
 * Watches the offline sync queue and drains it whenever the network is
 * available. Re-tries with exponential-ish behavior via attempt count.
 */
export function useSyncQueueDrainer<T>(
  opts: UseSyncQueueDrainerOptions<T>,
): UseSyncQueueDrainerResult {
  const { userId, push, pollMs = 30_000, maxAttempts = 8 } = opts;
  const [pending, setPending] = useState(0);
  const [draining, setDraining] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const drainingRef = useRef(false);
  const pushRef = useRef(push);
  pushRef.current = push;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refreshCount = useCallback(() => {
    setPending(listQueue(userIdRef.current).length);
  }, []);

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const uid = userIdRef.current;
    if (!uid) return;
    const items = listQueue<T>(uid);
    if (items.length === 0) return;

    drainingRef.current = true;
    setDraining(true);
    try {
      // Oldest queuedAt first.
      const ordered = [...items].sort((a, b) => a.queuedAt - b.queuedAt);
      for (const item of ordered) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) break;
        try {
          await pushRef.current(item);
          removeFromQueue(uid, item.id);
          setLastError(null);
        } catch (e) {
          const msg = (e as Error).message ?? "Upload failed";
          markAttempt(uid, item.id, msg);
          setLastError(msg);
          if (item.attempts + 1 >= maxAttempts) {
            // Give up on poisoned item so the queue can keep flowing.
            removeFromQueue(uid, item.id);
          } else {
            // Stop draining on first failure; next online/poll tick retries.
            break;
          }
        } finally {
          refreshCount();
        }
      }
    } finally {
      drainingRef.current = false;
      setDraining(false);
      refreshCount();
    }
  }, [maxAttempts, refreshCount]);

  // Initial count + subscribe to cross-tab queue changes.
  useEffect(() => {
    refreshCount();
    const unsub = subscribeQueue(userId, refreshCount);
    return unsub;
  }, [userId, refreshCount]);

  // Drain on mount, on online events, and on a fallback poll.
  useEffect(() => {
    void drain();
    const onOnline = () => {
      void drain();
    };
    window.addEventListener("online", onOnline);
    const onVisible = () => {
      if (document.visibilityState === "visible") void drain();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      void drain();
    }, pollMs);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [drain, pollMs, userId]);

  return {
    pending,
    draining,
    lastError,
    drainNow: () => void drain(),
  };
}
