/**
 * Last-known-good sync baseline for an issue draft.
 *
 * Tracks the snapshot we most recently confirmed was in sync between the
 * local autosave and the cloud copy (i.e. the value we last successfully
 * pushed, or that we last pulled and accepted). This lets the restore step
 * tell the difference between:
 *
 *   - "only local changed since baseline"  → safe to keep local
 *   - "only cloud changed since baseline"  → safe to take cloud
 *   - "BOTH changed since baseline"        → real conflict; ask the user
 *
 * Stored per (user, issueId) in localStorage, alongside the autosave record.
 */

const PREFIX = "pageluxe.syncbaseline.v1";

export interface SyncBaseline {
  /** Epoch ms when the baseline was captured (server time when possible). */
  syncedAt: number;
  /** Stable hash of the JSON snapshot that is in sync everywhere. */
  hash: string;
}

export function baselineKey(
  userId: string | null | undefined,
  issueId: string,
): string {
  return `${PREFIX}:${userId ?? "anon"}:${issueId}`;
}

export function loadBaseline(key: string): SyncBaseline | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncBaseline;
    if (
      !parsed ||
      typeof parsed.syncedAt !== "number" ||
      typeof parsed.hash !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveBaseline(key: string, baseline: SyncBaseline): void {
  try {
    localStorage.setItem(key, JSON.stringify(baseline));
  } catch {
    // ignore quota / serialization errors
  }
}

export function clearBaseline(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Fast, stable 32-bit FNV-1a hash over a JSON serialization of `value`.
 *
 * We don't need a cryptographic hash — just something cheap and consistent
 * to compare two snapshots for equality without storing the full doc twice.
 */
export function hashOf(value: unknown): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return "";
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    h ^= serialized.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
