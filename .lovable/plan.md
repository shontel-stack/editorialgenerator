# Page background artwork (PDF / image / IDML+PDF)

Lets you attach uploaded artwork as the background of any page or spread, with a per-page toggle for whether your template/blocks render over it or the artwork fully replaces the page.

## What you'll get

- "Background artwork" section in the **Edit page** flyout for the selected page (and a spread variant when spread view is on).
- Upload accepts: **PDF**, **JPG / PNG / WebP**, **IDML (paired with a PDF)**.
- Per page: **Overlay** (template + blocks render on top) or **Replace** (only your custom blocks render on top, template is hidden).
- For spreads: an upload dialog asks **"split one PDF page in half"** or **"two PDF pages = one spread"**, plus which page numbers.
- For IDML: required companion PDF supplies the visual. Text stories are parsed and offered as a one-click "Fill page fields from IDML" action (section, title, byline where matched).
- Remove / replace background at any time. Background is stored once, referenced by URL on the page.

## Where things live

- Storage: existing `issue-attachments` bucket. New folder convention `{user_id}/{issue_id}/bg/...` for rasterized backgrounds and source uploads.
- Per-page data: new optional field on `IssuePageNode`:
  ```ts
  backgroundArtwork?: {
    url: string;            // PNG/JPG rendered from PDF page, or uploaded image
    sourceUrl?: string;     // original PDF/IDML, kept for re-render/export
    sourceKind: "pdf" | "image" | "idml+pdf";
    pdfPageIndex?: number;  // 1-based, when from PDF
    crop?: "left" | "right" | "full"; // when splitting one PDF page across a spread
    mode: "overlay" | "replace";
    width: number; height: number; // intrinsic px
  }
  ```
  Persisted via the existing `issue_drafts` JSON — no schema migration needed.

## Rendering

- `PagePreview` gets a new optional `backgroundUrl` + `mode` prop. When set:
  - draws an `<img>` at the page's intrinsic size, behind everything.
  - in `replace` mode, the template renderer (cover/article/photo/ad/contents) is skipped — only `CustomBlocksLayer` renders on top, so blocks/QR/text stay editable.
  - in `overlay` mode, template still renders. Useful for stamping a folio over uploaded art.
- Export paths (`idmlExport`, IDML export, PDF download): include the background image as the base layer.

## PDF handling (client-side)

- Add `pdfjs-dist` (worker entry imported via Vite `?url`).
- On upload: open the PDF, show a thumbnail picker; user chooses page index (and for spreads, the split / two-page mode).
- Rasterize the chosen page(s) at 200 DPI to PNG blob, upload to `issue-attachments`, store the original PDF too.
- Re-render on demand if the user changes the chosen page or DPI.

## IDML handling

- Add `jszip` (already common, will verify).
- Parse `Stories/Story_*.xml` for `Content` text. Surface a small "Imported text" list in the panel.
- Require a companion PDF in the same upload step ("IDML needs a PDF for the visual"). The PDF becomes the background; IDML stays as metadata + text.
- One-click "Fill from IDML" maps the first long-ish run to `headline`/`title`, first short uppercase run to `section`, etc. (best-effort, user reviews).

## UI flow

- **Edit page flyout** → new "Background artwork" section:
  - Empty state: `Upload PDF / image / IDML+PDF` button.
  - Filled state: thumbnail, filename, page chip (e.g. "PDF p.3"), Overlay/Replace segmented control, Replace and Remove buttons.
- Upload dialog (modal):
  - File picker (multi for IDML+PDF).
  - When PDF + spread: radio "split one page" vs "two pages = spread" + page-number inputs with thumbnails.
  - When IDML: shows parsed story preview + asks for the PDF.
- Toast on success / error.

## Out of scope

- No server-side rendering. No InDesign-quality IDML rendering.
- No automatic block placement from IDML text frames (only text extraction + one-shot field fill).
- No edits to autosave, RLS, or `issue_drafts` schema.
- No new database tables; uses existing storage bucket and per-page JSON.

## Files to touch

- `src/lib/coverDefaults.ts` — add `backgroundArtwork` to `IssuePageNode`.
- `src/components/PagePreview.tsx` — render background + honor `replace` mode.
- `src/routes/_authenticated/index.lazy.tsx` — Edit page flyout: background section + upload dialog wiring.
- New: `src/components/PageBackgroundUploader.tsx` — modal handling PDF/image/IDML, page picker, spread split.
- New: `src/lib/pdfRender.ts` — pdf.js worker setup + `rasterizePdfPage(file, pageIndex, dpi)`.
- New: `src/lib/idmlParse.ts` — unzip + extract stories.
- `package.json` — add `pdfjs-dist`, `jszip` (if missing).

## Risks / notes

- pdf.js worker must be configured for Vite (`?url` import) or rendering fails silently — covered in the helper.
- Large PDFs: cap rasterization to one page at a time; warn if file > 25 MB.
- Storage usage will grow — original PDF + rendered PNG per use. Acceptable, and "Remove background" deletes both.

Approve and I'll build it end-to-end in one pass.
