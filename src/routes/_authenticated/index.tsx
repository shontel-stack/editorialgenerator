import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Sparkles, Download, Save, Upload, Trash2, FileText, Image as ImageIcon, Megaphone, ListOrdered, Layers, Paperclip, Users, ClipboardList, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import { PagePreview } from "@/components/PagePreview";
import { GuidesOverlay } from "@/components/GuidesOverlay";
import { ColumnTuningControls } from "@/components/ColumnTuningControls";
import { SnapSettingsPanel } from "@/components/SnapSettingsPanel";
import { useSnapSettings, mergeSnapSettings, type SnapSettings } from "@/lib/snapSettings";
import { LayoutEditProvider } from "@/components/LayoutEdit";
import { SortableList } from "@/components/SortableItem";
import { AssistantPanel } from "@/components/AssistantPanel";
import { AttachmentControl } from "@/components/AttachmentControl";
import { PageReferencesEditor } from "@/components/PageReferencesEditor";

import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { StaffPanel } from "@/components/StaffPanel";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { ProductionChecklist } from "@/components/ProductionChecklist";
import { useIssueAttachments } from "@/hooks/useIssueAttachments";
import { useIssuePageStatus } from "@/hooks/useIssuePageStatus";
import { useLayoutPresets } from "@/hooks/useLayoutPresets";
import { useActivePublication } from "@/hooks/useActivePublication";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { downloadIdml, downloadIdmlPackage } from "@/lib/idmlExport";
import {
  PAGE_LAYOUTS,
  PAGE_LAYOUT_LABELS,
  PAGE_LAYOUT_DESCRIPTIONS,
  DEFAULT_PAGE_LAYOUT,
  PAGE_LAYOUT_COLUMNS,
  type PageLayout,
} from "@/lib/pageLayouts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ARTICLE_LAYOUTS,
  DEFAULT_AD,
  DEFAULT_ARTICLE,
  DEFAULT_BACK,
  DEFAULT_CONTENTS,
  DEFAULT_COVER,
  DEFAULT_FONTS,
  getPageDimensions,
  getPageMargins,
  makeDefaultIssue,
  newIssueId,
  DEFAULT_MASTER,
  DEFAULT_PHOTO,
  DISPLAY_FONTS,
  LOGO_COLORS,
  PAGE_LABELS,
  PAGE_NUMBER_FORMATS,
  PALETTES,
  SANS_FONTS,
  SERIF_FONTS,
  deriveContentsEntries,
  formatPageNumber,
  googleFontsUrl,
  makeNode,
  pageNumberFor,
  renderFolio,
  type AdData,
  type ArticleData,
  type ArticleLayout,
  type BackCoverData,
  type ContentsData,
  type CoverData,
  type FontOption,
  type IssueDoc,
  type IssueFonts,
  type IssueMaster,
  type IssuePageNode,
  type PageType,
  type Palette,
  type PhotoData,
} from "@/lib/coverDefaults";
import {
  exportIssuePdf,
  exportJpeg,
  exportPdf,
  exportPng,
  type IssuePage,
} from "@/lib/exportCover";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "The Arts Today — Issue Builder" },
      {
        name: "description",
        content:
          "Build the whole monthly issue of The Arts Today: cover, contents, articles, ads, photo essays. Export print-ready PDFs at 10.6667 × 14.2222 in for InDesign, Canva, and Fresco.",
      },
      { property: "og:title", content: "The Arts Today — Issue Builder" },
      {
        property: "og:description",
        content:
          "Assemble articles, ads, photo essays and cover into a single interactive publication PDF — round-trips with Canva and InDesign.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [issue, setIssue] = useState<IssueDoc>(() => makeDefaultIssue());
  const lastSavedRef = useRef<string>(JSON.stringify(issue));
  useUnsavedGuard(
    () =>
      JSON.stringify(issue) !== lastSavedRef.current
        ? `Issue "${issue.meta?.issue ?? "Untitled"}" has unsaved edits`
        : null,
    () => {
      saveIssueRef.current?.();
    },
  );
  const saveIssueRef = useRef<(() => void) | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => issue.pages[0].id);
  const [busy, setBusy] = useState<string | null>(null);
  const [spreadView, setSpreadView] = useState(false);
  const [editLayout, setEditLayout] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const { userId, active: activePublication } = useActivePublication();
  // Page dimensions (and margin/bleed) come from the active publication.
  const pageDims = useMemo(() => getPageDimensions(activePublication), [activePublication]);
  const dimPx = pageDims.px;
  const dimInches = pageDims.inches;
  const pageMargins = useMemo(() => getPageMargins(activePublication), [activePublication]);
  const snapSettings = useSnapSettings();
  // Snap guide x/y axis arrays (in page-px @ 300 DPI). Threshold is set
  // per-page below using the effective (global + per-page override) settings.
  const snapAxes = useMemo(() => {
    const DPI = 300;
    const bleed = Math.max(0, pageMargins.bleed * DPI);
    const mT = pageMargins.top * DPI;
    const mR = pageMargins.right * DPI;
    const mB = pageMargins.bottom * DPI;
    const mL = pageMargins.left * DPI;
    return {
      xs: [-bleed, 0, mL, dimPx.w / 2, dimPx.w - mR, dimPx.w, dimPx.w + bleed],
      ys: [-bleed, 0, mT, dimPx.h / 2, dimPx.h - mB, dimPx.h, dimPx.h + bleed],
    };
  }, [pageMargins, dimPx.w, dimPx.h]);

  /** Resolve the effective snap config for a given page (global ⊕ override). */
  const effectiveSnapFor = (page: IssuePageNode | null | undefined) =>
    mergeSnapSettings(snapSettings, page?.snapOverride);

  /** Build a complete guide packet for a given page using its effective settings. */
  const guidesFor = (page: IssuePageNode | null | undefined) => ({
    xs: snapAxes.xs,
    ys: snapAxes.ys,
    threshold: effectiveSnapFor(page).edgeTolerancePx,
  });
  // Full IDML/Canva geometry packet — width/height + margins + bleed.
  const idmlDim = useMemo(
    () => ({
      w: dimInches.w,
      h: dimInches.h,
      marginTop: pageMargins.top,
      marginRight: pageMargins.right,
      marginBottom: pageMargins.bottom,
      marginLeft: pageMargins.left,
      bleed: pageMargins.bleed,
    }),
    [dimInches.w, dimInches.h, pageMargins],
  );

  /** Pending spatial proposals from the assistant (move_block / scale_block).
   *  Keyed by toolCallId so the chat card can resolve them. */
  type PendingSpatial = {
    toolCallId: string;
    pageId: string;
    blockKey: string;
    kind: "move_block" | "scale_block";
    dx?: number;
    dy?: number;
    scale?: number;
    reset?: boolean;
  };
  const [pendingSpatial, setPendingSpatial] = useState<PendingSpatial[]>([]);

  /** Per-page maps consumed by LayoutEditProvider. */
  const pendingByPage = useMemo(() => {
    const out: Record<string, { overrides: Record<string, { dx: number; dy: number }>; scales: Record<string, number> }> = {};
    for (const p of pendingSpatial) {
      const slot = (out[p.pageId] ??= { overrides: {}, scales: {} });
      if (p.kind === "move_block" && !p.reset) {
        slot.overrides[p.blockKey] = { dx: p.dx ?? 0, dy: p.dy ?? 0 };
      } else if (p.kind === "scale_block" && !p.reset && typeof p.scale === "number") {
        slot.scales[p.blockKey] = p.scale;
      } else if (p.reset) {
        // visualize a reset as origin / scale 1
        if (p.kind === "move_block") slot.overrides[p.blockKey] = { dx: 0, dy: 0 };
        else slot.scales[p.blockKey] = 1;
      }
    }
    return out;
  }, [pendingSpatial]);
  const attachments = useIssueAttachments(issue.meta.issueId, activePublication?.id ?? null);

  // Per-page layout (free-form, two-column, image-top, …) persists in
  // page_status. The hook auto-creates rows for new pages, subscribes to
  // realtime updates, and exposes setLayout + layoutOf for the current
  // selection.
  const pageRefsForStatus = useMemo(
    () => issue.pages.map((p) => ({ id: p.id, label: labelForNode(p) })),
    [issue.pages],
  );
  const pageStatus = useIssuePageStatus({
    userId,
    issueId: issue.meta.issueId,
    publicationId: activePublication?.id ?? null,
    pages: pageRefsForStatus,
  });
  const layoutPresets = useLayoutPresets(userId);
  const [pendingLayout, setPendingLayout] = useState<PageLayout | null>(null);

  // Hidden off-screen render stage holds a div ref for every page node.
  const refs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const setRef = (id: string) => (el: HTMLDivElement | null) => {
    refs.current.set(id, el);
  };

  // Force-select something valid if the user deletes the selected page.
  useEffect(() => {
    if (!issue.pages.some((p) => p.id === selectedId)) {
      setSelectedId(issue.pages[0]?.id ?? "");
    }
  }, [issue, selectedId]);

  const selected = issue.pages.find((p) => p.id === selectedId) ?? issue.pages[0];

  // Auto-compute folio + page number on each node before rendering, and inject
  // the derived contents entries into the contents page so it stays in sync
  // with the issue list automatically.
  const pagesForRender = useMemo(() => {
    const contentsEntries = deriveContentsEntries(issue);
    const folio = renderFolio(issue.master, issue.meta);
    const total = issue.pages.length;
    return issue.pages.map((p, i) => {
      const num = formatPageNumber(issue.master, i + 1, total);
      switch (p.pageType) {
        case "cover":
          return { ...p, data: { ...p.data, issue: issue.meta.issue, date: issue.meta.date } };
        case "contents":
          return {
            ...p,
            data: {
              ...p.data,
              folio,
              pageNumber: num,
              issue: issue.meta.issue,
              date: issue.meta.date,
              entries: contentsEntries,
            },
          };
        case "article":
          return {
            ...p,
            data: {
              ...p.data,
              folio: issue.master.showFolioOnArticles ? folio : "",
              pageNumber: num,
            },
          };
        case "photo":
          return {
            ...p,
            data: {
              ...p.data,
              folio: issue.master.showFolioOnPhotos ? folio : "",
              pageNumber: num,
            },
          };
        case "ad":
          return {
            ...p,
            data: {
              ...p.data,
              folio: issue.master.showFolioOnAds ? folio : "",
              pageNumber: num,
            },
          };
        case "back":
          return { ...p, data: { ...p.data, pageNumber: num } };
      }
    }) as IssuePageNode[];
  }, [issue]);

  const selectedForRender = pagesForRender.find((p) => p.id === selected.id) ?? selected;

  /* --- spread pairing --- */
  // Page 1 (cover) stands alone, then pairs 2-3, 4-5, etc.
  const selectedIdx = pagesForRender.findIndex((p) => p.id === selected.id);
  const spread = useMemo(() => {
    if (!spreadView || selectedIdx <= 0) {
      return { left: selectedForRender, right: null as IssuePageNode | null };
    }
    const groupStart = 1 + 2 * Math.floor((selectedIdx - 1) / 2);
    const left = pagesForRender[groupStart] ?? selectedForRender;
    const right = pagesForRender[groupStart + 1] ?? null;
    return { left, right };
  }, [spreadView, selectedIdx, pagesForRender, selectedForRender]);

  /* --- preview stage sizing --- */
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const stageW = spreadView && spread.right ? dimPx.w * 2 : dimPx.w;
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      setScale(Math.min(el.clientWidth / stageW, el.clientHeight / dimPx.h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageW, dimPx.h]);

  /* --- live font preview: inject Google Fonts <link> and apply CSS vars --- */
  const fonts = issue.master.fonts;
  useEffect(() => {
    const href = googleFontsUrl(fonts);
    let link = document.getElementById("issue-fonts") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "issue-fonts";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;

    const root = document.documentElement;
    root.style.setProperty("--font-display", fonts.display);
    root.style.setProperty("--font-serif", fonts.serif);
    root.style.setProperty("--font-sans", fonts.sans);
  }, [fonts]);

  /* --- mutators --- */

  const updateMeta = (patch: Partial<IssueDoc["meta"]>) =>
    setIssue((d) => ({ ...d, meta: { ...d.meta, ...patch } }));

  const updateMaster = (patch: Partial<IssueMaster>) =>
    setIssue((d) => ({ ...d, master: { ...d.master, ...patch } }));

  const updateNode = (id: string, patch: Partial<IssuePageNode>) =>
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) => (p.id === id ? ({ ...p, ...patch } as IssuePageNode) : p)),
    }));

  const updateData = <T extends IssuePageNode>(id: string, dataPatch: Partial<T["data"]>) =>
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        p.id === id ? ({ ...p, data: { ...p.data, ...dataPatch } } as IssuePageNode) : p,
      ),
    }));

  const setOverride = (id: string, key: string, value: { dx: number; dy: number } | null) =>
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) => {
        if (p.id !== id) return p;
        const cur = { ...(p.positionOverrides ?? {}) };
        if (value === null) delete cur[key];
        else cur[key] = value;
        return { ...p, positionOverrides: cur } as IssuePageNode;
      }),
    }));

  const setTextScale = (id: string, key: string, value: number | null) =>
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) => {
        if (p.id !== id) return p;
        const cur = { ...(p.textScales ?? {}) };
        if (value === null) delete cur[key];
        else cur[key] = value;
        return { ...p, textScales: cur } as IssuePageNode;
      }),
    }));

  const setBlockLink = (id: string, key: string, value: string | null) =>
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) => {
        if (p.id !== id) return p;
        const cur = { ...(p.blockLinks ?? {}) };
        if (value === null) delete cur[key];
        else cur[key] = value;
        return { ...p, blockLinks: cur } as IssuePageNode;
      }),
    }));

  const setCustomBlocks = (id: string, next: import("@/lib/coverDefaults").CustomBlock[]) =>
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        p.id === id ? ({ ...p, customBlocks: next } as IssuePageNode) : p,
      ),
    }));

  const resetOverrides = (id: string) =>
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        p.id === id
          ? ({ ...p, positionOverrides: {}, textScales: {}, blockLinks: {} } as IssuePageNode)
          : p,
      ),
    }));

  // — Undo/redo stacks for snap-override mutations only. Each entry is a
  // snapshot of every page's `snapOverride` keyed by page id, captured
  // BEFORE a mutation is applied.
  type SnapSnapshot = Array<[string, Partial<SnapSettings> | undefined]>;
  const snapPastRef = useRef<SnapSnapshot[]>([]);
  const snapFutureRef = useRef<SnapSnapshot[]>([]);
  const [snapHistoryTick, setSnapHistoryTick] = useState(0);
  const snapshotSnapOverrides = (d: IssueDoc): SnapSnapshot =>
    d.pages.map((p) => [p.id, p.snapOverride ? { ...p.snapOverride } : undefined]);
  const restoreSnapSnapshot = (snap: SnapSnapshot) => {
    const map = new Map(snap);
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        map.has(p.id)
          ? ({ ...p, snapOverride: map.get(p.id) ?? undefined } as IssuePageNode)
          : p,
      ),
    }));
  };
  const pushSnapHistory = () => {
    setIssue((d) => {
      snapPastRef.current.push(snapshotSnapOverrides(d));
      // Cap history so memory stays bounded.
      if (snapPastRef.current.length > 100) snapPastRef.current.shift();
      snapFutureRef.current = [];
      return d;
    });
    setSnapHistoryTick((n) => n + 1);
  };
  const undoSnapOverrides = () => {
    const prev = snapPastRef.current.pop();
    if (!prev) return;
    setIssue((d) => {
      snapFutureRef.current.push(snapshotSnapOverrides(d));
      return d;
    });
    restoreSnapSnapshot(prev);
    setSnapHistoryTick((n) => n + 1);
  };
  const redoSnapOverrides = () => {
    const next = snapFutureRef.current.pop();
    if (!next) return;
    setIssue((d) => {
      snapPastRef.current.push(snapshotSnapOverrides(d));
      return d;
    });
    restoreSnapSnapshot(next);
    setSnapHistoryTick((n) => n + 1);
  };

  /** Set or clear per-page snap overrides. Pass `null` to remove the override. */
  const setSnapOverride = (id: string, patch: Partial<SnapSettings> | null) => {
    pushSnapHistory();
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        p.id === id ? ({ ...p, snapOverride: patch ?? undefined } as IssuePageNode) : p,
      ),
    }));
  };

  /** Apply (or clear) the same snap override across many pages in one shot. */
  const applySnapOverrideToPages = (ids: string[], patch: Partial<SnapSettings> | null) => {
    if (ids.length === 0) return;
    pushSnapHistory();
    const idSet = new Set(ids);
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        idSet.has(p.id) ? ({ ...p, snapOverride: patch ?? undefined } as IssuePageNode) : p,
      ),
    }));
  };


  const movePage = (id: string, dir: -1 | 1) =>
    setIssue((d) => {
      const idx = d.pages.findIndex((p) => p.id === id);
      if (idx < 0) return d;
      const j = idx + dir;
      // Lock cover at first position, back cover at last position.
      const target = d.pages[j];
      if (!target) return d;
      const moving = d.pages[idx];
      if (moving.pageType === "cover" || moving.pageType === "back") return d;
      if (target.pageType === "cover" || target.pageType === "back") return d;
      const next = [...d.pages];
      next[idx] = target;
      next[j] = moving;
      return { ...d, pages: next };
    });

  // Accept a candidate reorder of the middle section (everything that isn't
  // cover or back). Cover stays first, back stays last regardless.
  const reorderPages = (next: IssuePageNode[]) =>
    setIssue((d) => {
      const cover = d.pages.find((p) => p.pageType === "cover");
      const back = d.pages.find((p) => p.pageType === "back");
      const middle = next.filter((p) => p.pageType !== "cover" && p.pageType !== "back");
      const rebuilt: IssuePageNode[] = [];
      if (cover) rebuilt.push(cover);
      rebuilt.push(...middle);
      if (back) rebuilt.push(back);
      return { ...d, pages: rebuilt };
    });

  const removePage = (id: string) =>
    setIssue((d) => {
      const p = d.pages.find((x) => x.id === id);
      if (!p) return d;
      if (p.pageType === "cover" || p.pageType === "back" || p.pageType === "contents") return d;
      return { ...d, pages: d.pages.filter((x) => x.id !== id) };
    });

  const addPage = (pageType: "article" | "photo" | "ad" | "contents") => {
    const node = (() => {
      switch (pageType) {
        case "article":
          return makeNode("article", { ...DEFAULT_ARTICLE }, true);
        case "photo":
          return makeNode("photo", { ...DEFAULT_PHOTO }, true);
        case "ad":
          return makeNode("ad", { ...DEFAULT_AD }, false);
        case "contents":
          return makeNode("contents", { ...DEFAULT_CONTENTS, entries: [] }, false);
      }
    })();
    setIssue((d) => {
      // Insert before the back cover (which is locked last).
      const backIdx = d.pages.findIndex((p) => p.pageType === "back");
      const insertAt = backIdx < 0 ? d.pages.length : backIdx;
      const next = [...d.pages];
      next.splice(insertAt, 0, node);
      return { ...d, pages: next };
    });
    setSelectedId(node.id);
  };

  // Spreads are pairs of facing pages: (2,3) (4,5) ... — i.e. pages whose
  // 1-based index is even sit on the LEFT of a spread. Insert two pages at
  // an even-indexed slot before the back cover so the new pair lands cleanly.
  const addSpread = (
    left: "article" | "photo" | "ad",
    right: "article" | "photo" | "ad",
  ) => {
    const mk = (t: "article" | "photo" | "ad") =>
      t === "article" ? makeNode("article", { ...DEFAULT_ARTICLE }, true)
      : t === "photo" ? makeNode("photo", { ...DEFAULT_PHOTO }, true)
      : makeNode("ad", { ...DEFAULT_AD }, false);
    const a = mk(left);
    const b = mk(right);
    setIssue((d) => {
      const backIdx = d.pages.findIndex((p) => p.pageType === "back");
      let insertAt = backIdx < 0 ? d.pages.length : backIdx;
      // Page numbers are 1-based; left page of a spread must be even-indexed.
      // insertAt is the 0-based slot; the new left page will end up at
      // 1-based position (insertAt + 1). Bump by 1 if needed.
      if ((insertAt + 1) % 2 !== 0) insertAt += 0; // already even left — fine
      const next = [...d.pages];
      next.splice(insertAt, 0, a, b);
      return { ...d, pages: next };
    });
    setSelectedId(a.id);
  };

  // Remove the selected page AND its spread partner (if any).
  const removeSpread = (id: string) =>
    setIssue((d) => {
      const idx = d.pages.findIndex((p) => p.id === id);
      if (idx < 0) return d;
      const p = d.pages[idx];
      if (p.pageType === "cover" || p.pageType === "back" || p.pageType === "contents") return d;
      // Spread-pair partner: even 1-based position is LEFT, partner is +1; odd is RIGHT, partner is -1.
      const partnerIdx = ((idx + 1) % 2 === 0) ? idx + 1 : idx - 1;
      const partner = d.pages[partnerIdx];
      const ids = new Set<string>([id]);
      if (
        partner &&
        partner.pageType !== "cover" &&
        partner.pageType !== "back" &&
        partner.pageType !== "contents"
      ) {
        ids.add(partner.id);
      }
      return { ...d, pages: d.pages.filter((x) => !ids.has(x.id)) };
    });

  const issueSlug = useMemo(
    () =>
      (issue.meta.issue || "issue")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
        .replace(/^-|-$/g, ""),
    [issue.meta.issue],
  );

  /* --- exports --- */

  const doExport = async (kind: "pdf" | "png" | "jpg") => {
    const node = refs.current.get(selected.id);
    if (!node) return;
    setBusy(kind.toUpperCase());
    try {
      const name = `arts-today-${issueSlug}-${selected.pageType}-${pageNumberFor(issue, selected.id)}`;
      const exportDim = { inches: dimInches, px: dimPx };
      if (kind === "pdf") await exportPdf(node, `${name}.pdf`, exportDim);
      else if (kind === "png") await exportPng(node, `${name}.png`, exportDim);
      else await exportJpeg(node, `${name}.jpg`, exportDim);
    } finally {
      setBusy(null);
    }
  };

  const doExportPublication = async () => {
    setBusy("PUBLICATION");
    try {
      const pages: IssuePage[] = [];
      for (const p of issue.pages) {
        const node = refs.current.get(p.id);
        if (!node) continue;
        const label = labelForNode(p);
        pages.push({ id: p.id, pageType: p.pageType, node, label });
      }
      await exportIssuePdf(
        pages,
        {
          title: `The Arts Today — ${issue.meta.issue}`,
          author: "The Arts Today",
          subject: issue.meta.date,
        },
        `arts-today-${issueSlug}-publication.pdf`,
        { inches: dimInches, px: dimPx },
      );
    } finally {
      setBusy(null);
    }
  };

  /* --- save / load JSON --- */

  const saveIssue = () => {
    const json = JSON.stringify(issue, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arts-today-${issueSlug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    lastSavedRef.current = JSON.stringify(issue);
  };
  saveIssueRef.current = saveIssue;

  const loadIssue = (file: File | undefined) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result)) as IssueDoc;
        if (!parsed?.pages?.length || !parsed?.meta) throw new Error("Invalid issue file");
        // Back-compat: older files may lack master / per-article layout
        const hydrated: IssueDoc = {
          ...parsed,
          meta: { ...parsed.meta, issueId: parsed.meta.issueId ?? newIssueId() },
          master: {
            ...DEFAULT_MASTER,
            ...(parsed.master ?? {}),
            fonts: { ...DEFAULT_FONTS, ...((parsed.master as Partial<IssueMaster> | undefined)?.fonts ?? {}) },
          },
          pages: parsed.pages.map((p) => {
            if (p.pageType !== "article") return p;
            const d = p.data as Partial<ArticleData>;
            return { ...p, data: { ...d, layout: d.layout ?? "image-top-2col" } as ArticleData } as IssuePageNode;
          }),
        };
        setIssue(hydrated);
        setSelectedId(hydrated.pages[0].id);
        lastSavedRef.current = JSON.stringify(hydrated);
      } catch (e) {
        alert(`Could not load issue: ${(e as Error).message}`);
      }
    };
    r.readAsText(file);
  };

  // Resizable workspace panel refs + collapsed state
  const leftPanelRef = usePanelRef();
  const middlePanelRef = usePanelRef();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [middleCollapsed, setMiddleCollapsed] = useState(false);
  const toggleLeftPanel = () => {
    const p = leftPanelRef.current;
    if (!p) return;
    p.isCollapsed() ? p.expand() : p.collapse();
  };
  const toggleMiddlePanel = () => {
    const p = middlePanelRef.current;
    if (!p) return;
    p.isCollapsed() ? p.expand() : p.collapse();
  };
  const selectedHasOverrides =
    (selected.positionOverrides && Object.keys(selected.positionOverrides).length > 0) ||
    (selected.textScales && Object.keys(selected.textScales).length > 0) ||
    (selected.blockLinks && Object.keys(selected.blockLinks).length > 0);
  const selectedCustomBlockCount = selected.customBlocks?.length ?? 0;
  const selectedLayout: PageLayout =
    pageStatus.layoutOf(selected.id) ?? DEFAULT_PAGE_LAYOUT;

  /** Apply a new layout; reset block positions so the new template can take
   * over. Used after the user confirms in the reflow dialog (or directly
   * when the page has no overrides / custom blocks to disturb). */
  const commitLayoutChange = async (next: PageLayout) => {
    try {
      await pageStatus.setLayout(selected.id, next);
      // Clear positionOverrides / textScales / blockLinks so blocks reflow
      // into the new template. CustomBlocks are kept (the user added them
      // intentionally) but their offsets are reset above via resetOverrides.
      if (next !== "free-form") resetOverrides(selected.id);
    } catch (e) {
      console.error("Failed to set page layout", e);
    }
  };

  /** Entry point from the ribbon / edit panel pickers. Pops a confirmation
   * dialog when the page already has hand-placed content that would shift. */
  const requestLayoutChange = (next: PageLayout) => {
    if (next === selectedLayout) return;
    const needsConfirm =
      next !== "free-form" && (selectedHasOverrides || selectedCustomBlockCount > 0);
    if (needsConfirm) setPendingLayout(next);
    else void commitLayoutChange(next);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="mx-auto max-w-full px-4 py-4 flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Brand wordmark */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-foreground text-background flex items-center justify-center font-brand text-lg">P</div>
              <div className="leading-tight">
                <div className="font-brand text-[15px] text-foreground">PAGELUXE</div>
                <div className="text-[9px] tracking-[0.45em] uppercase text-muted-foreground -mt-0.5">
                  The Arts Today · Issue Builder
                </div>
              </div>
            </div>
            <div className="h-8 w-px bg-border mx-2" />
            <WorkspaceSwitcher />
            <div className="h-8 w-px bg-border mx-2" />
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <label className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                  Issue
                </label>
                <input
                  value={issue.meta.issue}
                  onChange={(e) => updateMeta({ issue: e.target.value })}
                  className="border border-input bg-background px-2.5 py-1.5 text-sm w-[180px] rounded-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                  Date
                </label>
                <input
                  value={issue.meta.date}
                  onChange={(e) => updateMeta({ date: e.target.value })}
                  className="border border-input bg-background px-2.5 py-1.5 text-sm w-[160px] rounded-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AttachmentControl
              label="Layout template (whole issue)"
              attachment={attachments.template}
              onUpload={(file) => attachments.upload({ pageId: null, kind: "template", file })}
              onRemove={() => attachments.template ? attachments.remove(attachments.template) : Promise.resolve()}
            />
            <button
              onClick={() => setAttachmentsOpen((v) => !v)}
              className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-secondary transition"
              title="Open attachments panel"
            >
              <Paperclip className="h-3.5 w-3.5" />
              Files
            </button>
            <button
              onClick={() => setStaffOpen((v) => !v)}
              className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-secondary transition"
              title="Editorial &amp; marketing staff"
            >
              <Users className="h-3.5 w-3.5" />
              Staff
            </button>
            <button
              onClick={() => setChecklistOpen((v) => !v)}
              className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-secondary transition"
              title="Production checklist, board, and calendar"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Production
            </button>
            <button
              onClick={() => setAssistantOpen((v) => !v)}
              className="bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] px-4 py-2 text-[10px] tracking-[0.3em] uppercase hover:bg-[color:var(--ruby-deep)] transition flex items-center gap-2 rounded-sm"
              title="Editorial assistant"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask the editor
            </button>
          </div>
        </div>
        <div className="h-[2px] ruby-rule" />
      </header>


      <div className="px-3 py-3">
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-[calc(100vh-140px)] gap-0 rounded-sm"
      >
        <ResizablePanel
          panelRef={leftPanelRef}
          id="ws-left"
          defaultSize={20}
          minSize={14}
          maxSize={35}
          collapsible
          collapsedSize={0}
          onResize={(size) => setLeftCollapsed(size.asPercentage < 1)}
        >
        <div className="h-full overflow-y-auto pr-3">
        {/* Page list */}
        <aside className="space-y-3">
          <div className="border border-border bg-card">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
              <span className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">
                Pages · <span className="font-numerals text-foreground">{issue.pages.length.toString().padStart(2, "0")}</span>
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1 bg-foreground text-background px-2.5 py-1.5 text-[10px] tracking-[0.3em] uppercase rounded-sm hover:bg-[color:var(--ruby)] transition">
                  <Plus className="h-3 w-3" /> Add <ChevronDown className="h-3 w-3 opacity-70" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Single page</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => addPage("article")}><FileText className="h-3.5 w-3.5 mr-2" /> Article</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addPage("photo")}><ImageIcon className="h-3.5 w-3.5 mr-2" /> Photo essay</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addPage("ad")}><Megaphone className="h-3.5 w-3.5 mr-2" /> Advertisement</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addPage("contents")}><ListOrdered className="h-3.5 w-3.5 mr-2" /> Contents page</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Two-page spread</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => addSpread("article", "photo")}><Layers className="h-3.5 w-3.5 mr-2" /> Article + Photo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSpread("photo", "photo")}><Layers className="h-3.5 w-3.5 mr-2" /> Photo + Photo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSpread("ad", "ad")}><Layers className="h-3.5 w-3.5 mr-2" /> Ad + Ad</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="divide-y divide-border">
              <SortableList
                items={issue.pages}
                onReorder={reorderPages}
                isDraggable={(p) => p.pageType !== "cover" && p.pageType !== "back"}
                renderItem={(p, handle) => {
                  const i = issue.pages.findIndex((x) => x.id === p.id);
                  const active = p.id === selectedId;
                  const locked = p.pageType === "cover" || p.pageType === "back";
                  return (
                    <div
                      className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer transition border-b border-border last:border-b-0 ${
                        active ? "bg-foreground text-background" : "hover:bg-secondary"
                      }`}
                      onClick={() => setSelectedId(p.id)}
                    >
                      {handle}
                      <span
                        className={`text-[10px] tabular-nums tracking-widest w-6 ${
                          active ? "opacity-80" : "text-muted-foreground"
                        }`}
                      >
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] tracking-[0.3em] uppercase opacity-80">
                          {PAGE_LABELS[p.pageType]}
                          {p.includeInContents && !locked && <span> · TOC</span>}
                        </div>
                        <div
                          className="text-sm truncate"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {labelForNode(p)}
                        </div>
                      </div>
                      {!locked && p.pageType !== "contents" && (
                        <>
                          {spreadView && (
                            <button
                              title="Remove spread (this page + its facing page)"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Remove this spread (both facing pages)?")) removeSpread(p.id);
                              }}
                              className="text-[10px] px-1 opacity-60 hover:opacity-100 hover:text-destructive"
                            >
                              ✕✕
                            </button>
                          )}
                          <button
                            title="Remove page"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Remove this ${PAGE_LABELS[p.pageType]} page?`)) removePage(p.id);
                            }}
                            className="text-[10px] px-1 opacity-60 hover:opacity-100 hover:text-destructive"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          </div>




          <SnapSettingsPanel
            pageLabel={selected.pageType}
            override={selected.snapOverride ?? null}
            onChangeOverride={(next) => setSnapOverride(selected.id, next)}
            currentPageId={selected.id}
            pages={issue.pages.map((p, i) => ({
              id: p.id,
              label: `${String(i + 1).padStart(2, "0")} · ${p.pageType}${p.snapOverride ? " ●" : ""}`,
            }))}
            onApplyOverrideToPages={applySnapOverrideToPages}
            onUndoOverrides={undoSnapOverrides}
            onRedoOverrides={redoSnapOverrides}
            canUndoOverrides={snapPastRef.current.length > 0}
            canRedoOverrides={snapFutureRef.current.length > 0}
            historyTick={snapHistoryTick}
          />




          {/* Master pages — issue-wide folio & page-number defaults */}
          <Section title="Master pages" defaultOpen={false}>
            <Field label="Publication name">
              <Input
                value={issue.master.publication}
                onChange={(v) => updateMaster({ publication: v })}
              />
            </Field>
            <Field label="Folio template">
              <Input
                value={issue.master.folioTemplate}
                onChange={(v) => updateMaster({ folioTemplate: v })}
              />
            </Field>
            <p className="text-[10px] leading-relaxed text-muted-foreground -mt-2">
              Tokens: <code>{"{publication}"}</code> <code>{"{issue}"}</code> <code>{"{date}"}</code>
            </p>
            <Field label="Page number style">
              <Select
                value={issue.master.pageNumberFormat}
                onValueChange={(v) =>
                  updateMaster({ pageNumberFormat: v as IssueMaster["pageNumberFormat"] })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_NUMBER_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="space-y-1.5 pt-2 border-t border-border">
              <MasterToggle
                label="Folio on articles"
                checked={issue.master.showFolioOnArticles}
                onChange={(v) => updateMaster({ showFolioOnArticles: v })}
              />
              <MasterToggle
                label="Folio on photo essays"
                checked={issue.master.showFolioOnPhotos}
                onChange={(v) => updateMaster({ showFolioOnPhotos: v })}
              />
              <MasterToggle
                label="Folio on advertisements"
                checked={issue.master.showFolioOnAds}
                onChange={(v) => updateMaster({ showFolioOnAds: v })}
              />
            </div>
          </Section>

          <Section title="Typography" defaultOpen={false}>
            <FontPicker
              label="Display (headlines)"
              options={DISPLAY_FONTS}
              value={issue.master.fonts.display}
              onChange={(v) => updateMaster({ fonts: { ...issue.master.fonts, display: v } })}
            />
            <FontPicker
              label="Serif (body copy)"
              options={SERIF_FONTS}
              value={issue.master.fonts.serif}
              onChange={(v) => updateMaster({ fonts: { ...issue.master.fonts, serif: v } })}
            />
            <FontPicker
              label="Sans (folio & labels)"
              options={SANS_FONTS}
              value={issue.master.fonts.sans}
              onChange={(v) => updateMaster({ fonts: { ...issue.master.fonts, sans: v } })}
            />
            <button
              type="button"
              onClick={() => updateMaster({ fonts: DEFAULT_FONTS })}
              className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-[color:var(--ruby)] underline-offset-4 hover:underline"
            >
              Reset to defaults
            </button>
          </Section>

          <Section title="Issue · Save & Export" defaultOpen>
            <button
              onClick={doExportPublication}
              disabled={busy === "PUBLICATION"}
              className="w-full bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] px-3 py-3 text-[11px] uppercase tracking-[0.3em] hover:bg-[color:var(--ruby-deep)] transition disabled:opacity-60 flex items-center justify-center gap-2 rounded-sm"
            >
              <Download className="h-3.5 w-3.5" />
              {busy === "PUBLICATION" ? "Assembling…" : "Export Publication PDF"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={saveIssue}
                className="border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary rounded-sm flex items-center justify-center gap-1.5"
              >
                <Save className="h-3 w-3" /> Save issue
              </button>
              <label className="border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary cursor-pointer text-center rounded-sm flex items-center justify-center gap-1.5">
                <Upload className="h-3 w-3" /> Load issue
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => loadIssue(e.target.files?.[0])}
                />
              </label>
            </div>
            <button
              onClick={() => downloadIdml(issue, issueSlug || "issue", idmlDim)}
              className="w-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary rounded-sm flex items-center justify-center gap-1.5"
              title="Download a .zip containing the InDesign-editable IDML file"
            >
              <FileText className="h-3 w-3" /> Export to InDesign (IDML .zip)
            </button>
            <button
              onClick={async () => {
                if (busy) return;
                setBusy("IDML_PKG");
                try {
                  const { fetched, skipped } = await downloadIdmlPackage(
                    issue,
                    issueSlug || "issue",
                    idmlDim,
                  );
                  if (skipped.length) {
                    alert(
                      `Package ready: ${fetched} image(s) bundled, ${skipped.length} skipped (likely CORS-blocked). See relink-manifest.txt — relink those in InDesign manually.`,
                    );
                  }
                } catch (e) {
                  alert(`Could not build package: ${(e as Error).message}`);
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy === "IDML_PKG"}
              className="w-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary rounded-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
              title="Download a ZIP containing the IDML plus a Links/ folder of all referenced images"
            >
              <Download className="h-3 w-3" />
              {busy === "IDML_PKG" ? "Fetching images…" : "InDesign package (IDML + Links)"}
            </button>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Save JSON = your monthly source of truth. Reload it next issue, edit, re-export.
              IDML opens in Adobe InDesign for finishing. The package version also bundles every
              image into a <code>Links/</code> folder so you can relink with one click
              (Links panel → Relink to Folder).
            </p>
          </Section>
        </aside>
        </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          panelRef={middlePanelRef}
          id="ws-middle"
          defaultSize={26}
          minSize={18}
          maxSize={42}
          collapsible
          collapsedSize={0}
          onResize={(size) => setMiddleCollapsed(size.asPercentage < 1)}
        >
        <div className="h-full overflow-y-auto px-3">
        {/* Editor for selected page */}
        <aside className="space-y-6">
          <Section title="Page layout">
            <div className="space-y-2">
              <Select value={selectedLayout} onValueChange={(v) => requestLayoutChange(v as PageLayout)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_LAYOUTS.map((l) => (
                    <SelectItem key={l} value={l}>
                      <span className="flex flex-col">
                        <span className="text-sm">{PAGE_LAYOUT_LABELS[l]}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {PAGE_LAYOUT_DESCRIPTIONS[l]}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {PAGE_LAYOUT_DESCRIPTIONS[selectedLayout]} Saved per page.
              </p>
              {PAGE_LAYOUT_COLUMNS[selectedLayout] > 1 && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <ColumnTuningControls
                    layout={selectedLayout}
                    widths={pageStatus.columnWidthsOf(selected.id)}
                    gutterIn={pageStatus.gutterOf(selected.id)}
                    onChange={(patch) => pageStatus.setColumnTuning(selected.id, patch)}
                    presets={layoutPresets.presetsFor(selectedLayout)}
                    onSavePreset={(name) =>
                      layoutPresets.save({
                        name,
                        layout: selectedLayout,
                        column_widths: pageStatus.columnWidthsOf(selected.id),
                        gutter_in: pageStatus.gutterOf(selected.id),
                      })
                    }
                    onDeletePreset={(id) => layoutPresets.remove(id)}
                  />
                </div>
              )}
            </div>
          </Section>
          {selected.pageType === "cover" && (
            <CoverEditor
              data={selected.data as CoverData}
              set={(p) => updateData<typeof selected>(selected.id, p)}
            />
          )}
          {selected.pageType === "article" && (
            <ArticleEditor
              data={selected.data as ArticleData}
              set={(p) => updateData<typeof selected>(selected.id, p)}
            />
          )}
          {selected.pageType === "photo" && (
            <PhotoEditor
              data={selected.data as PhotoData}
              set={(p) => updateData<typeof selected>(selected.id, p)}
            />
          )}
          {selected.pageType === "contents" && (
            <ContentsEditor
              data={selected.data as ContentsData}
              set={(p) => updateData<typeof selected>(selected.id, p)}
            />
          )}
          {selected.pageType === "ad" && (
            <AdEditor
              data={selected.data as AdData}
              set={(p) => updateData<typeof selected>(selected.id, p)}
            />
          )}
          {selected.pageType === "back" && (
            <BackCoverEditor
              data={selected.data as BackCoverData}
              set={(p) => updateData<typeof selected>(selected.id, p)}
            />
          )}

          {selected.pageType !== "cover" &&
            selected.pageType !== "back" &&
            selected.pageType !== "contents" && (
              <Section title="Contents listing">
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={selected.includeInContents}
                    onChange={(e) => updateNode(selected.id, { includeInContents: e.target.checked })}
                    className="accent-[color:var(--ruby)]"
                  />
                  Show this page in the Contents index
                </label>
              </Section>
            )}

          {selected.pageType !== "cover" && selected.pageType !== "back" && (
            <Section title="References for this page" defaultOpen>
              <PageReferencesEditor
                pageId={selected.id}
                references={attachments.referencesByPage.get(selected.id) ?? []}
                columnCount={PAGE_LAYOUT_COLUMNS[pageStatus.layoutOf(selected.id)] ?? 1}
                onUpload={(file) =>
                  attachments.upload({ pageId: selected.id, kind: "reference", file })
                }
                onRemove={(row) => attachments.remove(row)}
                onAssign={(id, patch) => attachments.updateAssignment(id, patch)}
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground mt-2">
                Multiple files allowed. Pin each to a region (column / header / footer) or
                a free-form coordinate. The editor sees PDFs and images directly; Word docs are
                converted to text.
              </p>
            </Section>
          )}


          <Section title="Export · this page">
            <div className="grid grid-cols-3 gap-2">
              <ExportBtn onClick={() => doExport("pdf")} busy={busy === "PDF"}>PDF</ExportBtn>
              <ExportBtn onClick={() => doExport("png")} busy={busy === "PNG"}>PNG</ExportBtn>
              <ExportBtn onClick={() => doExport("jpg")} busy={busy === "JPG"}>JPG</ExportBtn>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground mt-3">
              Single-page export at {dimInches.w}″ × {dimInches.h}″ for InDesign, Canva, and Fresco.
            </p>
          </Section>
        </aside>
        </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="ws-canvas" defaultSize={54} minSize={30}>
        <div className="h-full overflow-y-auto pl-3 flex flex-col gap-3">
          {/* Canvas ribbon — most-used controls + panel collapse toggles */}
          <div className="border border-border bg-card rounded-sm px-2 py-1.5 flex items-center gap-2 flex-wrap sticky top-0 z-10">
            <button
              onClick={toggleLeftPanel}
              className="p-1.5 rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground transition"
              title={leftCollapsed ? "Show pages panel" : "Hide pages panel"}
              aria-label={leftCollapsed ? "Show pages panel" : "Hide pages panel"}
            >
              {leftCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleMiddlePanel}
              className="p-1.5 rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground transition"
              title={middleCollapsed ? "Show edit panel" : "Hide edit panel"}
              aria-label={middleCollapsed ? "Show edit panel" : "Hide edit panel"}
            >
              {middleCollapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </button>
            <div className="h-5 w-px bg-border mx-1" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hidden sm:inline">View</span>
            <div className="inline-flex border border-border rounded-sm overflow-hidden">
              <button
                onClick={() => setSpreadView(false)}
                className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase transition ${!spreadView ? "bg-foreground text-background" : "hover:bg-secondary"}`}
              >
                Single
              </button>
              <button
                onClick={() => setSpreadView(true)}
                className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase transition ${spreadView ? "bg-foreground text-background" : "hover:bg-secondary"}`}
              >
                Spread
              </button>
            </div>
            <button
              onClick={() => setShowGuides((v) => !v)}
              className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm transition ${showGuides ? "bg-foreground text-background" : "hover:bg-secondary"}`}
              title="Toggle non-printing margin & bleed guides"
            >
              {showGuides ? "Guides on" : "Guides off"}
            </button>
            <button
              onClick={() => setEditLayout((v) => !v)}
              className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm transition ${editLayout ? "bg-foreground text-background" : "hover:bg-secondary"}`}
              title="Drag blocks to reposition them on the page"
            >
              {editLayout ? "Done" : "Drag blocks"}
            </button>
            {editLayout && selectedHasOverrides && (
              <button
                onClick={() => resetOverrides(selected.id)}
                className="px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase border border-border rounded-sm hover:bg-secondary"
                title="Reset all block positions on this page"
              >
                Reset
              </button>
            )}
            <div className="h-5 w-px bg-border mx-1" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hidden lg:inline">
              Layout
            </span>
            <Select value={selectedLayout} onValueChange={(v) => requestLayoutChange(v as PageLayout)}>
              <SelectTrigger
                className="h-7 w-[170px] text-xs"
                title="Choose a layout template for this page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_LAYOUTS.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs">
                    {PAGE_LAYOUT_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-[10px] tracking-[0.3em] uppercase text-muted-foreground hidden md:inline">
              {dimInches.w}″ × {dimInches.h}″
            </span>
          </div>
          {editLayout && (
            <p className="text-[10px] leading-relaxed text-muted-foreground px-1">
              Drag any outlined block on the page. Use the <strong>+ Add</strong> palette in the top-right of the page to add text, images, shapes, QR codes, or link buttons anywhere. Click an added element to edit, resize, or delete it.
            </p>
          )}

        {/* Preview */}
        <section
          ref={stageRef}
          className="relative bg-secondary/60 border border-border overflow-hidden flex-1"
          style={{ minHeight: "70vh", aspectRatio: `${stageW / dimPx.h}` }}
        >
          <div
            className="absolute left-1/2 top-1/2 origin-center"
            style={{
              transform: `translate(-50%, -50%) scale(${scale})`,
              width: stageW,
              height: dimPx.h,
              display: "flex",
              gap: 0,
            }}
          >
            <div
              className="shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]"
              style={{ width: dimPx.w, height: dimPx.h, position: "relative" }}
            >
              <LayoutEditProvider
                editing={editLayout && spread.left.id === selected.id}
                scale={scale}
                overrides={spread.left.positionOverrides ?? {}}
                setOverride={(k, v) => setOverride(spread.left.id, k, v)}
                textScales={spread.left.textScales ?? {}}
                setTextScale={(k, v) => setTextScale(spread.left.id, k, v)}
                blockLinks={spread.left.blockLinks ?? {}}
                setBlockLink={(k, v) => setBlockLink(spread.left.id, k, v)}
                previewOverrides={pendingByPage[spread.left.id]?.overrides}
                previewScales={pendingByPage[spread.left.id]?.scales}
                customBlocks={spread.left.customBlocks ?? []}
                setCustomBlocks={(next) => setCustomBlocks(spread.left.id, next)}
                guides={showGuides ? guidesFor(spread.left) : undefined}
                snapSettings={effectiveSnapFor(spread.left)}
              >
                <PagePreview pageType={spread.left.pageType} data={spread.left.data} dim={dimPx} />
              </LayoutEditProvider>
              {showGuides && (
                <GuidesOverlay
                  dim={dimPx}
                  margins={pageMargins}
                  columns={PAGE_LAYOUT_COLUMNS[pageStatus.layoutOf(spread.left.id) ?? DEFAULT_PAGE_LAYOUT]}
                  columnRatios={pageStatus.columnWidthsOf(spread.left.id)}
                  gutterIn={pageStatus.gutterOf(spread.left.id)}
                />
              )}
            </div>
            {spreadView && spread.right && (
              <div
                className="shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]"
                style={{ width: dimPx.w, height: dimPx.h, position: "relative" }}
              >
                <LayoutEditProvider
                  editing={editLayout && spread.right.id === selected.id}
                  scale={scale}
                  overrides={spread.right.positionOverrides ?? {}}
                  setOverride={(k, v) => setOverride(spread.right!.id, k, v)}
                  textScales={spread.right.textScales ?? {}}
                  setTextScale={(k, v) => setTextScale(spread.right!.id, k, v)}
                  blockLinks={spread.right.blockLinks ?? {}}
                  setBlockLink={(k, v) => setBlockLink(spread.right!.id, k, v)}
                  previewOverrides={pendingByPage[spread.right.id]?.overrides}
                  previewScales={pendingByPage[spread.right.id]?.scales}
                  customBlocks={spread.right.customBlocks ?? []}
                  setCustomBlocks={(next) => setCustomBlocks(spread.right!.id, next)}
                  guides={showGuides ? guidesFor(spread.right) : undefined}
                  snapSettings={effectiveSnapFor(spread.right)}
                >
                  <PagePreview pageType={spread.right.pageType} data={spread.right.data} dim={dimPx} />
                </LayoutEditProvider>
                {showGuides && (
                  <GuidesOverlay
                    dim={dimPx}
                    margins={pageMargins}
                    columns={PAGE_LAYOUT_COLUMNS[pageStatus.layoutOf(spread.right.id) ?? DEFAULT_PAGE_LAYOUT]}
                    columnRatios={pageStatus.columnWidthsOf(spread.right!.id)}
                    gutterIn={pageStatus.gutterOf(spread.right!.id)}
                  />
                )}
              </div>
            )}
          </div>
        </section>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      </div>


      {/* Off-screen capture stage — one ref per page in the issue. */}
      <div
        aria-hidden
        style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none", opacity: 0 }}
      >
        {pagesForRender.map((p) => (
          <LayoutEditProvider
            key={p.id}
            editing={false}
            scale={1}
            overrides={p.positionOverrides ?? {}}
            setOverride={() => {}}
            textScales={p.textScales ?? {}}
            setTextScale={() => {}}
            blockLinks={p.blockLinks ?? {}}
            setBlockLink={() => {}}
            customBlocks={p.customBlocks ?? []}
            setCustomBlocks={() => {}}
          >
            <PagePreview ref={setRef(p.id)} pageType={p.pageType} data={p.data} dim={dimPx} />
          </LayoutEditProvider>
        ))}
      </div>


      <footer className="border-t border-border mt-8">
        <div className="mx-auto max-w-full px-4 py-6 text-[11px] tracking-[0.3em] uppercase text-muted-foreground flex justify-between flex-wrap gap-4">
          <span>The Arts Today · Editorial Page System</span>
          <span>Page size · {dimInches.w} × {dimInches.h} in</span>
        </div>
      </footer>

      <AttachmentsPanel
        open={attachmentsOpen}
        onClose={() => setAttachmentsOpen(false)}
        issueId={issue.meta.issueId}
        publicationId={activePublication?.id ?? null}
        publicationName={activePublication?.name ?? null}
        selectedPageId={selected.id}
        selectedPageLabel={selected.pageType}
        attachments={attachments}
      />

      <StaffPanel
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        issue={issue}
        publicationId={activePublication?.id ?? null}
        publicationName={activePublication?.name ?? null}
        selectedPageId={selected.id}
      />

      <ProductionChecklist
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        userId={userId}
        issueId={issue.meta.issueId}
        publicationId={activePublication?.id ?? null}
        pages={issue.pages.map((p) => ({
          id: p.id,
          label:
            (p.data as { title?: string; headline?: string })?.title ??
            (p.data as { headline?: string })?.headline ??
            p.pageType,
          pageType: p.pageType,
        }))}
        onSelectPage={(pid) => setSelectedId(pid)}
      />


      <AssistantPanel
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        issue={issue}
        setIssue={setIssue}
        attachments={attachments.rows}
        selectedPageId={selected.id}
        onSelectPage={(pid) => setSelectedId(pid)}
        pendingSpatial={pendingSpatial}
        onProposeSpatial={(p) =>
          setPendingSpatial((prev) =>
            prev.some((x) => x.toolCallId === p.toolCallId) ? prev : [...prev, p],
          )
        }
        onResolvePending={(toolCallId, action) => {
          setPendingSpatial((prev) => {
            const target = prev.find((p) => p.toolCallId === toolCallId);
            if (!target) return prev;
            if (action === "apply") {
              if (target.kind === "move_block") {
                setOverride(
                  target.pageId,
                  target.blockKey,
                  target.reset ? null : { dx: target.dx ?? 0, dy: target.dy ?? 0 },
                );
              } else {
                setTextScale(
                  target.pageId,
                  target.blockKey,
                  target.reset || target.scale === 1 ? null : (target.scale ?? 1),
                );
              }
            }
            return prev.filter((p) => p.toolCallId !== toolCallId);
          });
        }}
      />

      {/* Confirm reflow when switching to a templated layout on a page that
          already has hand-placed blocks or repositioned content. */}
      <AlertDialog
        open={pendingLayout !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLayout(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch to “{pendingLayout ? PAGE_LAYOUT_LABELS[pendingLayout] : ""}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This page has{" "}
              {selectedCustomBlockCount > 0
                ? `${selectedCustomBlockCount} custom block${selectedCustomBlockCount === 1 ? "" : "s"}`
                : "manually positioned content"}
              . Applying a new layout will reset block positions so they reflow
              into the new template. Custom blocks you added are kept, but
              their offsets will return to the template defaults. This action
              cannot be undone for layout changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingLayout(null)}>
              Keep current layout
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const next = pendingLayout;
                setPendingLayout(null);
                if (next) void commitLayoutChange(next);
              }}
            >
              Apply and reflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function labelForNode(p: IssuePageNode): string {
  switch (p.pageType) {
    case "cover":
      return p.data.headline || "Cover";
    case "contents":
      return "Inside this issue";
    case "article":
      return p.data.headline || "Untitled article";
    case "photo":
      return p.data.title || "Photo essay";
    case "ad":
      return p.data.brand || "Advertisement";
    case "back":
      return "Back cover";
  }
}

/* ============ EDITORS ============ */

function CoverEditor({
  data,
  set,
}: {
  data: CoverData;
  set: (p: Partial<CoverData>) => void;
}) {
  return (
    <>
      <Section title="Cover badge">
        <Field label="Issue badge"><Input value={data.price} onChange={(v) => set({ price: v })} /></Field>
      </Section>
      <Section title="Masthead">
        <Field label="Title"><Input value={data.masthead} onChange={(v) => set({ masthead: v })} /></Field>
        <Field label="Tagline"><Input value={data.tagline} onChange={(v) => set({ tagline: v })} /></Field>
        <Field label="Logo image (replaces title when present)">
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || !f.type.startsWith("image/")) return;
                const r = new FileReader();
                r.onload = () => set({ mastheadLogoUrl: String(r.result) });
                r.readAsDataURL(f);
              }}
              className="block w-full text-sm file:mr-3 file:rounded-none file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest file:cursor-pointer"
            />
            {data.mastheadLogoUrl && (
              <div className="flex items-center gap-3">
                <img src={data.mastheadLogoUrl} alt="" className="h-10 max-w-[160px] object-contain border border-border bg-white p-1" />
                <button
                  onClick={() => set({ mastheadLogoUrl: null })}
                  className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-destructive"
                >
                  Remove logo
                </button>
              </div>
            )}
          </div>
        </Field>
      </Section>
      <Section title="Cover Story">
        <Field label="Headline"><Input value={data.headline} onChange={(v) => set({ headline: v })} /></Field>
        <Field label="Dek"><Textarea value={data.dek} onChange={(v) => set({ dek: v })} rows={3} /></Field>
        <Field label="Feature line"><Input value={data.feature} onChange={(v) => set({ feature: v })} /></Field>
        <Field label="Image credit"><Input value={data.credit} onChange={(v) => set({ credit: v })} /></Field>
      </Section>
      <Section title="QR Code">
        <Field label="URL (leave empty to hide)"><Input value={data.qrUrl} onChange={(v) => set({ qrUrl: v })} /></Field>
        <Field label="Caption"><Input value={data.qrCaption} onChange={(v) => set({ qrCaption: v })} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit={data.imageFit}
        onFit={(f) => set({ imageFit: f })}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
      />
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
        <LogoColorField value={data.logoColor} onChange={(v) => set({ logoColor: v })} />
        <Field label="Layout">
          <div className="flex gap-2 flex-wrap">
            {(["classic", "edge", "framed"] as const).map((l) => (
              <Chip key={l} active={data.layout === l} onClick={() => set({ layout: l })}>
                {l}
              </Chip>
            ))}
          </div>
        </Field>
      </Section>
    </>
  );
}

function ArticleEditor({
  data,
  set,
}: {
  data: ArticleData;
  set: (p: Partial<ArticleData>) => void;
}) {
  return (
    <>
      <Section title="Article">
        <Field label="Section eyebrow"><Input value={data.section} onChange={(v) => set({ section: v })} /></Field>
        <Field label="Headline"><Textarea value={data.headline} onChange={(v) => set({ headline: v })} rows={2} /></Field>
        <Field label="Dek"><Textarea value={data.dek} onChange={(v) => set({ dek: v })} rows={3} /></Field>
        <Field label="Byline"><Input value={data.byline} onChange={(v) => set({ byline: v })} /></Field>
      </Section>
      <Section title="Body">
        <Field label="Body copy (blank line = new paragraph)">
          <Textarea value={data.body} onChange={(v) => set({ body: v })} rows={14} />
        </Field>
        <Field label="Pull quote"><Textarea value={data.pullQuote} onChange={(v) => set({ pullQuote: v })} rows={3} /></Field>
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <input
            type="checkbox"
            checked={data.dropCap}
            onChange={(e) => set({ dropCap: e.target.checked })}
            className="accent-[color:var(--ruby)]"
          />
          Drop cap
        </label>
      </Section>
      <Section title="Image">
        <Field label="Caption"><Textarea value={data.imageCaption} onChange={(v) => set({ imageCaption: v })} rows={2} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit="cover"
        onFit={() => {}}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
        hideFit
      />
      <Section title="Layout">
        <Field label="Page layout preset">
          <select
            value={data.layout}
            onChange={(e) => set({ layout: e.target.value as ArticleLayout })}
            className="w-full border border-input bg-background px-2 py-1.5 text-sm"
          >
            {ARTICLE_LAYOUTS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
      </Section>
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
    </>
  );
}

function PhotoEditor({
  data,
  set,
}: {
  data: PhotoData;
  set: (p: Partial<PhotoData>) => void;
}) {
  return (
    <>
      <Section title="Photo essay">
        <Field label="Section"><Input value={data.section} onChange={(v) => set({ section: v })} /></Field>
        <Field label="Title"><Input value={data.title} onChange={(v) => set({ title: v })} /></Field>
        <Field label="Caption"><Textarea value={data.caption} onChange={(v) => set({ caption: v })} rows={4} /></Field>
        <Field label="Credit"><Input value={data.credit} onChange={(v) => set({ credit: v })} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit={data.imageFit}
        onFit={(f) => set({ imageFit: f })}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
      />
      <Section title="Style">
        <Field label="Layout">
          <div className="flex gap-2 flex-wrap">
            {(["full-bleed", "framed", "split"] as const).map((l) => (
              <Chip key={l} active={data.layout === l} onClick={() => set({ layout: l })}>
                {l}
              </Chip>
            ))}
          </div>
        </Field>
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
    </>
  );
}

function AdEditor({ data, set }: { data: AdData; set: (p: Partial<AdData>) => void }) {
  return (
    <>
      <Section title="Advertisement">
        <Field label="Eyebrow"><Input value={data.eyebrow} onChange={(v) => set({ eyebrow: v })} /></Field>
        <Field label="Brand"><Input value={data.brand} onChange={(v) => set({ brand: v })} /></Field>
        <Field label="Headline"><Textarea value={data.headline} onChange={(v) => set({ headline: v })} rows={2} /></Field>
        <Field label="Body"><Textarea value={data.body} onChange={(v) => set({ body: v })} rows={4} /></Field>
        <Field label="Call-to-action"><Input value={data.cta} onChange={(v) => set({ cta: v })} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit="cover"
        onFit={() => {}}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
        hideFit
      />
      <Section title="Style">
        <Field label="Layout">
          <div className="flex gap-2 flex-wrap">
            {(["full-bleed", "framed", "split"] as const).map((l) => (
              <Chip key={l} active={data.layout === l} onClick={() => set({ layout: l })}>
                {l}
              </Chip>
            ))}
          </div>
        </Field>
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
        <LogoColorField value={data.logoColor} onChange={(v) => set({ logoColor: v })} />
      </Section>
    </>
  );
}

function BackCoverEditor({
  data,
  set,
}: {
  data: BackCoverData;
  set: (p: Partial<BackCoverData>) => void;
}) {
  return (
    <>
      <Section title="Back cover">
        <Field label="Masthead"><Input value={data.masthead} onChange={(v) => set({ masthead: v })} /></Field>
        <Field label="Closing quote"><Textarea value={data.quote} onChange={(v) => set({ quote: v })} rows={3} /></Field>
        <Field label="Attribution"><Input value={data.attribution} onChange={(v) => set({ attribution: v })} /></Field>
      </Section>
      <ImageBlock
        url={data.imageUrl}
        onUrl={(u) => set({ imageUrl: u })}
        fit="cover"
        onFit={() => {}}
        y={data.imageY}
        onY={(y) => set({ imageY: y })}
        hideFit
      />
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
        <LogoColorField value={data.logoColor} onChange={(v) => set({ logoColor: v })} />
      </Section>
    </>
  );
}

function ContentsEditor({
  data,
  set,
}: {
  data: ContentsData;
  set: (p: Partial<ContentsData>) => void;
}) {
  return (
    <>
      <Section title="Contents page">
        <Field label="Intro"><Textarea value={data.intro} onChange={(v) => set({ intro: v })} rows={4} /></Field>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Entries auto-fill from pages flagged “Show in Contents.” Reorder pages in the list at left to update page numbers and order automatically. Each entry is a clickable link in the exported Publication PDF.
        </p>
      </Section>
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
    </>
  );
}

/* ============ PRIMITIVES ============ */

function ImageBlock({
  url,
  onUrl,
  fit,
  onFit,
  y,
  onY,
  hideFit,
}: {
  url: string | null;
  onUrl: (u: string | null) => void;
  fit: "cover" | "contain";
  onFit: (f: "cover" | "contain") => void;
  y: number;
  onY: (y: number) => void;
  hideFit?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const focalRef = useRef<HTMLDivElement>(null);
  const handle = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => onUrl(String(r.result));
    r.readAsDataURL(file);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handle(e.dataTransfer.files?.[0]);
  };
  const updateFocalFromEvent = (clientY: number) => {
    const el = focalRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    onY(pct);
  };
  return (
    <Section title="Image">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed p-3 transition ${
          dragOver ? "border-[color:var(--ruby)] bg-secondary" : "border-border"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handle(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-none file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest file:cursor-pointer"
        />
        <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-2">
          {dragOver ? "Drop to upload" : "Or drag an image file here"}
        </p>
      </div>
      {url && (
        <button
          onClick={() => onUrl(null)}
          className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground hover:text-destructive"
        >
          Remove image
        </button>
      )}
      {!hideFit && (
        <Field label="Fit">
          <div className="flex gap-2">
            {(["cover", "contain"] as const).map((f) => (
              <Chip key={f} active={fit === f} onClick={() => onFit(f)}>
                {f}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <Field label={`Focal · ${y}% · drag the line`}>
        {url ? (
          <div
            ref={focalRef}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              updateFocalFromEvent(e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) updateFocalFromEvent(e.clientY);
            }}
            className="relative w-full overflow-hidden border border-border cursor-ns-resize select-none"
            style={{ aspectRatio: "4 / 3", background: "#000" }}
          >
            <img
              src={url}
              alt=""
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: fit,
                objectPosition: `center ${y}%`,
                pointerEvents: "none",
                display: "block",
              }}
            />
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: `${y}%`,
                height: 2,
                background: "var(--ruby)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
                transform: "translateY(-1px)",
              }}
            />
          </div>
        ) : null}
        <input
          type="range"
          min={0}
          max={100}
          value={y}
          onChange={(e) => onY(Number(e.target.value))}
          className="w-full accent-[color:var(--ruby)] mt-2"
        />
      </Field>
    </Section>
  );
}

function PaletteField({
  value,
  onChange,
}: {
  value: Palette;
  onChange: (p: Palette) => void;
}) {
  return (
    <Field label="Palette">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(PALETTES) as Palette[]).map((p) => {
          const pal = PALETTES[p];
          const active = value === p;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`flex items-center gap-2 border px-2 py-2 text-[10px] uppercase tracking-widest transition ${
                active ? "border-foreground" : "border-border hover:border-foreground/50"
              }`}
            >
              <span className="h-4 w-4 border border-border" style={{ background: pal.bg }} />
              <span className="h-4 w-4 -ml-1 border border-border" style={{ background: pal.rule }} />
              {pal.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function LogoColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Logo color">
      <div className="flex gap-2 flex-wrap items-center">
        {LOGO_COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            title={c.label}
            className={`h-7 w-7 rounded-full border-2 transition ${
              value === c.value ? "border-[color:var(--ruby)] scale-110" : "border-border"
            }`}
            style={{ background: c.value }}
          />
        ))}
        <label className="h-7 w-7 rounded-full border-2 border-border overflow-hidden relative cursor-pointer">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px]">+</span>
        </label>
      </div>
    </Field>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border border-border bg-card rounded-sm group/section">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/60 transition border-b border-transparent data-[state=open]:border-border">
        <span className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground group-hover/section:text-foreground transition">
          {title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180 group-data-[state=open]/section:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="p-4 space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
function Input({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-foreground"
      style={{ fontFamily: "var(--font-serif)" }}
    />
  );
}
function Textarea({
  value,
  onChange,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none"
      style={{ fontFamily: "var(--font-serif)" }}
    />
  );
}
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 border text-[10px] uppercase tracking-[0.3em] transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:border-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}
function ExportBtn({
  onClick,
  busy,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="border border-foreground px-3 py-2.5 text-[11px] uppercase tracking-[0.3em] hover:bg-foreground hover:text-background transition disabled:opacity-60"
    >
      {busy ? "…" : children}
    </button>
  );
}
function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="border border-border px-2 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary"
    >
      {children}
    </button>
  );
}

function MasterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[color:var(--ruby)]"
      />
      {label}
    </label>
  );
}

function FontPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FontOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.stack === value);
  return (
    <label className="block space-y-1">
      <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-input bg-background px-2 py-1.5 text-sm"
        style={{ fontFamily: value }}
      >
        {options.map((o) => (
          <option key={o.label} value={o.stack} style={{ fontFamily: o.stack }}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="block text-base leading-tight text-foreground/80 pt-0.5"
        style={{ fontFamily: value }}
      >
        {current?.label ?? "Aa"} — The Quick Brown Fox
      </span>
    </label>
  );
}
