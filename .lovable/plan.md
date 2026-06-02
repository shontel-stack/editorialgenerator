## Goal

Move from the current fixed 4 pages (Cover · Contents · Feature · Photo) to a **dynamic issue** you assemble each month: add as many article, photo essay, and ad pages as you want, paste in copy, and export the whole publication as one print-ready, interactive PDF for InDesign / Canva / Fresco.

## What you'll be able to do

1. Build an issue as an ordered list of pages (Cover always first, Back Cover always last, everything in between is yours).
2. Add pages from a palette:
   - **Cover** (one, locked to position 1)
   - **Contents** (auto-generated from the page list — page numbers and links update themselves)
   - **Article** (1–N paragraphs of body copy, headline, dek, byline, optional pull quote, optional image, drop cap toggle, 1 or 2 columns)
   - **Photo Essay** (full-bleed / framed / split)
   - **Full-Page Ad** (brand name, headline, body, CTA, image, optional URL — burgundy/black/white aesthetic by default, fully restyleable)
   - **Half/Quarter Ad block** (placed on an article page — phase 2, noted below)
   - **Back Cover** (one, locked to last position)
3. Reorder pages by drag handle (up/down buttons in v1 to keep it simple).
4. Edit any page by selecting it in the page list.
5. **Save / Load issue** as a JSON file (your "source of truth" for the month — round-trips so you can hand it off and reload later).
6. **Export Publication PDF** — one PDF with every page at 10.6667″ × 14.2222″, 300 DPI, bookmarks per page, clickable Contents.
7. Per-page exports (PDF / PNG / JPG) remain for handing single pages to a designer in Canva or InDesign.

## Page list UX

Left sidebar shows the issue as a vertical list:

```text
01  Cover                     [edit]
02  Contents          (auto)  [edit]
03  Article · "The Patient Hand"   ↑ ↓  × [edit]
04  Ad · Maison Léa                ↑ ↓  × [edit]
05  Photo Essay · "Rooms"          ↑ ↓  × [edit]
06  Article · "After Figuration"   ↑ ↓  × [edit]
...
NN  Back Cover                 [edit]

[+ Add page ▾]   [Save issue]  [Load issue]
[⤓ Export Publication PDF]
```

Selecting a row swaps the main editor panel to that page's fields. Selecting it also drives the preview stage on the right.

## Contents page becomes automatic

Today the contents entries are typed by hand. New behavior: the contents page reads the page list and auto-fills section / title / byline / page number / link target. You can still override any row, and you can hide rows (e.g. ads) from the table of contents with a per-page "List in contents" toggle.

## Ad page model

```text
brand           "Maison Léa"
eyebrow         "Advertisement"      (small, top, optional)
headline        "Quiet objects for quiet rooms."
body            short paragraph
cta             "maisonlea.com"
image           full-bleed or framed
palette         paper / ink / burgundy (default ink with burgundy rule)
logoColor       same picker as cover, for the brand wordmark
```

Renders in the same luxe editorial system so ads don't visually break the magazine.

## Round-trip with Canva / InDesign

- **Out → designers:** the Publication PDF is the deliverable. InDesign can `Place` each page of it; Canva can import it as a template; Fresco opens it for painting over.
- **In ← designers:** designers can hand you finished page PDFs. Phase 2 will add a "Replace page with uploaded PDF" action so an InDesign-perfected page slots into the issue without losing the rest. Noted as a follow-up, not in this build.
- **Source of truth:** the JSON save file. That's what survives month over month — text, layout choices, ad slots — and is what lets you hand off "the copy" without a designer ever touching the app.

## Technical changes (for reference)

- `src/lib/coverDefaults.ts`
  - New `AdData` type. `PageType` becomes `"cover" | "contents" | "article" | "photo" | "ad" | "back"`.
  - New `IssueDoc` type: `{ meta, pages: IssuePageNode[] }` where each node is `{ id, type, data, includeInContents }`.
  - `DEFAULT_ISSUE` seed with cover + contents + 1 article + 1 ad + 1 photo + back cover.
  - Article gets `columns: 1 | 2` and supports arbitrary paragraph count (already works — body is split on blank lines).
- `src/components/PagePreview.tsx`
  - Add `AdPreview` and `BackCoverPreview` renderers; dispatcher already routes by `pageType`.
  - Contents renderer takes derived entries computed from the issue, not stored entries.
- `src/routes/index.tsx`
  - Replace the 4-tab bar with a **Page List** sidebar (add / remove / reorder / select).
  - Editor panel becomes a switch on selected page id.
  - "Export Publication PDF" replaces "Export Issue PDF" and iterates the dynamic list. Hidden off-screen stage maps `id → ref` and mounts every page so capture works without flipping tabs.
  - "Save issue" → downloads `arts-today-<slug>.json`. "Load issue" → file input, validated with zod, replaces state.
- `src/lib/exportCover.ts`
  - `exportIssuePdf` already accepts an ordered `IssuePage[]`; extend to N pages and to the new types. Contents links resolve by page id → final page index.
- Burgundy/black/white palette and logo-color picker stay as the active system; ads and back cover inherit it.

## Out of scope for this build (explicit)

- Drag-and-drop reordering (use ↑/↓ in v1).
- Importing a designer's PDF to replace a single page.
- Half / quarter ads inside an article page.
- IDML export. PDF + JSON is the exchange format.

If this matches what you want, I'll build it.