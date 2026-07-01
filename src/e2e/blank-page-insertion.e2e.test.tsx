/**
 * End-to-end test: inserting a DEFAULT_BLANK page must never crash the
 * editor, and the resulting page list must never contain undefined nodes.
 *
 * This exercises BOTH insertion code paths a user can trigger:
 *   1. The AI-assistant patch pipeline: applyPatch({ kind: "add_page",
 *      pageType: "blank" }) in src/lib/issue-patch.ts.
 *   2. The +Add toolbar in the editor: makeNode("blank", { ...DEFAULT_BLANK },
 *      false) in src/routes/_authenticated/index.lazy.tsx (line ~1183).
 *
 * After each insertion we render every resulting page through <PagePreview />
 * to prove the editor's actual render path does not throw for any page in
 * the list — the same guarantee the running editor needs.
 */
import * as React from "react";

// jsdom lacks ResizeObserver; some components in the render tree use it.
if (typeof globalThis.ResizeObserver === "undefined") {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
}

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { applyPatch } from "@/lib/issue-patch";
import {
  DEFAULT_BLANK,
  makeDefaultIssue,
  makeNode,
  type IssueDoc,
  type IssuePageNode,
} from "@/lib/coverDefaults";
import { PagePreview } from "@/components/PagePreview";

/** Mirrors the +Add toolbar's insert-before-back-cover logic. */
function editorAddBlank(issue: IssueDoc): IssueDoc {
  const node = makeNode("blank", { ...DEFAULT_BLANK }, false);
  const backIdx = issue.pages.findIndex((p) => p.pageType === "back");
  const insertAt = backIdx < 0 ? issue.pages.length : backIdx;
  const next = [...issue.pages];
  next.splice(insertAt, 0, node);
  return { ...issue, pages: next };
}

/** Renders every page in the issue via <PagePreview />, asserts no throw. */
function renderAllPages(pages: IssuePageNode[]) {
  expect(pages.every((p) => p != null && p.pageType != null)).toBe(true);
  for (const p of pages) {
    // If PagePreview ever throws for a page's data (e.g. undefined data,
    // missing palette) this render() call will surface the error and fail
    // the test — the same crash the editor would show.
    const { unmount } = render(
      <PagePreview pageType={p.pageType} data={p.data} />,
    );
    unmount();
  }
}

describe("e2e: inserting DEFAULT_BLANK never crashes the editor", () => {
  afterEach(() => cleanup());

  it("applyPatch add_page/blank keeps the list valid and renderable", () => {
    let issue = makeDefaultIssue();
    for (let i = 0; i < 5; i++) {
      issue = applyPatch(issue, { kind: "add_page", pageType: "blank" });
      expect(issue.pages.every((p) => p !== undefined && p !== null)).toBe(true);
      expect(() => renderAllPages(issue.pages)).not.toThrow();
    }
    expect(issue.pages.filter((p) => p.pageType === "blank").length).toBe(5);
  });

  it("editor +Add toolbar path (makeNode blank) keeps the list valid and renderable", () => {
    let issue = makeDefaultIssue();
    for (let i = 0; i < 5; i++) {
      issue = editorAddBlank(issue);
      expect(issue.pages.every((p) => p !== undefined && p !== null)).toBe(true);
      expect(() => renderAllPages(issue.pages)).not.toThrow();
    }
    const blanks = issue.pages.filter((p) => p.pageType === "blank");
    expect(blanks.length).toBe(5);
    // Each blank has its own object identity + a fresh id.
    expect(new Set(blanks.map((b) => b.id)).size).toBe(5);
  });

  it("interleaved applyPatch + editor insertions never yield an undefined node", () => {
    let issue = makeDefaultIssue();
    for (let i = 0; i < 6; i++) {
      issue =
        i % 2 === 0
          ? applyPatch(issue, { kind: "add_page", pageType: "blank" })
          : editorAddBlank(issue);
      expect(
        issue.pages.every(
          (p) => p !== undefined && p !== null && p.data != null,
        ),
      ).toBe(true);
    }
    expect(() => renderAllPages(issue.pages)).not.toThrow();
    expect(issue.pages.filter((p) => p.pageType === "blank").length).toBe(6);
    // Cover stays first; back (if any) stays last.
    expect(issue.pages[0].pageType).toBe("cover");
    const backIdx = issue.pages.findIndex((p) => p.pageType === "back");
    if (backIdx >= 0) expect(backIdx).toBe(issue.pages.length - 1);
  });

  it("rapid-fire burst of DEFAULT_BLANK insertions keeps the list crash-free", () => {
    // Simulate a user (or the assistant) mashing "Add blank page" as fast as
    // possible: no awaits, no intermediate renders — one synchronous burst.
    let issue = makeDefaultIssue();
    const BURST = 50;
    const initialLen = issue.pages.length;

    for (let i = 0; i < BURST; i++) {
      issue =
        i % 3 === 0
          ? applyPatch(issue, { kind: "add_page", pageType: "blank" })
          : editorAddBlank(issue);
    }

    // No undefined/null nodes and every node has data.
    expect(issue.pages.length).toBe(initialLen + BURST);
    expect(
      issue.pages.every(
        (p) => p !== undefined && p !== null && p.pageType != null && p.data != null,
      ),
    ).toBe(true);

    // All blank ids are unique — no shared references across insertions.
    const blanks = issue.pages.filter((p) => p.pageType === "blank");
    expect(blanks.length).toBe(BURST);
    expect(new Set(blanks.map((b) => b.id)).size).toBe(BURST);
    // And no two blanks share the same data object identity.
    expect(new Set(blanks.map((b) => b.data)).size).toBe(BURST);

    // Structural invariants preserved.
    expect(issue.pages[0].pageType).toBe("cover");
    const backIdx = issue.pages.findIndex((p) => p.pageType === "back");
    if (backIdx >= 0) expect(backIdx).toBe(issue.pages.length - 1);

    // Final render pass: the editor never crashes on the resulting list.
    expect(() => renderAllPages(issue.pages)).not.toThrow();
  });

  it("rapid bursts starting from a cover-only issue never produce undefined nodes", () => {
    // Edge case: no back cover present. Rapid inserts must still append safely.
    const base = makeDefaultIssue();
    const coverPage = base.pages.find((p) => p.pageType === "cover")!;
    let issue: IssueDoc = { ...base, pages: [coverPage] };
    for (let i = 0; i < 30; i++) {
      issue = applyPatch(issue, { kind: "add_page", pageType: "blank" });
      // Check EVERY step — a single undefined entry would crash the editor.
      for (const p of issue.pages) {
        expect(p).toBeDefined();
        expect(p).not.toBeNull();
        expect(p.pageType).toBeDefined();
        expect(p.data).toBeDefined();
      }
    }
    expect(issue.pages.length).toBe(31);
    expect(() => renderAllPages(issue.pages)).not.toThrow();
  });

  it("undo/redo after DEFAULT_BLANK inserts never crashes and yields no undefined nodes", () => {
    // Mirrors the editor's snapshot-based history: every mutation pushes the
    // previous IssueDoc onto `past`; undo pops from `past` onto `future`;
    // redo pops from `future` back onto `past`.
    const past: IssueDoc[] = [];
    const future: IssueDoc[] = [];
    let issue = makeDefaultIssue();

    const commit = (next: IssueDoc) => {
      past.push(issue);
      future.length = 0;
      issue = next;
    };
    const undo = () => {
      const prev = past.pop();
      if (!prev) return;
      future.push(issue);
      issue = prev;
    };
    const redo = () => {
      const next = future.pop();
      if (!next) return;
      past.push(issue);
      issue = next;
    };

    const assertClean = () => {
      for (const p of issue.pages) {
        expect(p).toBeDefined();
        expect(p).not.toBeNull();
        expect(p.pageType).toBeDefined();
        expect(p.data).toBeDefined();
      }
      expect(() => renderAllPages(issue.pages)).not.toThrow();
    };

    const initialLen = issue.pages.length;

    // Insert 6 blanks, alternating between the two insertion paths.
    for (let i = 0; i < 6; i++) {
      const next =
        i % 2 === 0
          ? applyPatch(issue, { kind: "add_page", pageType: "blank" })
          : editorAddBlank(issue);
      commit(next);
      assertClean();
    }
    expect(issue.pages.length).toBe(initialLen + 6);

    // Undo everything, one step at a time — never crash, never undefined.
    for (let i = 0; i < 6; i++) {
      undo();
      assertClean();
    }
    expect(issue.pages.length).toBe(initialLen);
    expect(issue.pages.some((p) => p.pageType === "blank" && !makeDefaultIssue().pages.some((d) => d.id === p.id))).toBe(false);

    // Redo everything back — must reach the same length and stay clean.
    for (let i = 0; i < 6; i++) {
      redo();
      assertClean();
    }
    expect(issue.pages.length).toBe(initialLen + 6);
    expect(issue.pages.filter((p) => p.pageType === "blank").length).toBe(6);

    // Interleaved undo/redo/insert — the pattern most likely to expose stale
    // references or shared mutable state.
    undo(); undo(); assertClean();
    commit(applyPatch(issue, { kind: "add_page", pageType: "blank" }));
    assertClean();
    // After a new commit, redo stack is cleared — redo must be a no-op.
    const lenAfterBranch = issue.pages.length;
    redo();
    expect(issue.pages.length).toBe(lenAfterBranch);
    assertClean();
    undo(); assertClean();
    redo(); assertClean();
  });
});
