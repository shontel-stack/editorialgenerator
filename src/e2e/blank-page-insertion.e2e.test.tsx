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
import { describe, it, expect } from "vitest";
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
});
