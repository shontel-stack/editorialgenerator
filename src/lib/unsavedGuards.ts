/**
 * Module-level registry of "unsaved changes" guards. Components register a
 * function that returns a reason string when there is unsaved work, or null
 * otherwise. Navigation actions (e.g. switching publication) call
 * `confirmDiscardUnsaved()` before proceeding.
 */

type GuardFn = () => string | null;

const guards = new Set<GuardFn>();

export function registerUnsavedGuard(fn: GuardFn): () => void {
  guards.add(fn);
  return () => {
    guards.delete(fn);
  };
}

export function getUnsavedReasons(): string[] {
  const reasons: string[] = [];
  for (const g of guards) {
    try {
      const r = g();
      if (r) reasons.push(r);
    } catch {
      // ignore guard errors
    }
  }
  return reasons;
}

/** Returns true if it's safe to proceed (no unsaved work, or user confirmed). */
export function confirmDiscardUnsaved(action = "switch"): boolean {
  const reasons = getUnsavedReasons();
  if (reasons.length === 0) return true;
  const message =
    `You have unsaved changes:\n\n• ${reasons.join("\n• ")}\n\n` +
    `Continue and ${action} anyway? Unsaved changes will be lost.`;
  return window.confirm(message);
}
