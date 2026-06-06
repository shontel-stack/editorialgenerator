import type { IssueDoc, IssuePageNode } from "@/lib/coverDefaults";
import { hashOf } from "@/lib/issueSyncBaseline";

export interface ConflictSide {
  data: IssueDoc;
  /** Epoch ms the snapshot was last edited on its source. */
  ts: number;
}

export type ConflictKind =
  | "none" // nothing to restore
  | "agree" // local and remote serialize identically
  | "local-only" // only local diverged from baseline (or no remote)
  | "remote-only" // only remote diverged from baseline (or no local)
  | "conflict"; // both diverged from baseline

export interface ConflictDetection {
  kind: ConflictKind;
  /**
   * Best single-side winner when no UI is needed. For `conflict`, this is the
   * timestamp-based fallback we'd use if the user dismissed the dialog.
   */
  winner: ConflictSide | null;
}

/**
 * Compare a local autosave and a cloud draft against the last-known-good
 * baseline (the hash of whatever was last in sync everywhere) and decide
 * whether we have a true conflict or just one-sided drift.
 */
export function detectConflict(
  local: ConflictSide | null,
  remote: ConflictSide | null,
  baselineHash: string | null,
): ConflictDetection {
  if (!local && !remote) return { kind: "none", winner: null };
  if (local && !remote) return { kind: "local-only", winner: local };
  if (!local && remote) return { kind: "remote-only", winner: remote };

  const lh = hashOf(local!.data);
  const rh = hashOf(remote!.data);
  if (lh === rh) {
    return {
      kind: "agree",
      winner: remote!.ts >= local!.ts ? remote! : local!,
    };
  }

  // No baseline → we can't tell who diverged, so treat anything non-equal as
  // a conflict so the user gets a choice instead of a silent overwrite.
  if (!baselineHash) {
    return {
      kind: "conflict",
      winner: remote!.ts >= local!.ts ? remote! : local!,
    };
  }

  const localDiverged = lh !== baselineHash;
  const remoteDiverged = rh !== baselineHash;
  if (localDiverged && !remoteDiverged) {
    return { kind: "local-only", winner: local! };
  }
  if (!localDiverged && remoteDiverged) {
    return { kind: "remote-only", winner: remote! };
  }
  if (!localDiverged && !remoteDiverged) {
    // Both equal baseline but hashes differ — shouldn't happen, but be safe.
    return {
      kind: "agree",
      winner: remote!.ts >= local!.ts ? remote! : local!,
    };
  }
  return {
    kind: "conflict",
    winner: remote!.ts >= local!.ts ? remote! : local!,
  };
}

/**
 * Best-effort 3-way-ish merge that unions pages by `id`, preferring the
 * "newer" side's version of any page that exists in both. Top-level meta and
 * font/palette settings come from the newer side too, since they're scalar
 * fields where last-write-wins is the only sensible default.
 */
export function mergeIssues(
  local: IssueDoc,
  remote: IssueDoc,
  preferNewer: "local" | "remote",
): IssueDoc {
  const primary = preferNewer === "remote" ? remote : local;
  const secondary = preferNewer === "remote" ? local : remote;
  const seen = new Set<string>();
  const pages: IssuePageNode[] = [];
  for (const p of primary.pages) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      pages.push(p);
    }
  }
  for (const p of secondary.pages) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      pages.push(p);
    }
  }
  return { ...primary, pages };
}
