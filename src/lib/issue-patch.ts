import {
  DEFAULT_FONTS,
  DISPLAY_FONTS,
  SANS_FONTS,
  SERIF_FONTS,
  DEFAULT_AD,
  DEFAULT_ARTICLE,
  DEFAULT_BLANK,
  DEFAULT_CONTENTS,
  DEFAULT_CUSTOM_CONTENTS,
  DEFAULT_PHOTO,
  makeNode,
  type ArticleData,
  type ArticleLayout,
  type FolioTemplate,
  type IssueDoc,
  type IssueFonts,
  type IssueMaster,
  type IssuePageNode,
  normalizeFolioTemplate,
} from "./coverDefaults";

/** Master patch tolerates partial folioTemplate (left or right only). */
export type MasterPatch = Partial<Omit<IssueMaster, "folioTemplate">> & {
  folioTemplate?: Partial<FolioTemplate>;
};

/** Discriminated union of patches the assistant can return. */
export type IssuePatch =
  | { kind: "update_page_field"; pageId: string; field: string; value: string }
  | { kind: "set_article_layout"; pageId: string; layout: ArticleLayout }
  | { kind: "update_master"; patch: MasterPatch }
  | { kind: "set_fonts"; display?: string; serif?: string; sans?: string }
  | { kind: "add_page"; pageType: "article" | "photo" | "ad" | "contents" | "blank" | "custom-contents" }
  | { kind: "add_spread"; left: "article" | "photo" | "ad"; right: "article" | "photo" | "ad" }
  | { kind: "remove_page"; pageId: string; removeSpread?: boolean }
  | { kind: "reorder_pages"; orderedPageIds: string[] }
  | { kind: "move_block"; pageId: string; blockKey: string; dx: number; dy: number; reset?: boolean }
  | { kind: "scale_block"; pageId: string; blockKey: string; scale: number; reset?: boolean };

function fontStack(label: string | undefined, kind: keyof IssueFonts): string | undefined {
  if (!label) return undefined;
  const list = kind === "display" ? DISPLAY_FONTS : kind === "serif" ? SERIF_FONTS : SANS_FONTS;
  return list.find((o) => o.label === label)?.stack;
}

function updatePageData(p: IssuePageNode, field: string, value: string): IssuePageNode {
  return { ...p, data: { ...(p.data as Record<string, unknown>), [field]: value } } as IssuePageNode;
}

export function applyPatch(issue: IssueDoc, patch: IssuePatch): IssueDoc {
  switch (patch.kind) {
    case "update_page_field": {
      return {
        ...issue,
        pages: issue.pages.map((p) =>
          p.id === patch.pageId ? updatePageData(p, patch.field, patch.value) : p,
        ),
      };
    }
    case "set_article_layout": {
      return {
        ...issue,
        pages: issue.pages.map((p) =>
          p.id === patch.pageId && p.pageType === "article"
            ? ({ ...p, data: { ...(p.data as ArticleData), layout: patch.layout } } as IssuePageNode)
            : p,
        ),
      };
    }
    case "update_master": {
      const { folioTemplate: folioPatch, ...rest } = patch.patch;
      const merged: IssueMaster = { ...issue.master, ...rest };
      if (folioPatch) {
        const current = normalizeFolioTemplate(issue.master.folioTemplate);
        merged.folioTemplate = {
          left: folioPatch.left ?? current.left,
          right: folioPatch.right ?? current.right,
        };
      }
      return { ...issue, master: merged };
    }
    case "set_fonts": {
      const fonts: IssueFonts = {
        display: fontStack(patch.display, "display") ?? issue.master.fonts?.display ?? DEFAULT_FONTS.display,
        serif: fontStack(patch.serif, "serif") ?? issue.master.fonts?.serif ?? DEFAULT_FONTS.serif,
        sans: fontStack(patch.sans, "sans") ?? issue.master.fonts?.sans ?? DEFAULT_FONTS.sans,
      };
      return { ...issue, master: { ...issue.master, fonts } };
    }
    case "add_page": {
      const node = (() => {
        switch (patch.pageType) {
          case "article": return makeNode("article", { ...DEFAULT_ARTICLE }, true);
          case "photo":   return makeNode("photo",   { ...DEFAULT_PHOTO },   true);
          case "ad":      return makeNode("ad",      { ...DEFAULT_AD },      false);
          case "contents":return makeNode("contents",{ ...DEFAULT_CONTENTS, entries: [] }, false);
          case "custom-contents": return makeNode("custom-contents", { ...DEFAULT_CUSTOM_CONTENTS, slots: DEFAULT_CUSTOM_CONTENTS.slots.map((s) => ({ ...s })) }, false);
        }
      })();
      const backIdx = issue.pages.findIndex((p) => p.pageType === "back");
      const insertAt = backIdx < 0 ? issue.pages.length : backIdx;
      const next = [...issue.pages];
      next.splice(insertAt, 0, node);
      return { ...issue, pages: next };
    }
    case "add_spread": {
      const mk = (t: "article" | "photo" | "ad") =>
        t === "article" ? makeNode("article", { ...DEFAULT_ARTICLE }, true)
        : t === "photo" ? makeNode("photo",   { ...DEFAULT_PHOTO },   true)
        : makeNode("ad", { ...DEFAULT_AD }, false);
      const a = mk(patch.left);
      const b = mk(patch.right);
      const backIdx = issue.pages.findIndex((p) => p.pageType === "back");
      const insertAt = backIdx < 0 ? issue.pages.length : backIdx;
      const next = [...issue.pages];
      next.splice(insertAt, 0, a, b);
      return { ...issue, pages: next };
    }
    case "remove_page": {
      const idx = issue.pages.findIndex((p) => p.id === patch.pageId);
      if (idx < 0) return issue;
      const p = issue.pages[idx];
      if (p.pageType === "cover" || p.pageType === "back" || p.pageType === "contents") return issue;
      const ids = new Set<string>([patch.pageId]);
      if (patch.removeSpread) {
        const partnerIdx = ((idx + 1) % 2 === 0) ? idx + 1 : idx - 1;
        const partner = issue.pages[partnerIdx];
        if (
          partner &&
          partner.pageType !== "cover" &&
          partner.pageType !== "back" &&
          partner.pageType !== "contents"
        ) ids.add(partner.id);
      }
      return { ...issue, pages: issue.pages.filter((x) => !ids.has(x.id)) };
    }
    case "reorder_pages": {
      const byId = new Map(issue.pages.map((p) => [p.id, p]));
      const cover = issue.pages.find((p) => p.pageType === "cover");
      const back = issue.pages.find((p) => p.pageType === "back");
      const middle = patch.orderedPageIds
        .map((id) => byId.get(id))
        .filter((p): p is IssuePageNode => Boolean(p) && p!.pageType !== "cover" && p!.pageType !== "back");
      const rebuilt: IssuePageNode[] = [];
      if (cover) rebuilt.push(cover);
      rebuilt.push(...middle);
      if (back) rebuilt.push(back);
      // Append any pages the AI forgot (avoids accidental deletion).
      for (const p of issue.pages) {
        if (!rebuilt.find((x) => x.id === p.id)) rebuilt.push(p);
      }
      return { ...issue, pages: rebuilt };
    }
    case "move_block": {
      return {
        ...issue,
        pages: issue.pages.map((p) => {
          if (p.id !== patch.pageId) return p;
          const cur = { ...(p.positionOverrides ?? {}) };
          if (patch.reset) delete cur[patch.blockKey];
          else {
            const snap = (n: number) => Math.round(n / 40) * 40;
            cur[patch.blockKey] = { dx: snap(patch.dx), dy: snap(patch.dy) };
          }
          return { ...p, positionOverrides: cur } as IssuePageNode;
        }),
      };
    }
    case "scale_block": {
      return {
        ...issue,
        pages: issue.pages.map((p) => {
          if (p.id !== patch.pageId) return p;
          const cur = { ...(p.textScales ?? {}) };
          if (patch.reset || patch.scale === 1) delete cur[patch.blockKey];
          else cur[patch.blockKey] = patch.scale;
          return { ...p, textScales: cur } as IssuePageNode;
        }),
      };
    }
  }
}

export function describePatch(patch: IssuePatch): string {
  switch (patch.kind) {
    case "update_page_field":   return `Set ${patch.field} on page ${patch.pageId.slice(-6)}`;
    case "set_article_layout":  return `Layout → ${patch.layout}`;
    case "update_master":       return `Master pages updated`;
    case "set_fonts":           return `Fonts updated`;
    case "add_page":            return `Added ${patch.pageType} page`;
    case "add_spread":          return `Added ${patch.left}+${patch.right} spread`;
    case "remove_page":         return patch.removeSpread ? `Removed spread` : `Removed page`;
    case "reorder_pages":       return `Reordered pages`;
    case "move_block":          return patch.reset ? `Reset ${patch.blockKey} position` : `Moved ${patch.blockKey} (${patch.dx >= 0 ? "+" : ""}${patch.dx}, ${patch.dy >= 0 ? "+" : ""}${patch.dy})`;
    case "scale_block":         return patch.reset ? `Reset ${patch.blockKey} size` : `Scaled ${patch.blockKey} to ${Math.round(patch.scale * 100)}%`;
  }
}
