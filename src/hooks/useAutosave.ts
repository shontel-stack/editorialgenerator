import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loadAutosave, saveAutosave, type AutosaveRecord } from "@/lib/issueAutosave";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface UseAutosaveOptions {
  /** Storage key. When null/empty, autosave is paused. */
  key: string | null;
  /** Debounce after the last change before writing. Default 1500ms. */
  debounceMs?: number;
  /** Force-flush ceiling: write even if edits keep streaming. Default 8000ms. */
  maxIntervalMs?: number;
  /** Pause writes (e.g. while restoring). */
  paused?: boolean;
}

export interface UseAutosaveResult {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  saveNow: () => void;
}

/**
 * Serialize `value` (typically a large editor document) to JSON and persist
 * it via localStorage on a debounced cadence. Exposes a status suitable for
 * a "Saved/Saving" indicator.
 */
export function useAutosave<T>(value: T, opts: UseAutosaveOptions): UseAutosaveResult {
  const { key, debounceMs = 1500, maxIntervalMs = 8000, paused = false } = opts;
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const lastSerializedRef = useRef<string>("");
  const lastWriteAtRef = useRef<number>(0);
  const firstDirtyAtRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef<T>(value);
  valueRef.current = value;
  const keyRef = useRef<string | null>(key);
  keyRef.current = key;

  // Initialize baseline when the key changes (new issue / user).
  useEffect(() => {
    if (!key) {
      setStatus("idle");
      setLastSavedAt(null);
      lastSerializedRef.current = "";
      return;
    }
    const existing = loadAutosave(key) as AutosaveRecord<T> | null;
    // Seed baseline so we don't autosave an unchanged restored doc.
    try {
      lastSerializedRef.current = JSON.stringify(valueRef.current);
    } catch {
      lastSerializedRef.current = "";
    }
    if (existing) {
      setLastSavedAt(existing.savedAt);
      setStatus("saved");
    } else {
      setLastSavedAt(null);
      setStatus("idle");
    }
    firstDirtyAtRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const flush = () => {
    if (!keyRef.current) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(valueRef.current);
    } catch {
      setStatus("error");
      return;
    }
    if (serialized === lastSerializedRef.current) {
      setStatus((s) => (s === "saving" || s === "dirty" ? "saved" : s));
      return;
    }
    try {
      const rec = saveAutosave(keyRef.current, valueRef.current);
      lastSerializedRef.current = serialized;
      lastWriteAtRef.current = rec.savedAt;
      firstDirtyAtRef.current = null;
      setLastSavedAt(rec.savedAt);
      setStatus("saved");
    } catch (err) {
      const isQuota =
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          err.code === 22);
      if (isQuota) {
        toast.error("Autosave paused: browser storage is full", {
          description:
            "Recent edits couldn't be saved locally. Cloud sync is still running — try removing large embedded images.",
          id: "autosave-quota",
        });
      }
      setStatus("error");
    }
  };

  // Watch value -> schedule a debounced write.
  useEffect(() => {
    if (!key || paused) return;
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      return;
    }
    if (serialized === lastSerializedRef.current) return;

    if (firstDirtyAtRef.current == null) firstDirtyAtRef.current = Date.now();
    setStatus("dirty");

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const dirtyAge = Date.now() - (firstDirtyAtRef.current ?? Date.now());
    const wait = Math.max(0, Math.min(debounceMs, maxIntervalMs - dirtyAge));

    debounceTimerRef.current = setTimeout(() => {
      setStatus("saving");
      // Defer one tick so the UI can render "Saving…".
      setTimeout(flush, 0);
    }, wait);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, key, paused, debounceMs, maxIntervalMs]);

  // Flush on unmount / page hide.
  useEffect(() => {
    const onHide = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      flush();
    };
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
    return () => {
      window.removeEventListener("beforeunload", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    lastSavedAt,
    saveNow: () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setStatus("saving");
      setTimeout(flush, 0);
    },
  };
}
