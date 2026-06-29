## Goal

Bring the page editor closer to Figma/Canva/Replit feel without changing the current canvas layout or page model. All work stays scoped to the active page's custom blocks layer plus a thin collaboration overlay.

## Scope (in order)

### 1. Smart guides & snapping (CustomBlocksLayer)
- During drag/resize of a block, compute snap candidates against:
  - Page edges and centerlines
  - Other block edges (L/R/T/B) and centers (X/Y)
  - Equal-spacing hints between 3+ blocks
- Snap threshold ~4px in canvas units. Show pink 1px guide lines on the overlay while a snap is active; clear on pointer-up.
- Hold Alt to temporarily disable snapping.

### 2. Multi-select, group/ungroup, lock
- Marquee select on empty-canvas drag (left mouse on page background).
- Shift+click toggles a block in/out of selection.
- Move/resize/rotate/nudge/delete operate on the whole selection; resize uses the union bounding box and scales proportionally.
- Cmd/Ctrl+G groups selection (stored as `groupId` on each block); Shift+Cmd/Ctrl+G ungroups. Clicking any group member selects the whole group; Alt+click drills into a single member.
- Lock toggle in Layers panel + toolbar (locked blocks ignore pointer + selection but remain visible).

### 3. Keyboard shortcuts + overlay
- Global shortcuts (scoped to focused editor): Cmd/Ctrl+D duplicate, Cmd/Ctrl+G group, Shift+Cmd/Ctrl+G ungroup, Cmd/Ctrl+] / [ z-order, Cmd/Ctrl+L lock, Arrow nudge (Shift = 10px), Cmd/Ctrl+A select all on page, Esc deselect, Delete/Backspace remove, `?` open overlay.
- New `ShortcutsHelp` dialog listing groups: Selection, Transform, Order, Clipboard, View. Trigger from rail + `?` key.

### 4. Clipboard & duplicate styles
- Cmd/Ctrl+C / X / V serialize selection to an internal clipboard (localStorage scoped per user). Paste places blocks at cursor with +12px offset; paste-in-place via Shift+Cmd/Ctrl+V.
- Alt-drag clones the selection on drop (already partially there for single block — extend to multi).
- Copy Style (Cmd/Ctrl+Alt+C) / Paste Style (Cmd/Ctrl+Alt+V): copies visual props only (fill, stroke, radius, opacity, font, color, align, shadow) without geometry/content.

### 5. Comments & pins (Lovable Cloud)
- New `page_comments` table: id, issue_id, page_id, x, y (page-relative %), author_id, body, resolved, created_at + thread table `page_comment_replies`.
- RLS: owner of issue + invited collaborators (start with owner-only; future-proof).
- Pin overlay on the page: small numbered bubbles; click opens a popover with thread + resolve button. New comment via "C" tool from rail.

### 6. Live presence cursors (Realtime)
- Supabase Realtime presence channel keyed by `issue:{id}:page:{id}`.
- Broadcast `{x,y,name,color}` throttled to ~30Hz. Render labeled cursors above the canvas.
- Show participant avatars in the top status bar.

### 7. Version history
- New `issue_versions` table: id, issue_id, snapshot_jsonb, label, created_by, created_at.
- Auto-snapshot on debounce (every ~60s of edits) + manual "Save version" button. History panel shows list with timestamp/label, "Preview" (read-only render) and "Restore" (writes back to current issue with confirmation; restoring also creates a snapshot of the pre-restore state).

## Technical notes

- Snap engine: pure function `computeSnaps(activeRect, otherRects, pageRect, threshold)` returning `{dx, dy, guides[]}`. Unit-tested.
- Selection model: lift `selectedIds: string[]` into editor state alongside existing `selectedId`, with adapter so single-id call sites keep working.
- Groups: store `groupId?: string` on each block; selection helpers expand to full group on hit-test.
- Clipboard scope: per-user localStorage key `pl.clip.v1`, JSON-serialized blocks (drop ids; regenerate on paste).
- Comments overlay uses `data-export-ignore="true"` so it never prints in the PDF.
- Presence: a `usePresence(channelKey)` hook; cleanup on unmount; debounce broadcasts.
- Version snapshots: store only blocks + page metadata, not heavy uploaded media (reference by attachment id). Cap to last 50 per issue; older ones pruned.

## Files

- New: `src/lib/snapping.ts`, `src/lib/snapping.test.ts`, `src/components/ShortcutsHelp.tsx`, `src/components/CommentsLayer.tsx`, `src/components/PresenceCursors.tsx`, `src/components/VersionHistoryPanel.tsx`, `src/hooks/usePresence.ts`, `src/hooks/usePageClipboard.ts`.
- Edited: `src/components/CustomBlocksLayer.tsx` (selection model, marquee, groups, snap integration, shortcuts, clipboard, lock), `src/components/editor/EditorRail.tsx` (Comments, History, Shortcuts entries), `src/routes/_authenticated/index.lazy.tsx` (mount overlays + presence).
- Migration: `page_comments`, `page_comment_replies`, `issue_versions` with RLS + GRANTs; add tables to `supabase_realtime` publication.

## Out of scope (this pass)

- Infinite canvas / zoom-pan / minimap (you chose to keep current layout).
- Inviting external collaborators with separate roles (presence will use the existing authenticated user only).
- Real Figma-style auto-layout / constraints.

## Rollout order

1. Snap engine + guides
2. Multi-select + marquee + groups + lock
3. Shortcuts + overlay
4. Clipboard + copy/paste styles
5. Comments
6. Presence
7. Version history
