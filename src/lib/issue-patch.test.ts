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

describe("applyPatch resilience with unusual page arrays", () => {
  const noUndefined = (pages: unknown[]) =>
    pages.every((p) => p !== undefined && p !== null);

  it("adds a blank page to an issue with an empty pages array", () => {
    const base = makeDefaultIssue();
    const issue = { ...base, pages: [] };
    const next = applyPatch(issue, { kind: "add_page", pageType: "blank" });

    expect(next.pages.length).toBe(1);
    expect(noUndefined(next.pages)).toBe(true);
    expect(next.pages[0].pageType).toBe("blank");
    expect(next.pages[0].data).toEqual(DEFAULT_BLANK);
  });

  it("adds a blank page when back page is missing (appends at end)", () => {
    const base = makeDefaultIssue();
    const issue = { ...base, pages: base.pages.filter((p) => p.pageType !== "back") };
    const before = issue.pages.length;
    const next = applyPatch(issue, { kind: "add_page", pageType: "blank" });

    expect(next.pages.length).toBe(before + 1);
    expect(noUndefined(next.pages)).toBe(true);
    expect(next.pages[next.pages.length - 1].pageType).toBe("blank");
  });

  it("adds a blank page when only a cover exists", () => {
    const base = makeDefaultIssue();
    const cover = base.pages.find((p) => p.pageType === "cover")!;
    const issue = { ...base, pages: [cover] };
    const next = applyPatch(issue, { kind: "add_page", pageType: "blank" });

    expect(next.pages.length).toBe(2);
    expect(noUndefined(next.pages)).toBe(true);
    expect(next.pages[0].pageType).toBe("cover");
    expect(next.pages[1].pageType).toBe("blank");
  });

  it("appends additional blanks alongside an existing DEFAULT_BLANK page without duplication or undefineds", () => {
    let issue = makeDefaultIssue();
    issue = applyPatch(issue, { kind: "add_page", pageType: "blank" });
    const afterFirst = issue.pages.filter((p) => p.pageType === "blank").length;
    expect(afterFirst).toBe(1);

    issue = applyPatch(issue, { kind: "add_page", pageType: "blank" });
    issue = applyPatch(issue, { kind: "add_page", pageType: "blank" });

    const blanks = issue.pages.filter((p) => p.pageType === "blank");
    expect(blanks.length).toBe(3);
    expect(noUndefined(issue.pages)).toBe(true);

    // Every blank has its own object identity + a fresh id
    const ids = new Set(blanks.map((b) => b.id));
    expect(ids.size).toBe(3);
    // Mutating one blank's data must not leak into others (independent copies)
    (blanks[0].data as Record<string, unknown>).__mutated = true;
    expect((blanks[1].data as Record<string, unknown>).__mutated).toBeUndefined();
    expect((blanks[2].data as Record<string, unknown>).__mutated).toBeUndefined();
  });

  it("stress-adds many blanks and yields no undefined entries", () => {
    let issue = makeDefaultIssue();
    for (let i = 0; i < 25; i++) {
      issue = applyPatch(issue, { kind: "add_page", pageType: "blank" });
    }
    expect(noUndefined(issue.pages)).toBe(true);
    expect(issue.pages.filter((p) => p.pageType === "blank").length).toBe(25);
    // Cover remains first, back (if any) remains last
    expect(issue.pages[0].pageType).toBe("cover");
    const backIdx = issue.pages.findIndex((p) => p.pageType === "back");
    if (backIdx >= 0) expect(backIdx).toBe(issue.pages.length - 1);
  });
});
