/**
 * Module-level registry of "unsaved changes" guards. Components register a
 * function that returns a reason string when there is unsaved work, and an
 * optional saver. Navigation actions (e.g. switching publication) call
 * `confirmDiscardUnsaved()` which shows a custom prompt with
 * Cancel / Discard / Save draft & continue.
 */

export type GuardFn = () => string | null;
export type SaverFn = () => void | Promise<void>;

export interface UnsavedGuard {
  getReason: GuardFn;
  save?: SaverFn;
}

const guards = new Set<UnsavedGuard>();

export function registerUnsavedGuard(guard: UnsavedGuard): () => void {
  guards.add(guard);
  return () => {
    guards.delete(guard);
  };
}

export function getUnsavedReasons(): string[] {
  const reasons: string[] = [];
  for (const g of guards) {
    try {
      const r = g.getReason();
      if (r) reasons.push(r);
    } catch {
      // ignore guard errors
    }
  }
  return reasons;
}

function getDirtyGuards(): UnsavedGuard[] {
  const dirty: UnsavedGuard[] = [];
  for (const g of guards) {
    try {
      if (g.getReason()) dirty.push(g);
    } catch {
      // ignore
    }
  }
  return dirty;
}

export async function runUnsavedSavers(): Promise<void> {
  const dirty = getDirtyGuards();
  for (const g of dirty) {
    if (g.save) {
      await g.save();
    }
  }
}

export function hasAnySaver(): boolean {
  return getDirtyGuards().some((g) => Boolean(g.save));
}

// --- Prompt host bridge -----------------------------------------------------

export type UnsavedPromptChoice = "cancel" | "discard" | "save";

export interface UnsavedPromptRequest {
  action: string;
  reasons: string[];
  canSave: boolean;
  resolve: (choice: UnsavedPromptChoice) => void;
}

type Listener = (req: UnsavedPromptRequest) => void;
let promptListener: Listener | null = null;

export function setUnsavedPromptListener(l: Listener | null) {
  promptListener = l;
}

/**
 * Returns true if it's safe to proceed (no unsaved work, user chose to
 * discard, or user chose to save and the savers completed).
 */
export async function confirmDiscardUnsaved(action = "switch"): Promise<boolean> {
  const reasons = getUnsavedReasons();
  if (reasons.length === 0) return true;

  const canSave = hasAnySaver();

  // Fallback if no custom host is mounted (shouldn't happen in-app).
  if (!promptListener) {
    const message =
      `You have unsaved changes:\n\n• ${reasons.join("\n• ")}\n\n` +
      `Continue and ${action} anyway? Unsaved changes will be lost.`;
    return window.confirm(message);
  }

  const choice = await new Promise<UnsavedPromptChoice>((resolve) => {
    promptListener!({ action, reasons, canSave, resolve });
  });

  if (choice === "cancel") return false;
  if (choice === "discard") return true;
  try {
    await runUnsavedSavers();
    return true;
  } catch (e) {
    window.alert(`Could not save draft: ${(e as Error).message}`);
    return false;
  }
}
