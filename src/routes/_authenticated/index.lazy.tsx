import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { confirmDiscardUnsaved } from "@/lib/unsavedGuards";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RAIL_BUTTON_CLASS } from "@/components/editor/EditorRail";
import { EditorStatusBar } from "@/components/editor/EditorStatusBar";
import { Aperture, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Plus, Sparkles, Download, Save, Upload, Trash2, FileText, Image as ImageIcon, Megaphone, ListOrdered, Layers, Paperclip, Users, ClipboardList, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Undo2, Redo2, Mail, Type, Settings2, BookOpen, SquarePen, Search, X, Wand2, KanbanSquare, CalendarDays } from "lucide-react";
import { NewsletterDialog } from "@/components/NewsletterDialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { usePanelRef } from "react-resizable-panels";
import { PagePreview } from "@/components/PagePreview";
import { GuidesOverlay } from "@/components/GuidesOverlay";
import { RulersOverlay } from "@/components/RulersOverlay";
import { useMeasureUnit, type MeasureUnit } from "@/lib/measure";
import { ReferencePinsOverlay } from "@/components/ReferencePinsOverlay";
import { ColumnTuningControls } from "@/components/ColumnTuningControls";
import { SnapSettingsPanel } from "@/components/SnapSettingsPanel";
import { useSnapSettings, mergeSnapSettings, type SnapSettings } from "@/lib/snapSettings";
import { LayoutEditProvider } from "@/components/LayoutEdit";
import { SortableList } from "@/components/SortableItem";
import { AssistantPanel } from "@/components/AssistantPanel";
import { GeneratorStudio, type GeneratorBrandContext } from "@/components/GeneratorStudio";
import { AttachmentControl } from "@/components/AttachmentControl";
import { PageReferencesEditor } from "@/components/PageReferencesEditor";
import { PageBackgroundUploader, type BackgroundAssignment } from "@/components/PageBackgroundUploader";
import { deleteBackground } from "@/lib/pageBackgrounds";
import { uploadEditorImage, migrateBase64Images } from "@/lib/imageUpload";
import { toast } from "sonner";
import { EditorMobileGuard } from "@/components/EditorMobileGuard";
import { useIsMobile } from "@/hooks/use-mobile";

import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { StaffPanel } from "@/components/StaffPanel";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { ProductionChecklist } from "@/components/ProductionChecklist";
import { IssueTemplatesPanel } from "@/components/IssueTemplatesPanel";
import { MagazineTemplatePicker } from "@/components/MagazineTemplatePicker";
import { LayoutProposalPanel } from "@/components/LayoutProposalPanel";
import { VersionHistoryPanel } from "@/components/VersionHistoryPanel";
import { CommentsPanel } from "@/components/CommentsPanel";
import { LayoutProposalOverlay } from "@/components/LayoutProposalOverlay";
import type { LayoutPlanOp } from "@/lib/proposeLayout.functions";
import { applyPatch } from "@/lib/issue-patch";
import { BrandKitPanel } from "@/components/BrandKitPanel";
import { BrandKitProvider } from "@/lib/brandKitContext";
import { ToolbarDiagnostics } from "@/components/ToolbarDiagnostics";

import { useIssueAttachments } from "@/hooks/useIssueAttachments";
import { useLibraryAttachments } from "@/hooks/useLibraryAttachments";
import { useBrandFonts } from "@/hooks/useBrandFonts";
import { useBrandSwatches } from "@/hooks/useBrandSwatches";
import { useIssuePageStatus } from "@/hooks/useIssuePageStatus";
import { useLayoutPresets } from "@/hooks/useLayoutPresets";
import { useActivePublication } from "@/hooks/useActivePublication";
import { getLastPositions, setLastPosition, type LastPosition } from "@/lib/publications";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { useAutosave } from "@/hooks/useAutosave";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useSyncQueueDrainer } from "@/hooks/useSyncQueueDrainer";
import { autosaveKey, loadAutosave, loadLastIssueId, saveLastIssueId } from "@/lib/issueAutosave";
import { fetchIssueDraft, upsertIssueDraft } from "@/lib/issueDrafts";
import { cleanupLegacyBase64Versions } from "@/lib/issueVersions";
import { enqueueDraft } from "@/lib/syncQueue";
import {
  baselineKey,
  hashOf,
  loadBaseline,
  saveBaseline,
} from "@/lib/issueSyncBaseline";
import {
  detectConflict,
  mergeIssues,
  type ConflictSide,
} from "@/lib/issueConflict";
import { DraftConflictDialog } from "@/components/DraftConflictDialog";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ARTICLE_LAYOUTS,
  DEFAULT_AD,
  DEFAULT_ARTICLE,
  DEFAULT_BACK,
  DEFAULT_BLANK,
  DEFAULT_CUSTOM_CONTENTS,
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
  resolveContentsSlot,
  formatPageNumber,
  googleFontsUrl,
  makeNode,
  newId,
  buildTokenContext,
  TOKEN_PRESETS,

  pageNumberFor,
  renderFolio,
  folioSideForIndex,
  computePhysicalIndices,
  normalizeParitySkip,
  MAX_PARITY_SKIP,
  normalizeFolioTemplate,
  type AdData,
  type ArticleData,
  type ArticleLayout,
  type BackCoverData,
  type BlankData,
  type ContentsSlot,
  type CustomContentsData,
  type ContentsData,
  type CoverData,
  type CoverTocEntry,
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

export const Route = createLazyFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const goProduction = useCallback(
    async (to: "/board" | "/calendar") => {
      const ok = await confirmDiscardUnsaved("leave the editor");
      if (!ok) return;
      navigate({ to });
    },
    [navigate],
  );
  const [issue, setIssue] = useState<IssueDoc>(() => {
    const base = makeDefaultIssue();
    // Apply onboarding hints once, if the first-run wizard left them behind.
    try {
      if (typeof window !== "undefined") {
        const name = window.localStorage.getItem("pageluxe:onboarding:issueName");
        const layoutRaw = window.localStorage.getItem("pageluxe:onboarding:layoutStyle");
        if (name) base.meta.issue = name;
        if (layoutRaw) {
          try {
            base.meta.layoutStyle = JSON.parse(layoutRaw);
          } catch {
            // ignore malformed onboarding payload
          }
        }
        if (name || layoutRaw) {
          window.localStorage.removeItem("pageluxe:onboarding:issueName");
          window.localStorage.removeItem("pageluxe:onboarding:layoutStyle");
        }
      }
    } catch {
      // localStorage may be unavailable (privacy mode); silently continue
    }
    return base;
  });
  const [migrationBanner, setMigrationBanner] = useState<"modernizing" | "done" | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(issue));
  const [newsletterOpen, setNewsletterOpen] = useState(false);
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
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const [stickyH, setStickyH] = useState(0);
  useEffect(() => {
    const el = stickyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setStickyH(el.getBoundingClientRect().height));
    ro.observe(el);
    setStickyH(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);
  // Mirror rail metrics to :root so portaled overlays (e.g. the docked +Add
  // toolbar rendered via createPortal on document.body) can read them.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--rail-top", `${stickyH}px`);
    root.style.setProperty("--rail-width", "56px");
    return () => {
      root.style.removeProperty("--rail-top");
      root.style.removeProperty("--rail-width");
    };
  }, [stickyH]);


  const [selectedId, setSelectedId] = useState<string>(() => issue.pages[0].id);
  // Cover TOC entries dispatch `pageluxe:goto-page` when clicked — jump the editor to that page.
  useEffect(() => {
    const onGoto = (ev: Event) => {
      const id = (ev as CustomEvent<string>).detail;
      if (typeof id === "string" && issue.pages.some((p) => p.id === id)) {
        setSelectedId(id);
      }
    };
    window.addEventListener("pageluxe:goto-page", onGoto as EventListener);
    return () => window.removeEventListener("pageluxe:goto-page", onGoto as EventListener);
  }, [issue.pages]);
  const [busy, setBusy] = useState<string | null>(null);
  const [spreadView, setSpreadView] = useState(false);
  const [editLayout, setEditLayout] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  const [measureUnit, setMeasureUnitPref] = useMeasureUnit();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [brandKitOpen, setBrandKitOpen] = useState(false);
  const [layoutAiOpen, setLayoutAiOpen] = useState(false);
  const [proposalOps, setProposalOps] = useState<LayoutPlanOp[]>([]);
  const [pagesQuery, setPagesQuery] = useState("");
  const { userId, active: activePublication } = useActivePublication();

  // ----- Getting-started hint: dismissible card for users who have a
  // publication but no saved issue drafts yet. Runs once per session at
  // mount and only paints if nothing has been auto-saved to the cloud.
  const [firstIssueHint, setFirstIssueHint] = useState(false);
  const firstIssueHintCheckedRef = useRef(false);
  useEffect(() => {
    if (!userId || firstIssueHintCheckedRef.current) return;
    firstIssueHintCheckedRef.current = true;
    try {
      if (window.localStorage.getItem("pageluxe:hint:firstIssueDismissed") === "1") return;
    } catch {
      // ignore
    }
    void (async () => {
      try {
        const { count, error } = await supabase
          .from("issue_drafts")
          .select("issue_id", { count: "exact", head: true })
          .eq("user_id", userId);
        if (error) return;
        if ((count ?? 0) === 0) setFirstIssueHint(true);
      } catch {
        // ignore — hint is purely optional
      }
    })();
  }, [userId]);
  const dismissFirstIssueHint = useCallback(() => {
    setFirstIssueHint(false);
    try {
      window.localStorage.setItem("pageluxe:hint:firstIssueDismissed", "1");
    } catch {
      // ignore
    }
  }, []);


  // ----- Continue where I left off: swap to last opened issueId on login. -----
  const lastIssueSwapRef = useRef(false);
  useEffect(() => {
    if (!userId || lastIssueSwapRef.current) return;
    lastIssueSwapRef.current = true;
    const last = loadLastIssueId(userId);
    if (last && last !== issue.meta.issueId) {
      setIssue((curr) => {
        const next = { ...curr, meta: { ...curr.meta, issueId: last } };
        lastSavedRef.current = JSON.stringify(next);
        return next;
      });
    }
  }, [userId, issue.meta.issueId]);

  // Remember which issue this user was last editing so a refresh reopens it.
  useEffect(() => {
    if (userId) saveLastIssueId(userId, issue.meta.issueId);
  }, [userId, issue.meta.issueId]);

  // Expose the current issueId to nested uploaders that can't be trivially
  // threaded through props (image blocks, masthead logo). See src/lib/imageUpload.ts.
  useEffect(() => {
    (window as unknown as { __pageluxeIssueId?: string }).__pageluxeIssueId =
      issue.meta.issueId;
  }, [issue.meta.issueId]);

  // One-time housekeeping per session: drop legacy bloated version snapshots
  // (pre image-storage migration) that still carry inline base64.
  const versionCleanupRanRef = useRef(false);
  useEffect(() => {
    if (!userId || versionCleanupRanRef.current) return;
    versionCleanupRanRef.current = true;
    void (async () => {
      try {
        const removed = await cleanupLegacyBase64Versions(userId);
        if (removed > 0) {
          console.info(`[issueVersions] pruned ${removed} legacy base64 snapshot(s)`);
        }
      } catch (err) {
        console.warn("[issueVersions] legacy cleanup failed", err);
      }
    })();
  }, [userId]);

  // ----- Autosave: persist the IssueDoc per (user, issueId) -----
  const autosaveKeyStr = useMemo(
    () => autosaveKey(userId ?? null, issue.meta.issueId),
    [userId, issue.meta.issueId],
  );
  const [autosaveRestoring, setAutosaveRestoring] = useState(true);
  const restoredKeyRef = useRef<string | null>(null);
  // Pending conflict between local autosave and cloud draft, awaiting user choice.
  const [conflict, setConflict] = useState<{
    local: ConflictSide;
    remote: ConflictSide;
  } | null>(null);
  const baselineKeyStr = useMemo(
    () => baselineKey(userId ?? null, issue.meta.issueId),
    [userId, issue.meta.issueId],
  );
  const baselineKeyRef = useRef(baselineKeyStr);
  baselineKeyRef.current = baselineKeyStr;

  /** Adopt a resolved snapshot (winner of restore / conflict choice). */
  const adoptSnapshot = useCallback(
    (next: IssueDoc, baselineTs: number | null) => {
      setIssue(next);
      lastSavedRef.current = JSON.stringify(next);
      if (!next.pages.some((p: IssuePageNode) => p.id === selectedId)) {
        setSelectedId(next.pages[0].id);
      }
      // baselineTs === null means "this snapshot still needs to be pushed"
      // (e.g. a merge result, or the user picked local-with-edits). In that
      // case we don't set a baseline so cloudSync will write it next.
      if (baselineTs != null) {
        saveBaseline(baselineKeyRef.current, {
          syncedAt: baselineTs,
          hash: hashOf(next),
        });
      }
    },
    [selectedId],
  );

  useEffect(() => {
    // Restore the newest snapshot we can find for this (user, issueId):
    // compare local autosave vs cloud draft. If BOTH changed since the last
    // synced baseline, surface a conflict dialog instead of silently picking.
    if (restoredKeyRef.current === autosaveKeyStr) return;
    restoredKeyRef.current = autosaveKeyStr;
    setAutosaveRestoring(true);
    setConflict(null);
    let cancelled = false;
    let needsUserChoice = false;
    (async () => {
      try {
        const local = loadAutosave<IssueDoc>(autosaveKeyStr);
        const localValid =
          local?.data?.pages?.length && local.data.meta?.issueId === issue.meta.issueId;
        const localSide: ConflictSide | null = localValid
          ? { data: local!.data as IssueDoc, ts: local!.savedAt }
          : null;

        let remoteSide: ConflictSide | null = null;
        if (userId) {
          try {
            const rec = await fetchIssueDraft<IssueDoc>(issue.meta.issueId);
            if (rec?.data?.pages?.length && rec.data.meta?.issueId === issue.meta.issueId) {
              remoteSide = {
                data: rec.data,
                ts: new Date(rec.client_updated_at).getTime(),
              };
            }
          } catch {
            // ignore cloud fetch errors; fall back to local
          }
        }

        const baseline = loadBaseline(baselineKeyStr);
        const detection = detectConflict(localSide, remoteSide, baseline?.hash ?? null);
        if (cancelled) return;

        if (detection.kind === "conflict" && localSide && remoteSide) {
          // Pause autosave/cloud sync until the user resolves the conflict.
          needsUserChoice = true;
          setConflict({ local: localSide, remote: remoteSide });
          return;
        }

        if (detection.winner) {
          // For local-only the cloud is still at baseline (we'll push the
          // local edits). For remote-only the cloud IS the new baseline.
          const baselineTs =
            detection.kind === "remote-only" || detection.kind === "agree"
              ? detection.winner.ts
              : null;
          adoptSnapshot(detection.winner.data, baselineTs);
          // Snapshot the serialized doc we just adopted. After the async
          // image migration finishes we compare the *current* issue state
          // (via setIssue's functional updater) against this baseline — if
          // it doesn't match, the user has edited during migration and we
          // must NOT clobber their work.
          const preMigrationJSON = JSON.stringify(detection.winner.data);
          // Show the "Modernizing images…" banner only when the winner
          // actually contains legacy base64 (checking upfront avoids a
          // useless banner for the more common resign-only pass).
          const hasLegacyBase64 = preMigrationJSON.includes("data:image/");
          if (hasLegacyBase64) setMigrationBanner("modernizing");
          // One-time migration: any legacy `data:image/…` blobs still living
          // in the doc get uploaded to storage and swapped for signed URLs.
          void (async () => {
            try {
              const { doc: migrated, migrated: count } = await migrateBase64Images(
                detection.winner!.data,
                issue.meta.issueId,
              );
              if (count > 0 && !cancelled) {
                let userEdited = false;
                setIssue((curr) => {
                  if (JSON.stringify(curr) !== preMigrationJSON) {
                    userEdited = true;
                    return curr;
                  }
                  lastSavedRef.current = JSON.stringify(migrated);
                  return migrated;
                });
                if (userEdited) {
                  console.warn(
                    "[autosave] skipping post-migration adopt — user edited during migration",
                  );
                  if (hasLegacyBase64) setMigrationBanner(null);
                  return;
                }
                if (!migrated.pages.some((p: IssuePageNode) => p.id === selectedId)) {
                  setSelectedId(migrated.pages[0].id);
                }
                if (hasLegacyBase64) {
                  setMigrationBanner("done");
                  setTimeout(() => setMigrationBanner(null), 2500);
                }
                toast.success(`Moved ${count} embedded image${count === 1 ? "" : "s"} to cloud storage`);
                if (userId) {
                  try {
                    const nowTs = Date.now();
                    await upsertIssueDraft<IssueDoc>({
                      userId,
                      issueId: migrated.meta.issueId,
                      publicationId: activePublication?.id ?? null,
                      issueLabel: migrated.meta.issue ?? null,
                      data: migrated,
                      clientUpdatedAt: nowTs,
                    });
                    saveBaseline(baselineKeyRef.current, {
                      syncedAt: nowTs,
                      hash: hashOf(migrated),
                    });
                  } catch (pushErr) {
                    console.warn("[autosave] post-migration cloud push failed", pushErr);
                  }
                }
              } else if (hasLegacyBase64) {
                setMigrationBanner(null);
              }
            } catch (err) {
              console.warn("[autosave] image migration failed", err);
              if (hasLegacyBase64) setMigrationBanner(null);
            }
          })();
        }
      } finally {
        if (!cancelled && !needsUserChoice) {
          setTimeout(() => setAutosaveRestoring(false), 0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveKeyStr]);

  // Refs to sync actions so the resolve handler (declared above the hooks)
  // can kick autosave/cloud/queue immediately when the user picks an option.
  const autosaveSaveNowRef = useRef<() => void>(() => {});
  const cloudSyncNowRef = useRef<() => void>(() => {});
  const queueDrainNowRef = useRef<() => void>(() => {});

  const handleConflictResolve = useCallback(
    (choice: "local" | "remote" | "merge") => {
      if (!conflict) return;
      const { local, remote } = conflict;
      let shouldPushImmediately = true;
      if (choice === "remote") {
        // Cloud is authoritative — adopt it as the new baseline; no push needed.
        adoptSnapshot(remote.data, remote.ts);
        shouldPushImmediately = false;
      } else if (choice === "local") {
        // Cloud will be overwritten on next push; no baseline yet.
        adoptSnapshot(local.data, null);
      } else {
        const preferNewer = local.ts >= remote.ts ? "local" : "remote";
        const merged = mergeIssues(local.data, remote.data, preferNewer);
        adoptSnapshot(merged, null);
      }
      setConflict(null);
      // Un-pause autosave + cloud sync, then immediately reconcile so the
      // resolved snapshot lands locally and remotely without waiting for the
      // debounce timers. Also drain any queued offline writes that piled up.
      setAutosaveRestoring(false);
      setTimeout(() => {
        autosaveSaveNowRef.current();
        if (shouldPushImmediately) cloudSyncNowRef.current();
        queueDrainNowRef.current();
      }, 0);
    },
    [conflict, adoptSnapshot],
  );

  const autosave = useAutosave(issue, {
    key: autosaveKeyStr,
    paused: autosaveRestoring,
    debounceMs: 1500,
    maxIntervalMs: 8000,
  });

  // ----- Cloud sync: mirror the autosaved draft to issue_drafts -----
  const cloudKey = userId ? `${userId}:${issue.meta.issueId}` : null;
  const cloudSync = useCloudSync<IssueDoc>({
    key: cloudKey,
    value: issue,
    paused: autosaveRestoring,
    debounceMs: 4000,
    push: async (value) => {
      if (!userId) throw new Error("Not signed in");
      const clientUpdatedAt = Date.now();
      try {
        const rec = await upsertIssueDraft<IssueDoc>({
          userId,
          issueId: value.meta.issueId,
          publicationId: activePublication?.id ?? null,
          issueLabel: value.meta.issue ?? null,
          data: value,
          clientUpdatedAt,
        });
        const serverTs = new Date(rec.client_updated_at).getTime();
        // Record the new last-known-good baseline so future restores can tell
        // local-only / remote-only drift apart from a real conflict.
        saveBaseline(baselineKeyRef.current, {
          syncedAt: serverTs,
          hash: hashOf(value),
        });
        return serverTs;
      } catch (err) {
        // Network/server failure → persist to the offline sync queue so it
        // survives reloads and gets uploaded automatically on reconnect.
        enqueueDraft<IssueDoc>(userId, {
          issueId: value.meta.issueId,
          publicationId: activePublication?.id ?? null,
          issueLabel: value.meta.issue ?? null,
          data: value,
          clientUpdatedAt,
          lastError: (err as Error).message,
        });
        throw err;
      }
    },
  });

  // ----- Offline sync queue drainer -----
  const queueDrainer = useSyncQueueDrainer<IssueDoc>({
    userId: userId ?? null,
    push: async (item) => {
      await upsertIssueDraft<IssueDoc>({
        userId: userId!,
        issueId: item.issueId,
        publicationId: item.publicationId,
        issueLabel: item.issueLabel,
        data: item.data,
        clientUpdatedAt: item.clientUpdatedAt,
      });
      // Drained queue entries also advance the baseline so we don't false-
      // positive a conflict on the next restore of the same issue.
      if (userId && item.issueId === issue.meta.issueId) {
        saveBaseline(baselineKey(userId, item.issueId), {
          syncedAt: item.clientUpdatedAt,
          hash: hashOf(item.data),
        });
      }
    },
  });
  // Keep the conflict-resolution action refs pointed at the latest hook
  // callbacks so resolving the dialog flushes autosave + cloud + queue now.
  autosaveSaveNowRef.current = autosave.saveNow;
  cloudSyncNowRef.current = cloudSync.syncNow;
  queueDrainNowRef.current = queueDrainer.drainNow;
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

  /** Resolve slots + their effective values for a single page. Returns
   *  undefined when the page is not a custom-contents page so the
   *  LayoutEditProvider does not show the slot dropdown. */
  const slotsForPage = (p: IssuePageNode) => {
    if (p.pageType !== "custom-contents") return { slots: undefined, resolved: undefined };
    const data = p.data as CustomContentsData;
    const resolved: Record<string, { headline: string; byline: string; pageNumber: string; imageUrl: string }> = {};
    for (const s of data.slots) resolved[s.id] = resolveContentsSlot(issue, s);
    return { slots: data.slots, resolved };
  };
  const attachments = useIssueAttachments(issue.meta.issueId, activePublication?.id ?? null);
  const libraryAttachments = useLibraryAttachments(activePublication?.id ?? null);
  const libraryLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of libraryAttachments.rows) map[r.id] = r.file_name;
    return map;
  }, [libraryAttachments.rows]);
  const brandFonts = useBrandFonts(activePublication?.id ?? null);
  const brandSwatches = useBrandSwatches(activePublication?.id ?? null);
  const brandKitContextValue = useMemo(
    () => ({
      fonts: brandFonts.fonts,
      swatches: brandSwatches.swatches,
      resolveFontCssFamily: brandFonts.resolveCssFamily,
      saveSwatch: brandSwatches.add,
      removeSwatch: brandSwatches.remove,
    }),
    [brandFonts.fonts, brandSwatches.swatches, brandFonts.resolveCssFamily, brandSwatches.add, brandSwatches.remove],
  );


  // ----- Placement undo / redo history -----
  // Records changes made via drag-on-canvas, sidebar pin edits, AttachmentsPanel
  // reassignments, and AI staff `place_attachment` calls so they can be reverted.
  type PlacementPatch = {
    page_id?: string | null;
    region?: string | null;
    position_x?: number | null;
    position_y?: number | null;
  };
  type PlacementHistoryEntry = {
    id: string;
    before: PlacementPatch;
    after: PlacementPatch;
    groupKey: string | null;
    /** Optional shared id so multi-target edits (e.g. nudging a multi-selection)
     *  undo/redo together as a single step. */
    batchId: string | null;
    lastAt: number;
  };
  const undoStackRef = useRef<PlacementHistoryEntry[]>([]);
  const redoStackRef = useRef<PlacementHistoryEntry[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const attachmentRowsRef = useRef(attachments.rows);
  useEffect(() => {
    attachmentRowsRef.current = attachments.rows;
  }, [attachments.rows]);

  // Coalescing window for fine adjustments (drag + nudges) on the same
  // attachment. Edits to the same id within this window are merged into the
  // previous undo entry so a long drag or a flurry of slider tweaks counts
  // as a single undo step.
  const GROUP_WINDOW_MS = 900;

  const flushPlacementGroup = useCallback(() => {
    // Force the next applyPlacement to start a fresh entry by clearing
    // the lastAt timestamp on every entry of the current batch on top
    // of the stack.
    const stack = undoStackRef.current;
    const top = stack[stack.length - 1];
    if (!top) return;
    if (top.batchId) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].batchId === top.batchId) stack[i].lastAt = 0;
        else break;
      }
    } else {
      top.lastAt = 0;
    }
  }, []);

  const applyPlacement = useCallback(
    async (
      id: string,
      patch: PlacementPatch,
      opts?: { silent?: boolean; groupKey?: string | null; batchId?: string | null },
    ) => {
      const current = attachmentRowsRef.current.find((r) => r.id === id);
      if (!current) return;
      const before: PlacementPatch = {};
      const after: PlacementPatch = {};
      let changed = false;
      for (const k of ["page_id", "region", "position_x", "position_y"] as const) {
        if (k in patch && patch[k] !== current[k]) {
          (before as Record<string, unknown>)[k] = current[k];
          (after as Record<string, unknown>)[k] = patch[k];
          changed = true;
        }
      }
      if (!changed) return;
      await attachments.updateAssignment(id, patch);
      if (!opts?.silent) {
        const now = Date.now();
        const groupKey = opts?.groupKey ?? null;
        const batchId = opts?.batchId ?? null;
        const stack = undoStackRef.current;

        // Find a mergeable existing entry for this id.
        // - With a groupKey: scan back for the latest matching (id, groupKey)
        //   within the time window. This lets multi-target nudges coalesce
        //   even when entries for other ids sit on top of it.
        // - Without a groupKey: only check the very top entry.
        let mergeIdx = -1;
        if (groupKey !== null) {
          for (let i = stack.length - 1; i >= 0; i--) {
            const e = stack[i];
            if (e.id === id && e.groupKey === groupKey && now - e.lastAt <= GROUP_WINDOW_MS) {
              mergeIdx = i;
              break;
            }
            // Don't merge across an older break (lastAt === 0 marker).
            if (e.lastAt === 0) break;
          }
        } else {
          const top = stack[stack.length - 1];
          if (
            top &&
            top.id === id &&
            top.groupKey === null &&
            now - top.lastAt <= GROUP_WINDOW_MS
          ) {
            mergeIdx = stack.length - 1;
          }
        }

        if (mergeIdx >= 0) {
          const entry = stack[mergeIdx];
          for (const k of ["page_id", "region", "position_x", "position_y"] as const) {
            if (k in after) {
              (entry.after as Record<string, unknown>)[k] = (after as Record<string, unknown>)[k];
              if (!(k in entry.before)) {
                (entry.before as Record<string, unknown>)[k] = (before as Record<string, unknown>)[k];
              }
            }
          }
          entry.lastAt = now;
        } else {
          stack.push({ id, before, after, groupKey, batchId, lastAt: now });
          if (stack.length > 200) stack.shift();
        }
        redoStackRef.current = [];
        setHistoryTick((t) => t + 1);
      }
    },
    [attachments],
  );

  const undoPlacement = useCallback(async () => {
    const stack = undoStackRef.current;
    const entry = stack.pop();
    if (!entry) return;
    const batch: PlacementHistoryEntry[] = [entry];
    if (entry.batchId) {
      while (stack.length && stack[stack.length - 1].batchId === entry.batchId) {
        batch.push(stack.pop()!);
      }
    }
    // Revert in reverse application order.
    for (const e of batch) {
      await attachments.updateAssignment(e.id, e.before);
    }
    // Restore on redo stack in original order so redo replays correctly.
    for (let i = batch.length - 1; i >= 0; i--) {
      redoStackRef.current.push(batch[i]);
    }
    flushPlacementGroup();
    setHistoryTick((t) => t + 1);
  }, [attachments, flushPlacementGroup]);

  const redoPlacement = useCallback(async () => {
    const stack = redoStackRef.current;
    const entry = stack.pop();
    if (!entry) return;
    const batch: PlacementHistoryEntry[] = [entry];
    if (entry.batchId) {
      while (stack.length && stack[stack.length - 1].batchId === entry.batchId) {
        batch.push(stack.pop()!);
      }
    }
    for (const e of batch) {
      await attachments.updateAssignment(e.id, e.after);
    }
    for (let i = batch.length - 1; i >= 0; i--) {
      undoStackRef.current.push(batch[i]);
    }
    flushPlacementGroup();
    setHistoryTick((t) => t + 1);
  }, [attachments, flushPlacementGroup]);

  const canUndoPlacement = undoStackRef.current.length > 0;
  const canRedoPlacement = redoStackRef.current.length > 0;
  // Keep historyTick in the dep graph so the buttons re-render on stack changes.
  void historyTick;

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

  // Per-publication "where we left off". When the active publication changes
  // (including initial load), restore the previously-selected page for that
  // publication. We try the saved pageId first, then fall back to pageIndex
  // if the issue has changed since it was saved. Save is debounced on every
  // subsequent selection change.
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    const pubId = activePublication?.id;
    if (!userId || !pubId) return;
    if (restoredForRef.current === pubId) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await getLastPositions(userId);
        const saved = all[pubId];
        if (cancelled || !saved) {
          restoredForRef.current = pubId;
          return;
        }
        const byId = saved.pageId && issue.pages.find((p) => p.id === saved.pageId);
        if (byId) {
          setSelectedId(byId.id);
        } else if (
          typeof saved.pageIndex === "number" &&
          saved.pageIndex >= 0 &&
          saved.pageIndex < issue.pages.length
        ) {
          setSelectedId(issue.pages[saved.pageIndex].id);
        }
        restoredForRef.current = pubId;
      } catch {
        restoredForRef.current = pubId;
      }
    })();
    return () => { cancelled = true; };
  }, [userId, activePublication?.id, issue]);

  // Reset the restore guard when the publication changes so a new pub gets
  // restored on its first matching effect run.
  useEffect(() => {
    restoredForRef.current = null;
  }, [activePublication?.id]);

  // Debounced save of the current selection for the active publication.
  useEffect(() => {
    const pubId = activePublication?.id;
    if (!userId || !pubId) return;
    if (restoredForRef.current !== pubId) return; // wait until restore ran
    const pageIndex = issue.pages.findIndex((p) => p.id === selectedId);
    const pos: LastPosition = {
      issueId: issue.meta.issueId ?? null,
      pageId: selectedId || null,
      pageIndex: pageIndex >= 0 ? pageIndex : null,
    };
    const t = setTimeout(() => {
      void setLastPosition(userId, pubId, pos).catch(() => { /* non-fatal */ });
    }, 500);
    return () => clearTimeout(t);
  }, [userId, activePublication?.id, selectedId, issue.meta.issueId, issue.pages]);


  const selected = issue.pages.find((p) => p.id === selectedId) ?? issue.pages[0];

  // Auto-compute folio + page number on each node before rendering, and inject
  // the derived contents entries into the contents page so it stays in sync
  // with the issue list automatically.
  const pagesForRender = useMemo(() => {
    const contentsEntries = deriveContentsEntries(issue);
    const total = issue.pages.length;
    const physIdx = computePhysicalIndices(issue.pages);
    return issue.pages.map((p, i) => {
      const num = formatPageNumber(issue.master, i + 1, total);
      const folio = renderFolio(issue.master, issue.meta, folioSideForIndex(physIdx[i]));
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
        case "blank":
          return { ...p, data: { ...p.data, folio, pageNumber: num } };
        case "custom-contents":
          return { ...p, data: { ...p.data, folio, pageNumber: num } };
        default:
          return p;
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
  const [fitScale, setFitScale] = useState(0.2);
  const [zoomMul, setZoomMul] = useState(1);
  const scale = fitScale * zoomMul;
  const stageW = spreadView && spread.right ? dimPx.w * 2 : dimPx.w;
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      setFitScale(Math.min(el.clientWidth / stageW, el.clientHeight / dimPx.h));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageW, dimPx.h]);
  const zoomPct = Math.round(zoomMul * 100);
  const zoomIn = () => setZoomMul((z) => Math.min(4, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoomMul((z) => Math.max(0.25, +(z - 0.25).toFixed(2)));
  const zoomFit = () => setZoomMul(1);

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


  /** Set or clear the per-page background artwork. */
  const setBackgroundArtwork = (
    id: string,
    art: IssuePageNode["backgroundArtwork"] | null,
  ) => {
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        p.id === id ? ({ ...p, backgroundArtwork: art ?? undefined } as IssuePageNode) : p,
      ),
    }));
  };

  const setBackgroundMode = (id: string, mode: "overlay" | "replace") => {
    setIssue((d) => ({
      ...d,
      pages: d.pages.map((p) =>
        p.id === id && p.backgroundArtwork
          ? ({ ...p, backgroundArtwork: { ...p.backgroundArtwork, mode } } as IssuePageNode)
          : p,
      ),
    }));
  };

  // Background uploader modal state
  const [bgUploadOpen, setBgUploadOpen] = useState(false);
  const [bgUploadSpread, setBgUploadSpread] = useState(false);


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

  const addPage = (pageType: "article" | "photo" | "ad" | "contents" | "blank" | "custom-contents") => {
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
        case "blank":
          return makeNode("blank", { ...DEFAULT_BLANK }, false);
        case "custom-contents":
          return makeNode(
            "custom-contents",
            { ...DEFAULT_CUSTOM_CONTENTS, slots: DEFAULT_CUSTOM_CONTENTS.slots.map((s) => ({ ...s, id: newId() })) },
            false,
          );
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

  /** Duplicate a page (deep-clone data + per-block overrides + custom blocks)
   *  and insert it directly after the source. Skips cover/back. */
  const duplicatePage = (id: string) => {
    const src = issue.pages.find((p) => p.id === id);
    if (!src || src.pageType === "cover" || src.pageType === "back") return;
    const cloned: IssuePageNode = {
      ...(JSON.parse(JSON.stringify(src)) as IssuePageNode),
      id: newId(),
      customBlocks: (src.customBlocks ?? []).map((b) => ({ ...b, id: newId() })),
    };
    setIssue((d) => {
      const idx = d.pages.findIndex((p) => p.id === id);
      if (idx < 0) return d;
      const backIdx = d.pages.findIndex((p) => p.pageType === "back");
      let insertAt = idx + 1;
      if (backIdx >= 0 && insertAt > backIdx) insertAt = backIdx;
      const next = [...d.pages];
      next.splice(insertAt, 0, cloned);
      return { ...d, pages: next };
    });
    setSelectedId(cloned.id);
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
    const name = `arts-today-${issueSlug}-${selected.pageType}-${pageNumberFor(issue, selected.id)}`;
    const exportDim = { inches: dimInches, px: dimPx };
    const kindLabel = kind === "pdf" ? "PDF" : kind === "png" ? "PNG" : "JPEG";
    try {
      await toast.promise(
        (async () => {
          if (kind === "pdf") await exportPdf(node, `${name}.pdf`, exportDim);
          else if (kind === "png") await exportPng(node, `${name}.png`, exportDim);
          else await exportJpeg(node, `${name}.jpg`, exportDim);
        })(),
        {
          loading: `Rendering ${kindLabel}…`,
          success: `${kindLabel} ready — check your downloads`,
          error: (e) => `${kindLabel} export failed — ${(e as Error).message ?? "please retry"}`,
        },
      );
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
      await toast.promise(
        exportIssuePdf(
          pages,
          {
            title: `The Arts Today — ${issue.meta.issue}`,
            author: "The Arts Today",
            subject: issue.meta.date,
          },
          `arts-today-${issueSlug}-publication.pdf`,
          { inches: dimInches, px: dimPx },
        ),
        {
          loading: `Rendering publication PDF · ${pages.length} pages…`,
          success: "Publication PDF ready — check your downloads",
          error: (e) => `Publication PDF failed — ${(e as Error).message ?? "please retry"}`,
        },
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
  const middlePanelRef = usePanelRef();
  const [middleCollapsed, setMiddleCollapsed] = useState(false);
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

  if (isMobile) {
    return <EditorMobileGuard issueLabel={issue.meta?.issue ?? null} />;
  }

  return (
    <BrandKitProvider value={brandKitContextValue}>
    <main
      className="min-h-screen bg-background text-foreground md:pl-14 pb-10"
      style={{ scrollPaddingTop: `calc(${stickyH}px + var(--top-dock-h, 0px))`, paddingTop: "var(--top-dock-h, 0px)", ["--rail-top" as never]: `${stickyH}px`, ["--rail-width" as never]: "56px", ["--statusbar-h" as never]: "2rem" }}
    >
      {migrationBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 rounded-sm border border-[color:var(--ruby)]/30 bg-card px-3 py-1.5 shadow-md text-[10px] tracking-[0.3em] uppercase text-muted-foreground"
        >
          {migrationBanner === "modernizing" ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-[color:var(--ruby)] border-t-transparent animate-spin" />
              Modernizing images…
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Images modernized
            </>
          )}
        </div>
      ) : null}
      <div ref={stickyRef} className="sticky top-0 z-30 bg-background">

      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-full px-4 py-4 flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Brand wordmark */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-foreground text-background flex items-center justify-center font-brand text-lg">P</div>
              <div className="leading-tight">
                <div className="font-brand text-[15px] text-foreground">PAGELUXE</div>
                <div className="text-[9px] tracking-[0.45em] uppercase text-muted-foreground -mt-0.5">
                  Pageluxe Issue Builder
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
            <div className="h-8 w-px bg-border mx-2" />
            <DraftConflictDialog
              open={conflict != null}
              localTs={conflict?.local.ts ?? 0}
              remoteTs={conflict?.remote.ts ?? 0}
              localPageCount={conflict?.local.data.pages.length ?? 0}
              remotePageCount={conflict?.remote.data.pages.length ?? 0}
              onResolve={handleConflictResolve}
            />
          </div>
          <div className="flex items-center gap-3">
            <AttachmentControl
              label="Layout template"
              attachment={attachments.template}
              onUpload={(file) => attachments.upload({ pageId: null, kind: "template", file })}
              onRemove={() => attachments.template ? attachments.remove(attachments.template) : Promise.resolve()}
            />
            <button
              onClick={() => setAssistantOpen((v) => !v)}
              className="bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] px-4 py-2 text-[10px] tracking-[0.3em] uppercase hover:bg-[color:var(--ruby-deep)] transition flex items-center gap-2 rounded-sm"
              title="Editorial assistant"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ask the editor
            </button>
            <div className="h-6 w-px bg-border" />
            <SignOutButton />
          </div>
        </div>
        <div className="h-[2px] ruby-rule" />
      </header>


      <aside
        aria-label="Editor tools"
        className="fixed left-0 z-40 hidden md:flex w-14 flex-col items-center border-r border-border bg-card/90 backdrop-blur py-3 gap-1.5 overflow-y-auto"
        style={{ top: "calc(var(--rail-top, 4rem) + var(--top-dock-h, 0px))", height: "calc(100vh - var(--rail-top, 4rem) - var(--top-dock-h, 0px) - var(--statusbar-h, 2rem))" }}
      >
        <button title="Files" aria-label="Files" aria-pressed={attachmentsOpen} onClick={() => setAttachmentsOpen((v) => !v)} className={`relative h-10 w-10 flex items-center justify-center rounded-md transition ${attachmentsOpen ? "bg-foreground text-background" : "text-foreground/70 hover:bg-secondary hover:text-foreground"}`}>
          <Paperclip className="h-[18px] w-[18px]" />
        </button>
        <button title="Brand kit" aria-label="Brand kit" aria-pressed={brandKitOpen} onClick={() => setBrandKitOpen((v) => !v)} className={`relative h-10 w-10 flex items-center justify-center rounded-md transition ${brandKitOpen ? "bg-foreground text-background" : "text-foreground/70 hover:bg-secondary hover:text-foreground"}`}>
          <BookOpen className="h-[18px] w-[18px]" />
        </button>
        <button title="Staff" aria-label="Staff" aria-pressed={staffOpen} onClick={() => setStaffOpen((v) => !v)} className={`relative h-10 w-10 flex items-center justify-center rounded-md transition ${staffOpen ? "bg-foreground text-background" : "text-foreground/70 hover:bg-secondary hover:text-foreground"}`}>
          <Users className="h-[18px] w-[18px]" />
        </button>
        <button title="AI Layout · propose from library" aria-label="AI Layout" aria-pressed={layoutAiOpen} onClick={() => setLayoutAiOpen((v) => !v)} className={`relative h-10 w-10 flex items-center justify-center rounded-md transition ${layoutAiOpen ? "bg-foreground text-background" : "text-foreground/70 hover:bg-secondary hover:text-foreground"}`}>
          <Wand2 className="h-[18px] w-[18px]" />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button title="AI Image Generator" aria-label="AI Image Generator" className={RAIL_BUTTON_CLASS}>
              <Aperture className="h-[18px] w-[18px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={12} align="start" className="w-[420px] max-h-[90vh] overflow-y-auto p-4">
            <div className="mb-3">
              <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">AI Image Generator</div>
              <div className="text-xs text-muted-foreground mt-1">
                Model shots, ads, still-life, and hero art — drop them straight onto the selected page.
              </div>
            </div>
            <GeneratorStudio
              context="editor"
              brand={(() => {
                const cover = issue.pages.find((p) => p.pageType === "cover");
                const palette = (cover?.data as { palette?: unknown } | undefined)?.palette;
                const paletteHex = Array.isArray(palette)
                  ? (palette as string[]).filter((c) => typeof c === "string")
                  : typeof palette === "string"
                    ? [palette]
                    : undefined;
                return {
                  publication: issue.master.publication,
                  tagline: (cover?.data as { tagline?: string } | undefined)?.tagline,
                  paletteHex,
                  fontLabel: issue.master.fonts?.display,
                  tone: "editorial magazine",
                } satisfies GeneratorBrandContext;
              })()}
              onUseImage={(url) => {
                const data = selected.data as { imageUrl?: unknown };
                if ("imageUrl" in data || selected.pageType === "cover" || selected.pageType === "article" || selected.pageType === "photo" || selected.pageType === "ad") {
                  updateData<typeof selected>(selected.id, { imageUrl: url } as never);
                } else {
                  toast.info("This page has no image slot — saved to library instead.");
                }
              }}
            />
          </PopoverContent>
        </Popover>
        <button title="Production" aria-label="Production" aria-pressed={checklistOpen} onClick={() => setChecklistOpen((v) => !v)} className={`relative h-10 w-10 flex items-center justify-center rounded-md transition ${checklistOpen ? "bg-foreground text-background" : "text-foreground/70 hover:bg-secondary hover:text-foreground"}`}>
          <ClipboardList className="h-[18px] w-[18px]" />
        </button>
        <div className="my-1 h-px w-8 bg-border/70" />
        <Popover>
          <PopoverTrigger asChild>
            <button title="Pages" aria-label="Pages" className={RAIL_BUTTON_CLASS}>
              <Layers className="h-[18px] w-[18px]" />
              <span className="absolute -bottom-0.5 right-0 px-1 rounded-sm bg-foreground/80 text-background text-[8px] font-numerals leading-none py-px">{issue.pages.length.toString().padStart(2, "0")}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={12} align="start" className="w-[380px] max-h-[80vh] overflow-y-auto p-0">
        {/* Page list */}

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
                  <DropdownMenuItem onClick={() => addPage("blank")}><FileText className="h-3.5 w-3.5 mr-2" /> Blank page (footer only)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addPage("custom-contents")}><ListOrdered className="h-3.5 w-3.5 mr-2" /> Custom contents</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Two-page spread</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => addSpread("article", "photo")}><Layers className="h-3.5 w-3.5 mr-2" /> Article + Photo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSpread("photo", "photo")}><Layers className="h-3.5 w-3.5 mr-2" /> Photo + Photo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addSpread("ad", "ad")}><Layers className="h-3.5 w-3.5 mr-2" /> Ad + Ad</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={pagesQuery}
                onChange={(e) => setPagesQuery(e.target.value)}
                placeholder="Search pages…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
                autoComplete="off"
              />
              {pagesQuery && (
                <button
                  type="button"
                  onClick={() => setPagesQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="divide-y divide-border">
              {(() => {
                const q = pagesQuery.trim().toLowerCase();
                const renderRow = (p: typeof issue.pages[number], handle: React.ReactNode) => {
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
                };

                if (q) {
                  const filtered = issue.pages.filter((p) => {
                    const label = labelForNode(p)?.toString().toLowerCase() ?? "";
                    const type = PAGE_LABELS[p.pageType]?.toLowerCase() ?? "";
                    const data = p.data as Record<string, unknown> | undefined;
                    const section = typeof data?.section === "string" ? data.section.toLowerCase() : "";
                    const eyebrow = typeof data?.eyebrow === "string" ? data.eyebrow.toLowerCase() : "";
                    const layoutKey = typeof data?.layout === "string" ? data.layout : "";
                    const layoutLabel = layoutKey
                      ? (PAGE_LAYOUT_LABELS as Record<string, string>)[layoutKey]?.toLowerCase() ?? layoutKey.toLowerCase()
                      : "";
                    const masterName = typeof issue.master?.publication === "string"
                      ? issue.master.publication.toLowerCase()
                      : "";
                    // Catch-all: tags, headline, byline, kicker, quote, etc.
                    let blob = "";
                    try { blob = JSON.stringify(p.data).toLowerCase(); } catch { /* ignore */ }
                    return (
                      label.includes(q) ||
                      type.includes(q) ||
                      section.includes(q) ||
                      eyebrow.includes(q) ||
                      layoutLabel.includes(q) ||
                      masterName.includes(q) ||
                      blob.includes(q)
                    );
                  });
                  if (filtered.length === 0) {
                    return (
                      <div className="px-3 py-6 text-center text-[11px] tracking-widest uppercase text-muted-foreground">
                        No pages match "{pagesQuery}"
                      </div>
                    );
                  }
                  return filtered.map((p) => (
                    <div key={p.id}>{renderRow(p, null)}</div>
                  ));
                }

                return (
                  <SortableList
                    items={issue.pages}
                    onReorder={reorderPages}
                    isDraggable={(p) => p.pageType !== "cover" && p.pageType !== "back"}
                    renderItem={renderRow}
                  />
                );
              })()}
            </div>

          </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button title="Edit page" aria-label="Edit page" className={RAIL_BUTTON_CLASS}>
              <SquarePen className="h-[18px] w-[18px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={12} align="start" className="w-[420px] max-h-[85vh] overflow-y-auto p-3">
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
                  pages={issue.pages}
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
              {selected.pageType === "blank" && (
                <BlankEditor
                  data={selected.data as BlankData}
                  set={(p) => updateData<typeof selected>(selected.id, p)}
                />
              )}
              {selected.pageType === "custom-contents" && (
                <CustomContentsEditor
                  data={selected.data as CustomContentsData}
                  set={(p) => updateData<typeof selected>(selected.id, p)}
                  issue={issue}
                />
              )}

              {selected.pageType !== "cover" &&
                selected.pageType !== "back" &&
                selected.pageType !== "contents" &&
                selected.pageType !== "custom-contents" && (
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
                <Section title="Running header">
                  <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!selected.hideFolio}
                      onChange={(e) => updateNode(selected.id, { hideFolio: e.target.checked || undefined })}
                      className="accent-[color:var(--ruby)]"
                    />
                    Hide running header on this page
                  </label>
                  <p className="text-[10px] leading-relaxed text-muted-foreground mt-2">
                    Removes the two top boxes (publication name + page label) and the rule beneath them, in both the preview and the exported PDF/PNG.
                  </p>
                </Section>
              )}

              <Section title="Header & footer overlays" defaultOpen={false}>
                <p className="text-[10px] leading-relaxed text-muted-foreground -mt-1 mb-2">
                  Add free-form text blocks anywhere on the page. Use tokens
                  for live values — they update when pages move or the master changes.
                  Tokens: <code>{"{page#}"}</code>, <code>{"{page}"}</code>, <code>{"{pages}"}</code>,
                  {" "}<code>{"{section}"}</code>, <code>{"{publication}"}</code>,
                  {" "}<code>{"{issue}"}</code>, <code>{"{date}"}</code>, <code>{"{copyright}"}</code>.
                </p>
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {([
                    { label: "+ Header (left)",   text: "{publication}",         x: 200,  y: 160,  w: 1400, h: 120, align: "left"   as const },
                    { label: "+ Header (right)",  text: "{issue}",               x: 1600, y: 160,  w: 1400, h: 120, align: "right"  as const },
                    { label: "+ Footer (left)",   text: "© {copyright}",         x: 200,  y: 4000, w: 1600, h: 110, align: "left"   as const },
                    { label: "+ Footer (page #)", text: "{page#}",               x: 1600, y: 4000, w: 1400, h: 110, align: "right"  as const },
                    { label: "+ Section title",   text: "{section}",             x: 200,  y: 280,  w: 2800, h: 100, align: "left"   as const },
                    { label: "+ Page x of y",     text: "Page {page} of {pages}",x: 1100, y: 4000, w: 1000, h: 110, align: "center" as const },
                  ]).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="text-[10px] uppercase tracking-[0.18em] border border-border bg-card hover:bg-muted text-foreground px-2 py-1.5 rounded-sm text-left"
                      onClick={() => {
                        const existing = selected.customBlocks ?? [];
                        const block = {
                          id: newId(),
                          kind: "text" as const,
                          x: preset.x,
                          y: preset.y,
                          z: 80,
                          w: preset.w,
                          h: preset.h,
                          text: preset.text,
                          fontFamily: "sans" as const,
                          fontSize: 38,
                          fontWeight: 500,
                          align: preset.align,
                          color: "#0a0a0a",
                        };
                        setCustomBlocks(selected.id, [...existing, block]);
                        if (!editLayout) setEditLayout(true);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {(selected.customBlocks ?? []).filter((b) => b.kind === "text").length > 0 && (
                  <div className="border-t border-border pt-2 space-y-1.5">
                    <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Text blocks on this page</div>
                    {(selected.customBlocks ?? [])
                      .filter((b): b is Extract<import("@/lib/coverDefaults").CustomBlock, { kind: "text" }> => b.kind === "text")
                      .map((b) => (
                        <div key={b.id} className="flex items-center gap-1.5 text-[11px]">
                          <span className="flex-1 truncate font-mono text-muted-foreground" title={b.text}>
                            {b.text.slice(0, 40) || "(empty)"}
                          </span>
                          <button
                            type="button"
                            title="Copy this block to every other page (great for headers/footers)"
                            className="text-[9px] uppercase tracking-[0.18em] border border-border hover:bg-muted px-1.5 py-0.5 rounded-sm"
                            onClick={() => {
                              const targets = issue.pages.filter((p) => p.id !== selected.id);
                              setIssue((d) => ({
                                ...d,
                                pages: d.pages.map((p) => {
                                  if (!targets.some((t) => t.id === p.id)) return p;
                                  const dupe = { ...b, id: newId() };
                                  return {
                                    ...p,
                                    customBlocks: [...(p.customBlocks ?? []), dupe],
                                  } as IssuePageNode;
                                }),
                              }));
                              toast.success(`Applied to ${targets.length} other page${targets.length === 1 ? "" : "s"}`);
                            }}
                          >
                            Apply to all
                          </button>
                          <button
                            type="button"
                            title="Remove this block"
                            className="text-[9px] uppercase tracking-[0.18em] border border-border hover:bg-muted px-1.5 py-0.5 rounded-sm"
                            onClick={() => {
                              setCustomBlocks(
                                selected.id,
                                (selected.customBlocks ?? []).filter((x) => x.id !== b.id),
                              );
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                <div className="border-t border-border pt-2 mt-2">
                  <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-1">Insert token (copies to clipboard)</div>
                  <div className="flex flex-wrap gap-1">
                    {TOKEN_PRESETS.map((t) => (
                      <button
                        key={t.token}
                        type="button"
                        className="text-[10px] border border-border bg-card hover:bg-muted px-1.5 py-0.5 rounded-sm font-mono"
                        onClick={() => {
                          void navigator.clipboard?.writeText(t.token);
                          toast.success(`Copied ${t.token} — paste into a text block`);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>


              {selected.pageType !== "cover" && (
                <Section title="Physical sheet" defaultOpen={false}>
                  <Field label="Unprinted sheets before this page">
                    <input
                      type="number"
                      min={0}
                      max={MAX_PARITY_SKIP}
                      step={1}
                      value={normalizeParitySkip(selected.paritySkip)}
                      onChange={(e) => {
                        const n = normalizeParitySkip(e.target.value);
                        updateNode(selected.id, { paritySkip: n === 0 ? undefined : n });
                      }}
                      onBlur={(e) => {
                        // Re-normalise on blur so any out-of-range value the
                        // browser allowed (e.g. paste) is snapped to bounds.
                        const n = normalizeParitySkip(e.target.value);
                        if (String(n) !== e.target.value) {
                          updateNode(selected.id, { paritySkip: n === 0 ? undefined : n });
                        }
                      }}
                      className="w-20 rounded-sm border border-border bg-background px-2 py-1 text-xs"
                    />
                  </Field>
                  <p className="text-[10px] leading-relaxed text-muted-foreground -mt-2">
                    Tip-ins, blank dividers, or any unprinted insert that
                    occupies a sheet but carries no folio. Shifts verso/recto
                    parity for this page and every page after it so the folio
                    template follows the physical layout. Printed page numbers
                    are unaffected.
                  </p>
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
                    onAssign={(id, patch) => applyPlacement(id, patch)}
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground mt-2">
                    Multiple files allowed. Pin each to a region (column / header / footer) or
                    a free-form coordinate. The editor sees PDFs and images directly; Word docs are
                    converted to text.
                  </p>
                </Section>
              )}

              <Section title="Background artwork">
                {selected.backgroundArtwork ? (
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start border border-border rounded-md p-2">
                      <img
                        src={selected.backgroundArtwork.url}
                        alt=""
                        className="h-16 w-16 object-cover rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" title={selected.backgroundArtwork.sourceFileName}>
                          {selected.backgroundArtwork.sourceFileName ?? "Background"}
                        </div>
                        <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-0.5">
                          {selected.backgroundArtwork.sourceKind.toUpperCase()}
                          {selected.backgroundArtwork.pdfPageIndex
                            ? ` · p.${selected.backgroundArtwork.pdfPageIndex}`
                            : ""}
                          {selected.backgroundArtwork.crop && selected.backgroundArtwork.crop !== "full"
                            ? ` · ${selected.backgroundArtwork.crop} half`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Mode</Label>
                      <div className="mt-1 grid grid-cols-2 gap-1 border border-border rounded-md p-1">
                        <button
                          type="button"
                          onClick={() => setBackgroundMode(selected.id, "replace")}
                          className={`text-[11px] tracking-wider uppercase py-1.5 rounded transition ${
                            selected.backgroundArtwork.mode === "replace"
                              ? "bg-foreground text-background"
                              : "hover:bg-secondary"
                          }`}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setBackgroundMode(selected.id, "overlay")}
                          className={`text-[11px] tracking-wider uppercase py-1.5 rounded transition ${
                            selected.backgroundArtwork.mode === "overlay"
                              ? "bg-foreground text-background"
                              : "hover:bg-secondary"
                          }`}
                        >
                          Overlay
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                        Replace: hide template, blocks still editable on top. Overlay: render template + blocks over the artwork.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setBgUploadSpread(false); setBgUploadOpen(true); }}
                        className="flex-1 text-[11px] tracking-wider uppercase py-1.5 border border-border rounded hover:bg-secondary transition"
                      >
                        Replace…
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm("Remove background artwork from this page?")) return;
                          const path = selected.backgroundArtwork?.sourcePath;
                          setBackgroundArtwork(selected.id, null);
                          if (path) { try { await deleteBackground(path); } catch { /* ignore */ } }
                        }}
                        className="flex-1 text-[11px] tracking-wider uppercase py-1.5 border border-border rounded hover:bg-destructive hover:text-destructive-foreground transition"
                      >
                        Remove
                      </button>
                    </div>
                    {spreadView && spread?.right && (
                      <button
                        type="button"
                        onClick={() => { setBgUploadSpread(true); setBgUploadOpen(true); }}
                        className="w-full text-[11px] tracking-wider uppercase py-1.5 border border-border rounded hover:bg-secondary transition"
                      >
                        Upload for whole spread…
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => { setBgUploadSpread(false); setBgUploadOpen(true); }}
                      className="w-full text-[11px] tracking-wider uppercase py-2 border border-dashed border-border rounded hover:bg-secondary transition"
                    >
                      Upload PDF / image / IDML+PDF
                    </button>
                    {spreadView && spread?.right && (
                      <button
                        type="button"
                        onClick={() => { setBgUploadSpread(true); setBgUploadOpen(true); }}
                        className="w-full text-[11px] tracking-wider uppercase py-2 border border-dashed border-border rounded hover:bg-secondary transition"
                      >
                        Upload for whole spread…
                      </button>
                    )}
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      Use a PDF page or image as the page art. IDML uploads also need a companion PDF for the visual.
                    </p>
                  </div>
                )}
              </Section>


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
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button title="Snap settings" aria-label="Snap settings" className={RAIL_BUTTON_CLASS}>
              <Settings2 className="h-[18px] w-[18px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={12} align="start" className="w-[380px] max-h-[80vh] overflow-y-auto p-3">

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
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button title="Master pages" aria-label="Master pages" className={RAIL_BUTTON_CLASS}>
              <BookOpen className="h-[18px] w-[18px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={12} align="start" className="w-[380px] max-h-[80vh] overflow-y-auto p-3">
          {/* Master pages — issue-wide folio & page-number defaults */}
          <Section title="Master pages" defaultOpen={false}>
            <Field label="Publication name">
              <Input
                value={issue.master.publication}
                onChange={(v) => updateMaster({ publication: v })}
              />
            </Field>
            {(() => {
              const tpl = normalizeFolioTemplate(issue.master.folioTemplate);
              return (
                <>
                  <Field label="Folio — left page (verso)">
                    <Input
                      value={tpl.left}
                      onChange={(v) =>
                        updateMaster({ folioTemplate: { ...tpl, left: v } })
                      }
                    />
                  </Field>
                  <Field label="Folio — right page (recto)">
                    <Input
                      value={tpl.right}
                      onChange={(v) =>
                        updateMaster({ folioTemplate: { ...tpl, right: v } })
                      }
                    />
                  </Field>
                  <div className="-mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      Tokens: <code>{"{publication}"}</code> <code>{"{issue}"}</code>{" "}
                      <code>{"{date}"}</code> <code>{"{copyright}"}</code>
                    </p>
                    <button
                      type="button"
                      className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition"
                      onClick={() =>
                        updateMaster({ folioTemplate: { left: tpl.left, right: tpl.left } })
                      }
                    >
                      Same on both
                    </button>
                  </div>
                </>
              );
            })()}
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
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button title="Typography" aria-label="Typography" className={RAIL_BUTTON_CLASS}>
              <Type className="h-[18px] w-[18px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={12} align="start" className="w-[380px] max-h-[80vh] overflow-y-auto p-3">

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
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button title="Save & Export" aria-label="Save and Export" className="h-10 w-10 flex items-center justify-center rounded-md bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] hover:bg-[color:var(--ruby-deep)] transition">
              <Download className="h-[18px] w-[18px]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={12} align="start" className="w-[380px] max-h-[85vh] overflow-y-auto p-3">

          <Section title="Layout style · Magazine templates" defaultOpen={false}>
            <MagazineTemplatePicker
              userId={userId}
              publicationId={activePublication?.id ?? null}
              issue={issue}
              onApply={(next) => setIssue(next)}
            />
          </Section>

          <Section title="Templates · Monthly versions" defaultOpen={false}>
            <IssueTemplatesPanel
              userId={userId}
              publicationId={activePublication?.id ?? null}
              issue={issue}
              onLoad={(next) => {
                setIssue(next);
                if (next.pages[0]) setSelectedId(next.pages[0].id);
              }}
            />
          </Section>


          <Section title="Version history · Save points" defaultOpen={false}>
            <VersionHistoryPanel
              userId={userId}
              issue={issue}
              onRestore={(next) => {
                setIssue(next);
                if (next.pages[0]) setSelectedId(next.pages[0].id);
              }}
            />
          </Section>

          <Section title="Comments · This page" defaultOpen={false}>
            <CommentsPanel
              userId={userId}
              issueId={issue.meta.issueId}
              pageId={selected.id}
              pageLabel={labelForNode(selected)}
            />
          </Section>

          <Section title="Issue · Save & Export" defaultOpen>
            {(() => {
              const eligible = issue.pages.filter(
                (p) => p.pageType !== "cover" && p.pageType !== "back",
              );
              const hidden = eligible.filter((p) => p.hideFolio);
              const visible = eligible.length - hidden.length;
              const hiddenLabels = hidden
                .map((p) => labelForNode(p))
                .filter(Boolean)
                .slice(0, 6);
              return (
                <div className="mb-3 rounded-sm border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                    Export checklist · matches preview
                  </p>
                  <ul className="space-y-1.5">
                    <li className="flex gap-2">
                      <span className="text-[color:var(--ruby)]">✓</span>
                      <span>
                        Running headers: <strong>{visible}</strong> shown,{" "}
                        <strong>{hidden.length}</strong> hidden
                        {hiddenLabels.length > 0 && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({hiddenLabels.join(", ")}
                            {hidden.length > hiddenLabels.length ? ", …" : ""})
                          </span>
                        )}
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[color:var(--ruby)]">✓</span>
                      <span>
                        Render size: <strong>{dimInches.w}″ × {dimInches.h}″</strong>{" "}
                        at <strong>{dimPx.w} × {dimPx.h}px</strong> (1:1, no downscale)
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[color:var(--ruby)]">✓</span>
                      <span>
                        Cover &amp; back render without folio by design; layout, fonts,
                        and brand colors export exactly as shown in the preview.
                      </span>
                    </li>
                  </ul>
                </div>
              );
            })()}
            <button
              onClick={doExportPublication}
              disabled={busy === "PUBLICATION"}
              className="w-full bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] px-3 py-3 text-[11px] uppercase tracking-[0.3em] hover:bg-[color:var(--ruby-deep)] transition disabled:opacity-60 flex items-center justify-center gap-2 rounded-sm"
            >
              <Download className="h-3.5 w-3.5" />
              {busy === "PUBLICATION" ? "Assembling…" : "Export Publication PDF"}
            </button>
            <button
              onClick={() => setNewsletterOpen(true)}
              className="w-full border border-border px-3 py-2 text-[10px] uppercase tracking-[0.3em] hover:bg-secondary rounded-sm flex items-center justify-center gap-1.5"
              title="Generate an HTML newsletter email with AI-picked highlights from this issue"
            >
              <Mail className="h-3 w-3" /> Generate newsletter email
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
              onClick={async () => {
                await toast.promise(
                  (async () => {
                    const { downloadIdml } = await import("@/lib/idmlExport");
                    downloadIdml(issue, issueSlug || "issue", idmlDim);
                  })(),
                  {
                    loading: "Building IDML…",
                    success: "IDML .zip ready — check your downloads",
                    error: (e) => `IDML export failed — ${(e as Error).message ?? "please retry"}`,
                  },
                );
              }}
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
                  await toast.promise(
                    (async () => {
                      const { downloadIdmlPackage } = await import("@/lib/idmlExport");
                      const { fetched, skipped } = await downloadIdmlPackage(
                        issue,
                        issueSlug || "issue",
                        idmlDim,
                      );
                      return { fetched, skipped };
                    })(),
                    {
                      loading: "Bundling IDML package · fetching images…",
                      success: ({ fetched, skipped }) =>
                        skipped.length
                          ? `IDML package ready · ${fetched} image${fetched === 1 ? "" : "s"} bundled, ${skipped.length} skipped (see relink-manifest.txt)`
                          : `IDML package ready · ${fetched} image${fetched === 1 ? "" : "s"} bundled`,
                      error: (e) => `Package build failed — ${(e as Error).message ?? "please retry"}`,
                    },
                  );
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
          </PopoverContent>
        </Popover>
        <div className="mt-auto flex flex-col items-center gap-1.5">
          <div className="my-1 h-px w-8 bg-border/70" />
          <button
            title="BOARD"
            aria-label="BOARD"
            onClick={() => void goProduction("/board")}
            className="h-10 w-10 flex items-center justify-center rounded-md text-foreground/70 hover:bg-secondary hover:text-foreground transition"
          >
            <KanbanSquare className="h-[18px] w-[18px]" />
          </button>
          <button
            title="CALENDAR"
            aria-label="CALENDAR"
            onClick={() => void goProduction("/calendar")}
            className="h-10 w-10 flex items-center justify-center rounded-md text-foreground/70 hover:bg-secondary hover:text-foreground transition"
          >
            <CalendarDays className="h-[18px] w-[18px]" />
          </button>
          <button
            title="Ask the editor"
            aria-label="Ask the editor"
            aria-pressed={assistantOpen}
            onClick={() => setAssistantOpen((v) => !v)}
            className="h-10 w-10 flex items-center justify-center rounded-md bg-[color:var(--ruby)] text-[color:var(--accent-foreground)] hover:bg-[color:var(--ruby-deep)] transition"
          >
            <Sparkles className="h-[18px] w-[18px]" />
          </button>
        </div>
      </aside>

      {/* Canvas ribbon — page-specific controls, sticky alongside the header */}
      <div className="border-t border-foreground/20 bg-foreground text-background px-3 py-1.5 flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 pr-2 mr-1 border-r border-background/25">
          <span className="text-[10px] tracking-[0.3em] uppercase text-background/60">Page</span>
          <button
            type="button"
            onClick={() => {
              const prev = pagesForRender[selectedIdx - 1];
              if (prev) setSelectedId(prev.id);
            }}
            disabled={selectedIdx <= 0}
            aria-label="Previous page"
            title="Previous page"
            className="p-1 rounded-sm text-background/70 hover:bg-background/10 hover:text-background transition disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 py-0.5 rounded-sm bg-background/15 text-background text-[11px] font-medium tabular-nums">
            {pageNumberFor(issue, selected.id)}
            <span className="text-background/50"> / {pagesForRender.length}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              const next = pagesForRender[selectedIdx + 1];
              if (next) setSelectedId(next.id);
            }}
            disabled={selectedIdx < 0 || selectedIdx >= pagesForRender.length - 1}
            aria-label="Next page"
            title="Next page"
            className="p-1 rounded-sm text-background/70 hover:bg-background/10 hover:text-background transition disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] text-background/80 max-w-[180px] truncate hidden md:inline" title={labelForNode(selected)}>
            {labelForNode(selected)}
          </span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-background/50 hidden lg:inline">
            · {selected.pageType}
          </span>
          <button
            type="button"
            onClick={() => duplicatePage(selected.id)}
            disabled={selected.pageType === "cover" || selected.pageType === "back"}
            aria-label="Duplicate page"
            title="Duplicate this page"
            className="ml-1 inline-flex items-center gap-1 px-1.5 py-1 rounded-sm border border-background/25 text-background/80 hover:bg-background/10 hover:text-background transition disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Copy className="h-3 w-3" />
            <span className="text-[10px] tracking-[0.2em] uppercase hidden md:inline">Duplicate</span>
          </button>
        </div>


        <span className="text-[10px] tracking-[0.3em] uppercase text-background/60 hidden sm:inline">View</span>

        <div className="inline-flex border border-background/25 rounded-sm overflow-hidden">
          <button
            onClick={() => setSpreadView(false)}
            className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase transition ${!spreadView ? "bg-background/25 text-background" : "text-background/70 hover:bg-background/10"}`}
          >
            Single
          </button>
          <button
            onClick={() => setSpreadView(true)}
            className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase transition ${spreadView ? "bg-background/25 text-background" : "text-background/70 hover:bg-background/10"}`}
          >
            Spread
          </button>
        </div>
        <button
          onClick={() => setShowGuides((v) => !v)}
          className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase border border-background/25 rounded-sm transition ${showGuides ? "bg-background/25 text-background" : "text-background/70 hover:bg-background/10"}`}
          title="Toggle non-printing margin & bleed guides"
        >
          {showGuides ? "Guides on" : "Guides off"}
        </button>
        <button
          onClick={() => setEditLayout((v) => !v)}
          className={`px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase border border-background/25 rounded-sm transition ${editLayout ? "bg-background/25 text-background" : "text-background/70 hover:bg-background/10"}`}
          title="Drag blocks to reposition them on the page"
        >
          {editLayout ? "Done" : "Drag blocks"}
        </button>
        {editLayout && selectedHasOverrides && (
          <button
            onClick={() => resetOverrides(selected.id)}
            className="px-2.5 py-1 text-[10px] tracking-[0.3em] uppercase border border-background/25 rounded-sm text-background/70 hover:bg-background/10"
            title="Reset all block positions on this page"
          >
            Reset
          </button>
        )}
        <div className="h-5 w-px bg-background/25 mx-1" />
        <button
          onClick={() => void undoPlacement()}
          disabled={!canUndoPlacement}
          className="p-1.5 rounded-sm text-background/70 hover:bg-background/10 hover:text-background transition disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo last attachment placement"
          aria-label="Undo placement"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => void redoPlacement()}
          disabled={!canRedoPlacement}
          className="p-1.5 rounded-sm text-background/70 hover:bg-background/10 hover:text-background transition disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo attachment placement"
          aria-label="Redo placement"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <div className="h-5 w-px bg-background/25 mx-1" />
        <span className="text-[10px] tracking-[0.3em] uppercase text-background/60 hidden lg:inline">
          Layout
        </span>
        <Select value={selectedLayout} onValueChange={(v) => requestLayoutChange(v as PageLayout)}>
          <SelectTrigger
            className="h-7 w-[170px] text-xs bg-background/10 border-background/25 text-background hover:bg-background/15"
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
        <span className="ml-auto text-[10px] tracking-[0.3em] uppercase text-background/60 hidden md:inline">
          {dimInches.w}″ × {dimInches.h}″
        </span>
      </div>
      </div>

      {firstIssueHint ? (
        <div className="px-3 pt-3">
          <div className="mx-auto max-w-5xl border border-[color:var(--ruby)]/25 bg-[color:var(--ruby)]/5 rounded-sm p-4 flex items-start gap-4">
            <div className="hidden sm:grid place-items-center h-10 w-10 shrink-0 rounded-full border border-[color:var(--ruby)]/30 bg-background/70 font-brand text-lg text-[color:var(--ruby-deep)]" style={{ fontFamily: "var(--font-brand)" }} aria-hidden>
              I
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] tracking-[0.3em] uppercase text-[color:var(--ruby-deep)] mb-1">
                Getting started
              </div>
              <h3 className="font-display text-base md:text-lg tracking-tight text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                Sketch your first issue.
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Rename the issue up top, edit the cover, and add pages from the <span className="font-medium text-foreground">Pages</span> palette on the left. Autosave and cloud sync are on — nothing you type here goes anywhere until you save or export.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissFirstIssueHint}
              aria-label="Dismiss getting-started hint"
              className="shrink-0 p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-background/70 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="px-3 pt-1 pb-3">

        <div className="pl-3 flex flex-col gap-3">
          {editLayout && (
            <p className="text-[10px] leading-relaxed text-muted-foreground px-1">
              Drag any outlined block on the page. Use the <strong>+ Add</strong> palette to add text, images, shapes, QR codes, or link buttons anywhere. Click an added element to edit, resize, or delete it.
            </p>
          )}

        {/* Preview */}
        <section
          ref={stageRef}
          className={`relative isolate bg-secondary/60 border border-border flex-1 ${zoomMul > 1 ? "overflow-auto" : "overflow-hidden"}`}
          style={{ minHeight: `calc(70vh - ${stickyH}px)`, aspectRatio: `${stageW / dimPx.h}`, scrollMarginTop: stickyH }}
        >
          <div className="absolute bottom-3 right-3 z-50 flex items-center gap-0.5 bg-background/95 border border-border rounded-md shadow px-1 py-1 text-[11px] font-medium">
            <button
              type="button"
              onClick={zoomOut}
              className="px-2 py-1 hover:bg-muted rounded"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              onClick={zoomFit}
              className="px-2 py-1 hover:bg-muted rounded tabular-nums min-w-[3rem] text-center"
              title="Fit to view"
            >
              {zoomPct}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="px-2 py-1 hover:bg-muted rounded"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={zoomFit}
              className="px-2 py-1 hover:bg-muted rounded tracking-wider uppercase text-[10px]"
              title="Reset to fit"
            >
              Fit
            </button>
          </div>


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
                facingPage={
                  spreadView && spread.right
                    ? {
                        side: "left" as const,
                        blocks: spread.right.customBlocks ?? [],
                        setBlocks: (next) => setCustomBlocks(spread.right!.id, next),
                      }
                    : undefined
                }

                guides={showGuides ? guidesFor(spread.left) : undefined}
                snapSettings={effectiveSnapFor(spread.left)}
                onRequestEdit={() => { setSelectedId(spread.left.id); setEditLayout(true); }}
                tokenContext={buildTokenContext(issue, spread.left.id)}
                contentsSlots={slotsForPage(spread.left).slots}
                contentsSlotResolved={slotsForPage(spread.left).resolved}
              >
                <PagePreview pageType={spread.left.pageType} data={spread.left.data} dim={dimPx} hideFolio={spread.left.hideFolio} background={spread.left.backgroundArtwork ? { url: spread.left.backgroundArtwork.url, mode: spread.left.backgroundArtwork.mode, crop: spread.left.backgroundArtwork.crop } : undefined} />
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
               {showRulers && <RulersOverlay dim={dimPx} unit={measureUnit} />}
               <ReferencePinsOverlay
                 references={attachments.referencesByPage.get(spread.left.id) ?? []}
                dim={dimPx}
                scale={scale}
                onAssign={(id, patch, opts) => applyPlacement(id, patch, opts)}
                editing={editLayout && spread.left.id === selected.id}
              />
              {proposalOps.length > 0 && (
                <LayoutProposalOverlay
                  ops={proposalOps}
                  pageId={spread.left.id}
                  dim={dimPx}
                  libraryLabels={libraryLabels}
                  onOpsChange={setProposalOps}
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
                  facingPage={{
                    side: "right" as const,
                    blocks: spread.left.customBlocks ?? [],
                    setBlocks: (next) => setCustomBlocks(spread.left.id, next),
                  }}

                  guides={showGuides ? guidesFor(spread.right) : undefined}
                  snapSettings={effectiveSnapFor(spread.right)}
                  onRequestEdit={() => { setSelectedId(spread.right!.id); setEditLayout(true); }}
                  tokenContext={buildTokenContext(issue, spread.right.id)}
                  contentsSlots={slotsForPage(spread.right).slots}
                  contentsSlotResolved={slotsForPage(spread.right).resolved}
                >
                  <PagePreview pageType={spread.right.pageType} data={spread.right.data} dim={dimPx} hideFolio={spread.right.hideFolio} background={spread.right.backgroundArtwork ? { url: spread.right.backgroundArtwork.url, mode: spread.right.backgroundArtwork.mode, crop: spread.right.backgroundArtwork.crop } : undefined} />
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
                <ReferencePinsOverlay
                  references={attachments.referencesByPage.get(spread.right.id) ?? []}
                  dim={dimPx}
                  scale={scale}
                  onAssign={(id, patch, opts) => applyPlacement(id, patch, opts)}
                  editing={editLayout && spread.right.id === selected.id}
                />
                {proposalOps.length > 0 && (
                  <LayoutProposalOverlay
                    ops={proposalOps}
                    pageId={spread.right.id}
                    dim={dimPx}
                    libraryLabels={libraryLabels}
                    onOpsChange={setProposalOps}
                  />
                )}
              </div>
            )}
          </div>
        </section>
        </div>
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
            tokenContext={buildTokenContext(issue, p.id)}
            contentsSlots={slotsForPage(p).slots}
            contentsSlotResolved={slotsForPage(p).resolved}
          >
            <PagePreview ref={setRef(p.id)} pageType={p.pageType} data={p.data} dim={dimPx} hideFolio={p.hideFolio} background={p.backgroundArtwork ? { url: p.backgroundArtwork.url, mode: p.backgroundArtwork.mode, crop: p.backgroundArtwork.crop } : undefined} />
          </LayoutEditProvider>
        ))}
      </div>

      <PageBackgroundUploader
        open={bgUploadOpen}
        onClose={() => setBgUploadOpen(false)}
        issueId={issue.meta.issueId}
        pageId={!bgUploadSpread ? selected.id : undefined}
        spread={bgUploadSpread && spread?.right ? { left: spread.left.id, right: spread.right.id } : undefined}
        defaultMode={selected.backgroundArtwork?.mode ?? "replace"}
        onApply={(assignments: BackgroundAssignment[], idmlFields) => {
          setIssue((d) => ({
            ...d,
            pages: d.pages.map((p) => {
              const a = assignments.find((x) => x.pageId === p.id);
              if (!a) return p;
              return {
                ...p,
                backgroundArtwork: {
                  url: a.url,
                  sourceKind: a.sourceKind,
                  sourcePath: a.sourcePath,
                  sourceFileName: a.sourceFileName,
                  pdfPageIndex: a.pdfPageIndex,
                  crop: a.crop,
                  mode: a.mode,
                  width: a.width,
                  height: a.height,
                },
              } as IssuePageNode;
            }),
          }));
          if (idmlFields) {
            console.info("[bg] IDML suggestions", idmlFields);
            toast.info(
              `IDML text extracted: ${[idmlFields.section, idmlFields.headline].filter(Boolean).join(" · ") || "(no clear fields)"}`,
            );
          }
        }}
      />






      <EditorStatusBar
        left={
          <>
            <AutosaveIndicator
              status={autosave.status}
              lastSavedAt={autosave.lastSavedAt}
              onSaveNow={autosave.saveNow}
              cloudStatus={cloudSync.status}
              cloudLastSyncedAt={cloudSync.lastSyncedAt}
              cloudError={cloudSync.error ?? queueDrainer.lastError}
              onSyncNow={() => {
                cloudSync.syncNow();
                queueDrainer.drainNow();
              }}
              queuePending={queueDrainer.pending}
              queueDraining={queueDrainer.draining}
              onRetryQueue={queueDrainer.drainNow}
            />
            <button
              type="button"
              onClick={() => {
                autosave.saveNow();
                cloudSync.syncNow();
                queueDrainer.drainNow();
              }}
              title="Save locally and push to the cloud now"
              className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-[10px] tracking-[0.25em] uppercase text-muted-foreground hover:bg-secondary hover:text-foreground transition"
            >
              Sync now
            </button>
          </>
        }
        center={
          <span className="hidden md:inline">
            Pageluxe · {labelForNode(selected)} · {selected.pageType}
          </span>
        }
        right={
          <>
            <span className="tabular-nums">{dimInches.w}″ × {dimInches.h}″</span>
            <span className="hidden sm:inline">·</span>
            <span className="tabular-nums hidden sm:inline">{zoomPct}%</span>
          </>
        }
      />


      <AttachmentsPanel
        open={attachmentsOpen}
        onClose={() => setAttachmentsOpen(false)}
        issueId={issue.meta.issueId}
        publicationId={activePublication?.id ?? null}
        publicationName={activePublication?.name ?? null}
        selectedPageId={selected.id}
        selectedPageLabel={selected.pageType}
        pages={pageRefsForStatus}
        attachments={{ ...attachments, updateAssignment: applyPlacement }}
        library={libraryAttachments}
        onInsertImage={(row) => {
          if (!row.signedUrl) return;
          const existing = selected.customBlocks ?? [];
          const block = {
            id: newId(),
            kind: "image" as const,
            x: 80,
            y: 80,
            z: 50,
            w: 480,
            h: 320,
            imageUrl: row.signedUrl,
            imageFit: "cover" as const,
          };
          setCustomBlocks(selected.id, [...existing, block]);
        }}
      />

      <BrandKitPanel
        open={brandKitOpen}
        onClose={() => setBrandKitOpen(false)}
        publicationId={activePublication?.id ?? null}
        publicationName={activePublication?.name ?? null}
        fonts={brandFonts}
        swatches={brandSwatches}
      />



      <StaffPanel
        open={staffOpen}
        onClose={() => setStaffOpen(false)}
        issue={issue}
        publicationId={activePublication?.id ?? null}
        publicationName={activePublication?.name ?? null}
        selectedPageId={selected.id}
        attachments={attachments.rows
          .filter((r): r is typeof r & { kind: "template" | "reference" } => r.kind !== "library")
          .map((r) => ({
            id: r.id,
            file_name: r.file_name,
            mime_type: r.mime_type,
            kind: r.kind,
            page_id: r.page_id,
            region: r.region,
            position_x: r.position_x,
            position_y: r.position_y,
          }))}
        onPlaceAttachment={(id, patch) => applyPlacement(id, patch)}
      />

      <LayoutProposalPanel
        open={layoutAiOpen}
        onClose={() => setLayoutAiOpen(false)}
        issue={issue}
        publicationName={activePublication?.name ?? null}
        library={libraryAttachments.rows}
        onPlanChange={setProposalOps}
        onApply={(ops: LayoutPlanOp[]) => {
          const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
          let applied = 0;
          let skipped = 0;
          const grouped: Record<string, import("@/lib/coverDefaults").CustomBlock[]> = {};
          for (const op of ops) {
            if (op.kind === "add_image_block") {
              const row = libraryAttachments.rows.find((r) => r.id === op.attachmentId);
              if (!row?.signedUrl) {
                skipped += 1;
                continue;
              }
              const x = clamp(op.x ?? 160, 0, 3200);
              const y = clamp(op.y ?? 160, 0, 4267);
              const w = clamp(op.w ?? 1600, 100, 3200);
              const h = clamp(op.h ?? 1000, 100, 4267);
              (grouped[op.pageId] ??= []).push({
                id: newId(),
                kind: "image",
                x, y, w, h, z: 50,
                imageUrl: row.signedUrl,
                imageFit: "cover",
                name: row.file_name,
              });
              applied += 1;
            } else if (op.kind === "add_text_block") {
              if (!op.text) { skipped += 1; continue; }
              const x = clamp(op.x ?? 160, 0, 3200);
              const y = clamp(op.y ?? 160, 0, 4267);
              const w = clamp(op.w ?? 1600, 100, 3200);
              const h = clamp(op.h ?? 600, 60, 4267);
              (grouped[op.pageId] ??= []).push({
                id: newId(),
                kind: "text",
                x, y, w, h, z: 50,
                text: op.text,
                fontFamily: op.fontFamily ?? "serif",
                fontSize: op.fontSize,
                align: op.align,
              });
              applied += 1;
            } else if (op.kind === "set_field") {
              if (!op.field || op.value === undefined) { skipped += 1; continue; }
              setIssue((prev) =>
                applyPatch(prev, { kind: "update_page_field", pageId: op.pageId, field: op.field!, value: op.value! }),
              );
              applied += 1;
            } else {
              skipped += 1;
            }
          }
          if (Object.keys(grouped).length > 0) {
            setIssue((d) => ({
              ...d,
              pages: d.pages.map((p) =>
                grouped[p.id]
                  ? ({ ...p, customBlocks: [...(p.customBlocks ?? []), ...grouped[p.id]] } as IssuePageNode)
                  : p,
              ),
            }));
          }
          return { applied, skipped };
        }}
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

      <NewsletterDialog
        open={newsletterOpen}
        onOpenChange={setNewsletterOpen}
        issue={issue}
        issueSlug={issueSlug}
        pageNodes={refs.current}
        pageDim={{ inches: dimInches, px: dimPx }}
      />
      <ToolbarDiagnostics />
    </main>
    </BrandKitProvider>

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
    case "blank":
      return "Blank page";
    case "custom-contents":
      return "Custom contents";
  }
}

/* ============ EDITORS ============ */

function CoverEditor({
  data,
  set,
  pages,
}: {
  data: CoverData;
  set: (p: Partial<CoverData>) => void;
  pages: IssuePageNode[];
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
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !f.type.startsWith("image/")) return;
                await toast.promise(
                  (async () => {
                    const up = await uploadEditorImage({
                      issueId: (window as unknown as { __pageluxeIssueId?: string }).__pageluxeIssueId ?? "issue",
                      input: f,
                      fileName: f.name,
                      folder: "masthead",
                    });
                    set({ mastheadLogoUrl: up.url });
                  })(),
                  {
                    loading: "Uploading logo…",
                    success: "Masthead logo updated",
                    error: (err) => `Logo upload failed — ${(err as Error).message ?? "please retry"}`,
                  },
                );
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
      <CoverTocEditor
        entries={data.tocEntries ?? []}
        pages={pages}
        onChange={(entries) => set({ tocEntries: entries })}
      />
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

function CoverTocEditor({
  entries,
  pages,
  onChange,
}: {
  entries: CoverTocEntry[];
  pages: IssuePageNode[];
  onChange: (entries: CoverTocEntry[]) => void;
}) {
  const linkable = pages.filter((p) => p.pageType !== "cover" && p.pageType !== "back");
  const update = (i: number, patch: Partial<CoverTocEntry>) => {
    const next = entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const next = entries.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const add = () => {
    if (entries.length >= 6) return;
    onChange([...entries, { label: "NEW", page: "1", targetPageId: null }]);
  };

  return (
    <Section title="Featuring / TOC row">
      <p className="text-[11px] leading-relaxed text-muted-foreground -mt-1 mb-2">
        The aligned "pg." row at the bottom of the cover. Two to six entries; page numbers link to the article page you pick.
      </p>
      <div className="space-y-3">
        {entries.length === 0 && (
          <div className="text-[11px] text-muted-foreground italic">
            No entries yet. Add one below to show a linked page-number row on the cover.
          </div>
        )}
        {entries.map((entry, i) => {
          const targetIdx = entry.targetPageId
            ? pages.findIndex((p) => p.id === entry.targetPageId)
            : -1;
          return (
            <div key={i} className="border border-border/70 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                  Entry {i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === entries.length - 1}
                    onClick={() => move(i, 1)}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove entry"
                    onClick={() => remove(i)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Field label="Label">
                <Input value={entry.label} onChange={(v) => update(i, { label: v })} />
              </Field>
              <Field label="Page number caption">
                <Input value={entry.page} onChange={(v) => update(i, { page: v })} />
              </Field>
              <Field label="Links to page">
                <select
                  value={entry.targetPageId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const patch: Partial<CoverTocEntry> = { targetPageId: id };
                    if (id) {
                      const idx = pages.findIndex((p) => p.id === id);
                      if (idx >= 0) patch.page = String(idx + 1);
                    }
                    update(i, patch);
                  }}
                  className="w-full border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="">— No link —</option>
                  {linkable.map((p) => {
                    const idx = pages.findIndex((x) => x.id === p.id);
                    return (
                      <option key={p.id} value={p.id}>
                        {`Pg. ${idx + 1} · ${labelForNode(p) ?? p.pageType}`}
                      </option>
                    );
                  })}
                </select>
                {targetIdx >= 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Currently linked to page {targetIdx + 1}.
                  </p>
                )}
              </Field>
            </div>
          );
        })}
        <button
          type="button"
          onClick={add}
          disabled={entries.length >= 6}
          className="w-full border border-dashed border-border py-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground hover:border-foreground/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {entries.length >= 6 ? "Max 6 entries" : "+ Add entry"}
        </button>
      </div>
    </Section>
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
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground pt-1">
          <input
            type="checkbox"
            checked={!!data.featuredInContents}
            onChange={(e) => set({ featuredInContents: e.target.checked })}
            className="accent-[color:var(--ruby)]"
          />
          Featured on contents
        </label>
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
  const [uploading, setUploading] = useState(false);
  const focalRef = useRef<HTMLDivElement>(null);
  const handle = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const issueId =
        (window as unknown as { __pageluxeIssueId?: string }).__pageluxeIssueId ?? "issue";
      await toast.promise(
        (async () => {
          const up = await uploadEditorImage({ issueId, input: file, fileName: file.name, folder: "slot" });
          onUrl(up.url);
        })(),
        {
          loading: "Uploading image…",
          success: "Image uploaded",
          error: (err) => `Image upload failed — ${(err as Error).message ?? "please retry"}`,
        },
      );
    } finally {
      setUploading(false);
    }
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
        className={`relative border-2 border-dashed p-3 transition ${
          dragOver ? "border-[color:var(--ruby)] bg-secondary" : "border-border"
        } ${uploading ? "opacity-70" : ""}`}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handle(e.target.files?.[0])}
          disabled={uploading}
          className="block w-full text-sm file:mr-3 file:rounded-none file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-xs file:uppercase file:tracking-widest file:cursor-pointer disabled:opacity-60"
        />
        <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-2">
          {uploading ? "Uploading…" : dragOver ? "Drop to upload" : "Or drag an image file here"}
        </p>
        {uploading && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="h-6 w-6 rounded-full border-2 border-[color:var(--ruby)] border-t-transparent animate-spin" />
          </div>
        )}
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

function BlankEditor({ data, set }: { data: BlankData; set: (p: Partial<BlankData>) => void }) {
  return (
    <>
      <Section title="Blank page (footer only)">
        <Field label="Folio text"><Input value={data.folio} onChange={(v) => set({ folio: v })} /></Field>
        <Field label="Page number"><Input value={data.pageNumber} onChange={(v) => set({ pageNumber: v })} /></Field>
      </Section>
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
    </>
  );
}

function CustomContentsEditor({
  data,
  set,
  issue,
}: {
  data: CustomContentsData;
  set: (p: Partial<CustomContentsData>) => void;
  issue: IssueDoc;
}) {
  // Featured articles list — articles flagged via the article editor toggle.
  // Hybrid: articles that are NOT flagged are still selectable under "All".
  const featured = issue.pages.filter(
    (p) => p.pageType === "article" && (p.data as ArticleData).featuredInContents,
  );
  const allArticles = issue.pages.filter((p) => p.pageType === "article");
  const setSlots = (slots: ContentsSlot[]) => set({ slots });
  const updateSlot = (id: string, patch: Partial<ContentsSlot>) =>
    setSlots(data.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const updateOverride = (id: string, k: keyof NonNullable<ContentsSlot["overrides"]>, v: string) =>
    setSlots(
      data.slots.map((s) =>
        s.id === id ? { ...s, overrides: { ...(s.overrides ?? {}), [k]: v || undefined } } : s,
      ),
    );
  const addSlot = () =>
    setSlots([
      ...data.slots,
      { id: newId(), label: `Feature ${data.slots.length + 1}` },
    ]);
  const removeSlot = (id: string) => setSlots(data.slots.filter((s) => s.id !== id));
  const moveSlot = (id: string, dir: -1 | 1) => {
    const idx = data.slots.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= data.slots.length) return;
    const next = [...data.slots];
    [next[idx], next[j]] = [next[j], next[idx]];
    setSlots(next);
  };
  return (
    <>
      <Section title="Custom contents (footer)">
        <Field label="Folio text"><Input value={data.folio} onChange={(v) => set({ folio: v })} /></Field>
        <Field label="Page number"><Input value={data.pageNumber} onChange={(v) => set({ pageNumber: v })} /></Field>
      </Section>
      <Section title="Style">
        <PaletteField value={data.palette} onChange={(p) => set({ palette: p })} />
      </Section>
      <Section title="Featured slots">
        <p className="text-xs text-muted-foreground -mt-1">
          Each slot can auto-link to an article (its headline, byline, page
          number, and lead image then flow into any block on this page that
          you tag with the slot). Type into the override fields to pin a
          custom value.
        </p>
        <div className="space-y-3">
          {data.slots.map((s, i) => {
            const linked = s.articlePageId
              ? issue.pages.find((p) => p.id === s.articlePageId)
              : null;
            const linkedArt = linked && linked.pageType === "article" ? (linked.data as ArticleData) : null;
            return (
              <div key={s.id} className="border border-border rounded-sm p-2 space-y-2 bg-muted/30">
                <div className="flex items-center gap-1">
                  <Input value={s.label} onChange={(v) => updateSlot(s.id, { label: v })} />
                  <button type="button" className="px-1.5 text-xs" onClick={() => moveSlot(s.id, -1)} disabled={i === 0}>↑</button>
                  <button type="button" className="px-1.5 text-xs" onClick={() => moveSlot(s.id, 1)} disabled={i === data.slots.length - 1}>↓</button>
                  <button type="button" className="px-1.5 text-xs text-destructive" onClick={() => removeSlot(s.id)}>✕</button>
                </div>
                <Field label="Linked article">
                  <select
                    value={s.articlePageId ?? ""}
                    onChange={(e) => updateSlot(s.id, { articlePageId: e.target.value || undefined })}
                    className="w-full border border-input bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">— none (manual only) —</option>
                    {featured.length > 0 && (
                      <optgroup label="Featured articles">
                        {featured.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.data as ArticleData).headline || "Untitled article"}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="All articles">
                      {allArticles
                        .filter((p) => !featured.find((f) => f.id === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.data as ArticleData).headline || "Untitled article"}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </Field>
                <Field label={`Headline override${linkedArt ? ` (auto: ${linkedArt.headline})` : ""}`}>
                  <Input value={s.overrides?.headline ?? ""} onChange={(v) => updateOverride(s.id, "headline", v)} />
                </Field>
                <Field label="Byline override">
                  <Input value={s.overrides?.byline ?? ""} onChange={(v) => updateOverride(s.id, "byline", v)} />
                </Field>
                <Field label="Page # override">
                  <Input value={s.overrides?.pageNumber ?? ""} onChange={(v) => updateOverride(s.id, "pageNumber", v)} />
                </Field>
                <Field label="Image URL override">
                  <Input value={s.overrides?.imageUrl ?? ""} onChange={(v) => updateOverride(s.id, "imageUrl", v)} />
                </Field>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addSlot}
          className="mt-2 w-full border border-dashed border-border py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:bg-muted/40"
        >
          + Add slot
        </button>
        <p className="text-[10px] text-muted-foreground pt-1">
          Add text or image blocks via the canvas toolbar, then use the
          <em> Slot </em> dropdown in each block's toolbar to bind it to a
          slot field (headline, byline, page #, image).
        </p>
      </Section>
    </>
  );
}
