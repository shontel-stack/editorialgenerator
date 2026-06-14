## Goal
A new page type **Custom contents** that you can lay out freely on page 5 (or anywhere). Each featured article gets a labeled "slot" — its headline, byline, and page number flow into your text boxes, and its lead image flows into a shape frame you can skew or carve into a custom path.

## What you'll get

**Add Page → Custom contents** creates a blank canvas (footer only, like the recent Blank page) plus a *Featured slots* panel in the right sidebar.

For each slot (Feature 1, Feature 2, …) you can:
- **Auto-link** it to an article page from a dropdown → its headline, byline, and live page number auto-fill any text box / image frame tagged with that slot.
- **Override manually** — type a custom headline/byline, or pin a specific page number / image, even when linked.

**Slot tagging on blocks** — every text box and image frame on a custom-contents page gets a new "Slot" dropdown in its block toolbar:
- `Unassigned` (free text/image)
- `Feature 1 · headline` / `Feature 1 · byline` / `Feature 1 · page #` / `Feature 1 · image`
- …same for Feature 2, 3, etc.

A block tagged to a slot field renders the slot's value automatically (with manual overrides winning over auto-pulled values). Untagged blocks stay free-form.

**Image frames** gain shape controls on this page type (and reused elsewhere for image blocks):
- Skew X / Skew Y sliders + rotation (already exists)
- Frame shape: Rectangle (with corner radius), Ellipse, Polygon (3–12 sides), or Custom path
- Custom path: drag points on a small editor to draw a clip mask — stored as SVG path, rendered as `clip-path`

## Article side
Each article page gets a "Featured on contents" toggle in its editor. When on, the article appears in the slot dropdown on every custom-contents page. (Hybrid mode: you can also leave it off and still link manually.)

## Technical sketch
- `src/lib/coverDefaults.ts` — add `"custom-contents"` to `PageType`, `CustomContentsData` (slots: `{ id, label, articlePageId?, overrides: { headline?, byline?, pageNumber?, imageUrl? } }[]`, palette, folio), `DEFAULT_CUSTOM_CONTENTS`. Add optional `featuredInContents?: boolean` to `ArticleData`.
- `src/lib/coverDefaults.ts` — extend block types in `CustomBlock` (already used by CustomBlocksLayer) with `slotBinding?: { slotId: string; field: "headline" | "byline" | "pageNumber" | "image" }`, and add `skewX`, `skewY`, `frameShape: "rect" | "ellipse" | "polygon" | "path"`, `polygonSides`, `clipPath` to image blocks.
- `src/components/CustomBlocksLayer.tsx` — when rendering on a `custom-contents` page, resolve `slotBinding` against the page's slots + linked article (overrides > article data). Add skew via CSS transform; apply `clip-path` to image blocks based on `frameShape`. Add Slot dropdown + Shape controls to the block toolbar.
- `src/components/PagePreview.tsx` — new `CustomContentsPreview` (footer-only base, like `BlankPreview`); CustomBlocksLayer does the rest.
- `src/routes/_authenticated/index.lazy.tsx` — add to Add Page menu; new `CustomContentsEditor` sidebar (slots CRUD, article picker dropdown, per-slot manual override fields); add "Featured on contents" toggle in `ArticleEditor`.
- `src/lib/issue-snapshot.ts` + `src/lib/chat-tools.ts` — register `"custom-contents"` in `addPageSchema` and snapshot title.
- `src/lib/idmlExport.ts` — handle `custom-contents` (same path as blank + custom blocks; resolve slot bindings to literal strings during export).
- `src/lib/issue-patch.ts` — add `"custom-contents"` to `add_page` union.

## Out of scope (ask if you want them)
- Pulling lead image automatically from article hero image (vs. you placing it). Default plan: image auto-pulls if the article has a hero, else slot stays empty until you drop one in.
- A custom-path drawing tool more elaborate than draggable points (e.g. bezier curves).
- Reordering slots by drag (will use up/down buttons first).
