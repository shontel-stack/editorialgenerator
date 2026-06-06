import { useEffect, useRef, useState } from "react";

export type CloudSyncStatus = "idle" | "dirty" | "syncing" | "synced" | "error" | "offline";

export interface UseCloudSyncOptions<T> {
  /** Stable identifier for the doc being synced. Null pauses sync. */
  key: string | null;
  /** Current value to mirror. */
  value: T;
  /** Debounce after the last edit before pushing to the cloud. Default 4000ms. */
  debounceMs?: number;
  /** Pause writes (e.g. while restoring from cloud/local). */
  paused?: boolean;
  /** Persist the value remotely; resolves with the canonical server timestamp (ms). */
  push: (value: T) => Promise<number>;
}

export interface UseCloudSyncResult {
  status: CloudSyncStatus;
  lastSyncedAt: number | null;
  /** Last error message, if status === "error". */
  error: string | null;
  /** Force an immediate push. */
  syncNow: () => void;
}

/**
 * Mirror a client document to a remote store on a debounced cadence.
 * Independent of localStorage autosave: this is the "cloud" side of the
 * sync, so a saved-everywhere state is local-saved AND cloud-synced.
 */
export function useCloudSync<T>(opts: UseCloudSyncOptions<T>): UseCloudSyncResult {
  const { key, value, debounceMs = 4000, paused = false, push } = opts;
  const [status, setStatus] = useState<CloudSyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastSerializedRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const valueRef = useRef<T>(value);
  valueRef.current = value;
  const pushRef = useRef(push);
  pushRef.current = push;
  const keyRef = useRef<string | null>(key);
  keyRef.current = key;

  // Reset baseline when the doc identity changes.
  useEffect(() => {
    try {
      lastSerializedRef.current = JSON.stringify(valueRef.current);
    } catch {
      lastSerializedRef.current = "";
    }
    setStatus("idle");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const flush = async () => {
    if (!keyRef.current || inFlightRef.current) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(valueRef.current);
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
      return;
    }
    if (serialized === lastSerializedRef.current && status === "synced") return;

    inFlightRef.current = true;
    setStatus("syncing");
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus("offline");
        return;
      }
      const ts = await pushRef.current(valueRef.current);
      lastSerializedRef.current = serialized;
      setLastSyncedAt(ts);
      setError(null);
      setStatus("synced");
    } catch (e) {
      setError((e as Error).message ?? "Sync failed");
      setStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  };

  // Schedule debounced pushes when value changes.
  useEffect(() => {
    if (!key || paused) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return;
    }
    if (serialized === lastSerializedRef.current) return;
    setStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void flush();
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, key, paused, debounceMs]);

  // Retry when the network comes back.
  useEffect(() => {
    const onOnline = () => {
      if (status === "offline" || status === "error" || status === "dirty") {
        void flush();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return {
    status,
    lastSyncedAt,
    error,
    syncNow: () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      void flush();
    },
  };
}
