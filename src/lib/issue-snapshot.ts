import {
  normalizeFolioTemplate,
  type FolioTemplate,
  type IssueDoc,
  type IssuePageNode,
} from "./coverDefaults";

/** Compact summary of the issue used as system-prompt context for the AI. */
export type IssueSnapshot = {
  issueId: string;
  meta: IssueDoc["meta"];
  master: {
    publication: string;
    folioTemplate: FolioTemplate;
    pageNumberFormat: string;
    fonts: { display: string; serif: string; sans: string };
  };
  pages: Array<{
    id: string;
    index: number;
    pageType: IssuePageNode["pageType"];
    title: string;
    layout?: string;
    palette?: string;
  }>;
};

export function snapshotIssue(issue: IssueDoc): IssueSnapshot {
  return {
    issueId: issue.meta.issueId ?? "unknown",
    meta: issue.meta,
    master: {
      publication: issue.master.publication,
      folioTemplate: normalizeFolioTemplate(issue.master.folioTemplate),
      pageNumberFormat: issue.master.pageNumberFormat,
      fonts: issue.master.fonts,
    },
    pages: issue.pages.map((p, i) => {
      const base = { id: p.id, index: i + 1, pageType: p.pageType };
      switch (p.pageType) {
        case "cover":
          return { ...base, title: p.data.headline || "Cover", palette: p.data.palette };
        case "contents":
          return { ...base, title: "Inside this issue", palette: p.data.palette };
        case "article":
          return {
            ...base,
            title: p.data.headline || "Untitled article",
            layout: p.data.layout,
            palette: p.data.palette,
          };
        case "photo":
          return {
            ...base,
            title: p.data.title || "Photo essay",
            layout: p.data.layout,
            palette: p.data.palette,
          };
        case "ad":
          return {
            ...base,
            title: p.data.brand || "Advertisement",
            layout: p.data.layout,
            palette: p.data.palette,
          };
        case "back":
          return { ...base, title: "Back cover", palette: p.data.palette };
      }
    }),
  };
}
