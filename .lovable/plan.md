# Brand-Kit Asset Manager

Extend the existing per-publication Library into a full Brand Kit with **Images**, **Fonts**, and **Color Swatches**. Reuses what's already there (image library, `issue-attachments` bucket, AttachmentsPanel) rather than rebuilding.

## What you get

- **Images** — already works (no change to behavior, just lives under a new "Brand Kit" tab heading).
- **Fonts** — upload WOFF2 / TTF / OTF per publication. Uploaded fonts:
  - load automatically across the editor via dynamic `@font-face`
  - appear in the per-text-block font picker
  - can be assigned to the publication's Display / Serif / Sans slot so every article + cover uses them
- **Color swatches** — save brand hex colors per publication. Swatches appear next to every color input on text blocks, image-block backgrounds, and the cover.

## Where it lives in the UI

- Existing library button opens the same right-side panel; new tabs: **Images · Fonts · Swatches**.
- Publication settings get a "Fonts" section with three slot dropdowns that list both system fonts and uploaded fonts.

## Technical details

### Schema (new migration)
- `brand_fonts` table — per publication: `family_name`, `file_path` (in `issue-attachments`), `weight`, `style`, `format`. Owner-scoped RLS via `auth.uid()`.
- `brand_swatches` table — per publication: `name`, `hex`. Owner-scoped RLS.
- `publications` table: add `display_font_custom_id`, `serif_font_custom_id`, `sans_font_custom_id` (nullable FKs to `brand_fonts`). When set, override the existing `display_font` / `serif_font` strings.
- Reuse existing `issue-attachments` bucket for the font binaries (private; signed URLs).

### Code changes
- `src/lib/brandAssets.ts` — list/upload/delete for fonts and swatches.
- `src/hooks/useBrandFonts.ts` — fetches fonts for active publication and injects `@font-face` rules into the document, exposes `{ fonts, register, remove }`.
- `src/hooks/useBrandSwatches.ts` — CRUD for swatches.
- `src/components/BrandKitPanel.tsx` — new tabs (Images / Fonts / Swatches); Images tab just reuses the existing Library list.
- `src/components/SwatchPicker.tsx` — small component shown beside `<input type="color">` in the text-block toolbar, image block bg, cover.
- `src/components/CustomBlocksLayer.tsx` — font-family dropdown lists uploaded fonts after the 3 system slots; color inputs render `<SwatchPicker>` below them.
- `src/lib/coverDefaults.ts` — extend the per-block `fontFamily` type from `"display" | "serif" | "sans"` to also accept a `custom:<id>` token.
- Publication settings UI — new dropdowns for the 3 slots, populated from `useBrandFonts`. When a slot is set, the resolved font stack used by the renderer prefers the custom font.

### Limits
- Fonts: WOFF2 / TTF / OTF, max 5 MB each (browsers reject unrealistic file sizes anyway).
- Swatches: free-form, no preset limit.
- Per-publication scoping mirrors the existing image Library.

### Out of scope (call out, don't build)
- Font subsetting / format conversion.
- Variable-font axis controls.
- License/EULA tracking for uploaded fonts (you upload only what you're licensed to use).

## Approve this plan and I'll start with the migration, then wire up the UI.