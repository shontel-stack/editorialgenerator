import { describe, it, expect } from "vitest";
import { applyPatch, type IssuePatch } from "./issue-patch";
import { DEFAULT_BLANK, makeDefaultIssue } from "./coverDefaults";

describe("applyPatch add_page blank", () => {
  it("inserts a blank page using DEFAULT_BLANK data", () => {
    const issue = makeDefaultIssue();
    const before = issue.pages.length;
    const patch: IssuePatch = { kind: "add_page", pageType: "blank" };
    const next = applyPatch(issue, patch);

    expect(next.pages.length).toBe(before + 1);
    // No undefined/null entries
    expect(next.pages.every((p) => p != null)).toBe(true);

    const blanks = next.pages.filter((p) => p.pageType === "blank");
    expect(blanks.length).toBe(1);
    const blank = blanks[0]!;
    expect(blank.id).toBeTruthy();
    expect(blank.data).toEqual(DEFAULT_BLANK);
    // Ensure the data is a copy, not the shared default reference
    expect(blank.data).not.toBe(DEFAULT_BLANK);
  });

  it("inserts blank page before the back page", () => {
    const issue = makeDefaultIssue();
    const next = applyPatch(issue, { kind: "add_page", pageType: "blank" });
    const backIdx = next.pages.findIndex((p) => p.pageType === "back");
    const blankIdx = next.pages.findIndex((p) => p.pageType === "blank");
    if (backIdx >= 0) {
      expect(blankIdx).toBeLessThan(backIdx);
    } else {
      expect(blankIdx).toBe(next.pages.length - 1);
    }
  });

  it("never leaves undefined entries when adding each supported page type", () => {
    const types: Array<IssuePatch & { kind: "add_page" }> = [
      { kind: "add_page", pageType: "article" },
      { kind: "add_page", pageType: "photo" },
      { kind: "add_page", pageType: "ad" },
      { kind: "add_page", pageType: "contents" },
      { kind: "add_page", pageType: "custom-contents" },
      { kind: "add_page", pageType: "blank" },
    ];
    let issue = makeDefaultIssue();
    for (const p of types) {
      issue = applyPatch(issue, p);
      expect(issue.pages.every((page) => page != null && page.pageType != null)).toBe(true);
    }
  });
});
