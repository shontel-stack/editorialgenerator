## Goal
Reorganize the editor chrome around a Figma/Canva-style frame: left icon rail, slim top bar, floating canvas toolbar, contextual right inspector, bottom status bar. Keep all existing functionality — only move it.

## New frame

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Top bar (slim):  ⌂ Pageluxe │ Pub switcher │ Issue title │ Undo/Redo │ Zoom % │ Export │ ⚙   │
├────┬───────────────────────────────────────────────────────────┬─────┤
│ L  │                                                            │  R  │
│ E  │                                                            │  I  │
│ F  │                Canvas (page preview)                       │  N  │
│ T  │     [ floating Add toolbar bottom-center ]                 │  S  │
│    │                                                            │  P  │
├────┴───────────────────────────────────────────────────────────┴─────┤
│ Status bar:  page size · snap · autosave state · zoom (mirror)        │
└──────────────────────────────────────────────────────────────────────┘
```

### Left rail (icons, ~56px, tooltips on hover)
Click an icon → opens a flyout panel (256–320px) docked to the rail. Click again or Esc to close. One panel at a time.

- Pages — the existing pages list / reorder
- Layers — block list for the active page (from CustomBlocksLayer)
- Assets — AttachmentsPanel
- Brand — BrandKitPanel
- Chat — AssistantPanel
- Staff — StaffPanel (admins only)

### Top bar (slim, ~44px)
- Pageluxe wordmark (home)
- WorkspaceSwitcher (publication)
- Editable issue title inline
- Undo / Redo
- Zoom out / % / Zoom in / Fit
- Export menu (PDF, checklist)
- Settings menu (page size, snap defaults, references, newsletter)

### Floating canvas toolbar (bottom-center, pill)
- Add Text · Image · Shape (rect/ellipse/line) · QR · Divider
- Alignment cluster appears when ≥1 block is selected
Disappears in preview-only mode.

### Right inspector (contextual, 280px)
- Nothing selected → Page panel: page background, columns, running header toggle (the "delete top headers" control)
- Block selected → Block panel: size, position, fill, stroke, text style, snap-to controls
- Multi-select → alignment + distribute only

### Bottom status bar (~28px)
- Current page size (W × H mm)
- Snap mode chip
- Autosave indicator (AutosaveIndicator)
- Zoom % (mirror of top bar)

## Implementation steps

1. **New shell component** `src/components/editor/EditorShell.tsx` — CSS grid: `[topbar] / [rail panel canvas inspector] / [status]`. Owns active-rail-panel state + selection-aware inspector mode.
2. **New rail** `src/components/editor/LeftRail.tsx` + `RailFlyout.tsx`. Move existing pages/layers/assets/brand/chat/staff JSX out of index.lazy.tsx into rail panels (thin wrappers reusing the existing components).
3. **New top bar** `src/components/editor/TopBar.tsx` — pull WorkspaceSwitcher, undo/redo, zoom, export, settings cluster out of index.lazy.tsx.
4. **Floating add toolbar** `src/components/editor/CanvasToolbar.tsx` — wraps existing Add/shape/QR handlers from index.lazy.tsx.
5. **Contextual inspector** `src/components/editor/Inspector.tsx` — reads current selection from the editor store, renders `PageInspector` vs `BlockInspector` vs `MultiSelectInspector`. Reuses existing per-block control code from PagePreview / CustomBlocksLayer.
6. **Status bar** `src/components/editor/StatusBar.tsx` — page size + snap chip + AutosaveIndicator + zoom mirror.
7. **Refactor `src/routes/_authenticated/index.lazy.tsx`** to render `<EditorShell>` and pass the existing handlers/state through props. Keep the heavy business logic in this file untouched — only the JSX layout changes.
8. **Responsive**: ≥1280px = full chrome; 768–1279px = rail auto-collapses panel on canvas click; <768px = rail becomes a bottom tab bar, inspector becomes a bottom sheet.
9. **Keyboard**: `[` toggle left panel · `]` toggle right inspector · `Cmd/Ctrl+0` fit · `Cmd/Ctrl+=` / `-` zoom.

## Technical notes

- No backend changes. No new dependencies. All Tailwind + existing shadcn primitives (`Sidebar` is not a good fit here — we'll build a thin custom rail because Figma-style rails are denser than the shadcn sidebar).
- Selection state already exists in the CustomBlocksLayer/PagePreview store — Inspector subscribes to it; no new global state needed.
- All current popovers (Brand, Snap, Add, Export) get deleted from the top bar once their content has moved into the rail/inspector/status bar.
- No visual rebrand — same fonts, same tokens; only layout changes.

## Out of scope
- Changing how blocks render or save
- Renaming/restructuring routes
- Touching autosave, RLS, or any server function
- The cover/interior preview math (kept as-is)

## Risk
index.lazy.tsx is 3174 lines and currently owns most of this state. The refactor will move JSX but not logic — props in, callbacks out. I'll do it in the order above so each step keeps the editor working; you'll see the new frame appear progressively.
