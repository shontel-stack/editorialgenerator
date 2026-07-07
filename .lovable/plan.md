
# Visual & UX Polish Audit — Prioritized Punch List

Scope: read-only audit of dark mode, empty states, async feedback, panel/toolbar ergonomics, and responsive behavior. Findings below are ranked quick-wins-first (impact / effort). Effort: **S** = <½ day, **M** = ½–2 days, **L** = 2+ days.

---

## Findings at a glance

| Area | Key gap |
|---|---|
| Dark mode | `@custom-variant dark` declared in `src/styles.css:7`; no `.dark` token block, no toggle anywhere. Handful of `dark:` classes exist as dead code. |
| Empty states | Panels are mostly covered with one-liners; **main routes (dashboard `index.tsx`, calendar, editor cold-open)** and **zero-publications first run** are not. |
| Async feedback | Autosave/cloud sync indicator is excellent; **exports (PDF/IDML/cover), newsletter send, AI layout proposals, image upload** have no toast layer in `src/lib/*` (0 hits) — failures can be silent. |
| Panels | Widths inconsistent (`420px` brand/attach/assistant, `460px` layout, `560px` staff, full-width mobile with no close affordance in some). ShortcutsHelp exists but only mounted in `__root.tsx` — no visible entry point. |
| Responsive | Editor (`index.lazy.tsx`, 4047 LOC) is desktop-only; board/calendar use `min-h-screen` with no responsive grid tuning; no "best on desktop" state. |

---

## Top 10 prioritized items

### 1. Remove or ship dark mode — don't leave it half-declared  ·  **S (remove) / L (complete)**
- **Area:** Dark mode
- **Files:** `src/styles.css` (L7 custom variant, no `.dark {}` block), stray `dark:` usages in `src/components/AutosaveIndicator.tsx`, `CustomBlocksLayer.tsx`, `CoverPreview.tsx`, `AuthPageContent.tsx`, `ai-elements/*`, `ui/alert.tsx`, `ui/chart.tsx`, `ui/input-group.tsx`, `lib/pageStatus.ts`.
- **Why it matters:** No toggle exists anywhere in the UI, and no `.dark` token overrides are defined, so every `dark:` class is dead. It bloats CSS, misleads contributors, and if a user ever adds `class="dark"` the app renders with paper tokens on paper — broken contrast.
- **Recommendation (quick win):** delete `@custom-variant dark` + strip `dark:` prefixes. If ship-later, propose an editorial dark set: `--paper → oklch(0.18 0.006 270)`, `--ink → oklch(0.96 0.004 90)`, `--ruby → oklch(0.62 0.17 22)` (brighter for contrast on dark), muted/border shifted up ~0.1L, then add a header toggle next to `SignOutButton`.

### 2. Add a real first-run / zero-publications state on the dashboard  ·  **M**
- **Area:** Empty states / onboarding
- **Files:** `src/routes/_authenticated/index.tsx` (20 LOC — currently a stub), `src/routes/_authenticated/index.lazy.tsx` cold-open branch, `src/hooks/useActivePublication.ts`, `WorkspaceSwitcher.tsx`.
- **Why:** A brand-new user with zero publications lands on the editor with no guidance. There's no "Create your first publication → new issue → pick template" path.
- **Recommendation:** editorial hero on `index.tsx` with 3-step onboarding card ("Name your publication", "Start an issue", "Pick a masthead") + CTA to `MagazineTemplatePicker`. Guard the editor route so it redirects to onboarding when publications = 0.

### 3. Wire toasts around every silent async action  ·  **S**
- **Area:** Loading & feedback
- **Files:** `src/lib/idmlExport.ts`, `src/lib/exportCover.ts`, `src/lib/pdfRender.ts`, `src/lib/newsletter.ts`, `src/lib/proposeLayout.functions.ts`, `src/lib/imageUpload.ts` — **0 `toast.*` calls across all six**.
- **Why:** Failures currently only surface via console. Export/AI/upload are the actions most likely to fail (network, file size, model timeout).
- **Recommendation:** wrap each entry point at its call site with `toast.promise(..., { loading, success, error })`. Standardize the copy ("Rendering PDF…", "Newsletter queued", "Layout proposal failed — retry?").

### 4. Discoverable keyboard-shortcuts affordance  ·  **S**
- **Area:** Panel/toolbar ergonomics
- **Files:** `src/components/ShortcutsHelp.tsx`, `src/routes/__root.tsx` (only mount), `src/components/editor/EditorStatusBar.tsx`.
- **Why:** `ShortcutsHelp` is mounted but no button/hint tells users it exists — only power users who guess `?` find it.
- **Recommendation:** add a tiny `?` icon in `EditorStatusBar` right of `AutosaveIndicator`, tooltip "Shortcuts (?)", opens the same dialog.

### 5. Normalize side-panel widths, headers, and close behavior  ·  **M**
- **Area:** Panel ergonomics
- **Files:** `BrandKitPanel.tsx`, `AttachmentsPanel.tsx`, `AssistantPanel.tsx` (420px), `LayoutProposalPanel.tsx` (460px), `StaffPanel.tsx` (560px, uses z-40 vs others z-50).
- **Why:** Three width tokens, two z-layers, and inconsistent header treatments make the editor feel patchwork. Some panels have no visible close on mobile (full-width, no ×).
- **Recommendation:** introduce `--panel-w-sm: 420px` / `--panel-w-lg: 560px` design tokens, one `<EditorPanelShell>` component with unified header (title, close ×, esc-to-close, focus trap, consistent border/shadow), migrate all five panels to it.

### 6. Skeletons + progress for image upload and cloud-sync migration  ·  **S**
- **Area:** Loading & feedback
- **Files:** `src/lib/imageUpload.ts`, `src/components/CustomBlocksLayer.tsx`, `src/components/PageBackgroundUploader.tsx`, base64 migration in `src/routes/_authenticated/index.lazy.tsx`.
- **Why:** Multi-MB image uploads (compressed then pushed to Storage) show no progress; the base64→Storage migration on open can take seconds with no visible state, contributing to the earlier "changes lost" perception.
- **Recommendation:** dashed placeholder + spinner overlay per image slot during upload; on doc load with legacy images, show a top banner "Modernizing images…" that resolves to "Done" and self-dismisses.

### 7. Real empty states on board, calendar, versions, comments, staff  ·  **S**
- **Area:** Empty states
- **Files:** `board.tsx:113`, `calendar.tsx` (no empty branch found), `VersionHistoryPanel.tsx:114`, `CommentsPanel.tsx:109`, `StaffPanel.tsx:500`, `IssueTemplatesPanel.tsx:184`.
- **Why:** All are terse single-line greys ("No X yet."). No icon, no CTA, no illustration — cold and off-brand for an editorial product.
- **Recommendation:** shared `<EmptyState icon title body action />` component; typeset with `font-display`, ruby-tinted icon, one primary action per state (e.g. "Create template from current issue", "Invite a collaborator", "Open the checklist").

### 8. Editor mobile/tablet guard  ·  **S (guard) / L (real responsive)**
- **Area:** Responsive
- **Files:** `src/routes/_authenticated/index.lazy.tsx` (4047 LOC, fixed-position rails + side panels stacking at 320px), `src/components/editor/EditorRail.tsx`.
- **Why:** Below ~1024px the fixed rails collide with panels and the toolbar clips. Editing a magazine on mobile isn't a real use case.
- **Recommendation:** on `< md`, render a full-screen editorial "Best experienced on desktop — open on a larger screen to edit" card with a read-only page preview and a link back to the dashboard. Keep dashboard/board/calendar responsive properly.

### 9. Dashboard/board/calendar responsive grid pass  ·  **M**
- **Area:** Responsive
- **Files:** `board.tsx` (uses `min-h-screen` only, no `sm:`/`md:` classes), `calendar.tsx` (same), `admin.*.tsx`.
- **Why:** Ripgrep shows zero responsive breakpoint utilities in these files. Columns don't reflow; tables overflow horizontally on tablet.
- **Recommendation:** apply the `grid-cols-[minmax(0,1fr)_auto]` header pattern from the responsive-layout guidance, wrap tables in `overflow-x-auto`, promote grids at `md:`.

### 10. Toolbar overflow & hit-target audit in the editor  ·  **M**
- **Area:** Panel/toolbar ergonomics
- **Files:** `src/components/editor/EditorRail.tsx`, `EditorStatusBar.tsx`, `AutosaveIndicator.tsx` (uppercase tracked `text-[10px]` buttons ~20px tall — under WCAG 24px target).
- **Why:** Autosave/cloud-sync/queue chips are three side-by-side buttons at 10px text; on narrower editor widths the status bar can overflow. No overflow-menu pattern exists.
- **Recommendation:** raise interactive chips to a 28×h tap target; group into a single popover ("Sync status") that opens the detailed view; add an overflow `⋯` for rail actions that don't fit.

---

## Suggested sequencing

1. **Day 1 quick wins:** #1 (delete dead dark), #3 (toasts), #4 (shortcut hint), #6 (upload spinners), #7 (empty-state component), #8 (mobile guard).
2. **Week 1:** #2 (onboarding), #5 (panel shell), #9 (responsive dashboards), #10 (toolbar).
3. **Later / optional:** ship a real dark theme (#1 long path) once brand direction is confirmed.

Ready for you to pick which items to implement — say the numbers and I'll switch to build mode with a focused plan.
