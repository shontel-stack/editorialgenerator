# Free-form header & footer editing

Today each page/cover template hard-codes the running header (folio + rule) and footer (page number, section, ad slug, etc.) into `PagePreview`. Users can hide a page's header but cannot move, restyle, or add multiple header/footer elements. We'll lift headers and footers into the existing custom-blocks system so they get drag, resize, rich text styling, and per-page overrides — for both internal pages and covers.

## What the user gets

- **Drag & resize** any header/footer element anywhere on the page (with the same snap guides as other blocks).
- **Rich text styling** — font family, size, weight, italic, alignment, color, letter-spacing.
- **Multiple elements** per zone: e.g. page number + section title + date in the footer, masthead + issue number + tagline in the header.
- **Per-page overrides** with an "Apply to all pages" action so a tweak can stay local or be promoted to the master.
- Works on covers (front, back, inside-front, inside-back) and every internal template.

## How it works

### Data model (`coverDefaults.ts`)
- Add `headerElements: HFElement[]` and `footerElements: HFElement[]` to `MasterPages` (issue-wide default) and to `IssuePageNode` (per-page override).
- `HFElement` = `{ id, kind: "folio"|"page-number"|"section"|"date"|"masthead"|"text"|"divider", text?, token?, x, y, w, h, style: TextStyle, align, zone: "header"|"footer" }` where `token` is a placeholder resolved at render time (`{page}`, `{section}`, `{issue}`, `{date}`, etc.).
- Migration helper converts the legacy single-`folio` string into a default `HFElement` array so existing issues render identically.
- `hideHeader` stays; add matching `hideFooter`. `headerElements`/`footerElements: null` means "inherit from master".

### Rendering (`PagePreview.tsx`, `CoverPreview.tsx`)
- Replace inline header/footer JSX in every template with a new `<HeaderFooterLayer page={...} master={...} side={...} />`.
- The layer resolves effective elements (page override ?? master), expands tokens, and renders each element as an absolutely-positioned block using the existing intrinsic page coordinate space so export PDFs stay pixel-identical.
- `replace`-mode background artwork already skips templates; we keep header/footer hidden in that mode unless explicitly toggled.

### Editing UI
- Extend `CustomBlocksLayer` so header/footer elements participate in the same selection / drag / resize / snap pipeline as user blocks. They carry a `system: true` flag so deleting reverts to master instead of removing.
- New **Header & Footer** section in the right-hand Edit-page flyout:
  - List of elements per zone with reorder, add (`+ Text`, `+ Page #`, `+ Section`, `+ Date`, `+ Divider`), and remove.
  - Selected element shows the existing text-style controls (font, size, weight, italic, align, color) plus position/size inputs.
  - Buttons: **Reset to master**, **Apply to all pages** (writes current zone back to `MasterPages`).
- A small **Header / Footer** tab in the Cover editor (front/back/inside) reuses the same component.

### Persistence
- Header/footer overrides live inside the existing `issue.pages[*]` JSON blob, so no schema migration is required.
- Master changes write through the existing `MasterPages` persistence path.
- Autosave + draft-conflict flow already covers these fields once they're part of the issue JSON.

## Files touched

- `src/lib/coverDefaults.ts` — types, defaults, legacy-folio migration, token resolver.
- `src/components/HeaderFooterLayer.tsx` *(new)* — render + edit-mode interactions.
- `src/components/PagePreview.tsx` — swap inline header/footer JSX in every template for `HeaderFooterLayer`.
- `src/components/CoverPreview.tsx` — same swap for cover templates.
- `src/components/CustomBlocksLayer.tsx` — allow system blocks (header/footer) to share the drag/resize/snap pipeline.
- `src/routes/_authenticated/index.lazy.tsx` — new Header & Footer section in the Edit flyout, plus cover tab.
- Minor: `src/lib/idmlExport.ts` / `exportCover.ts` to emit the new elements at export time.

## Out of scope
- Page-by-page header/footer image uploads (covered already by Background artwork).
- Sectional master pages (different masters for different chapters). Can be added later by extending `MasterPages` to a map keyed by section.

Confirm and I'll build it.
