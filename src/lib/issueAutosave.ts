/**
 * Autosave helpers for the in-progress IssueDoc.
 *
 * The issue document is purely client-side state, so we persist a JSON
 * snapshot in localStorage keyed by user + issueId. This survives reloads
 * and lets us show a "Saved" status indicator in the editor toolbar.
 */

const PREFIX = "pageluxe.autosave.v1";

export interface AutosaveRecord<T = unknown> {
  savedAt: number; // epoch ms
  data: T;
}

export function autosaveKey(userId: string | null | undefined, issueId: string): string {
  return `${PREFIX}:${userId ?? "anon"}:${issueId}`;
}

export function loadAutosave<T = unknown>(key: string): AutosaveRecord<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutosaveRecord<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || !("data" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAutosave<T = unknown>(key: string, data: T): AutosaveRecord<T> {
  const record: AutosaveRecord<T> = { savedAt: Date.now(), data };
  localStorage.setItem(key, JSON.stringify(record));
  return record;
}

export function clearAutosave(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const LAST_ID_PREFIX = "pageluxe.lastIssue.v1";

export function lastIssueIdKey(userId: string | null | undefined): string {
  return `${LAST_ID_PREFIX}:${userId ?? "anon"}`;
}

export function loadLastIssueId(userId: string | null | undefined): string | null {
  try {
    return localStorage.getItem(lastIssueIdKey(userId));
  } catch {
    return null;
  }
}

export function saveLastIssueId(userId: string | null | undefined, issueId: string): void {
  try {
    localStorage.setItem(lastIssueIdKey(userId), issueId);
  } catch {
    // ignore
  }
}
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
