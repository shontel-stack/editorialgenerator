# Uploads + AI Vision for Layouts

Two upload surfaces, both feeding the assistant:

1. **Issue template** — one PDF (or image) per issue, attached in the dashboard header. The assistant uses it as the "look I'm matching" reference for the whole issue.
2. **Per-page reference** — each article/photo/ad page gets an "Add reference" button accepting PDF, image (JPG/PNG), or Word (.docx). Used as context when drafting copy or picking a layout for that page.

## What the user sees

- **Header** (next to "Ask the editor"): "Layout template" pill. Empty state = "Upload reference". Filled state = filename + thumbnail (first page for PDFs), with replace/remove.
- **Each page card**: small paperclip button → "Reference: filename" chip when attached. Click to view/replace/remove.
- **Assistant panel**: a "References" strip at the top of the chat listing what it currently sees (issue template + any per-page refs). New tool: `analyze_template` — runs Gemini vision on the issue template and proposes a page list / layouts / fonts the user can apply.

## Storage + data

- New private Supabase Storage bucket `issue-attachments`. RLS: anyone can read/write (matches existing public-issue posture; lock down later if auth is added).
- New table `issue_attachments`:
  - `id`, `issue_id` (text), `page_id` (text, nullable — null = issue template)
  - `kind` ('template' | 'reference'), `file_path` (storage path), `file_name`, `mime_type`, `size_bytes`
  - `extracted_text` (text, nullable — populated for PDF/Word so the assistant has cheap text context)
  - `created_at`
- Unique partial index so each `(issue_id)` has at most one `kind='template'` and each `(issue_id, page_id)` has at most one `kind='reference'`.

## AI wiring

- New server fn `extractAttachmentText` — on upload: PDF → pdfjs text; Word → `mammoth`; image → skip. Stored in `extracted_text`.
- New server fn `analyzeTemplate` — sends PDF pages (rendered to images) + prompt to `google/gemini-2.5-pro` via Lovable AI Gateway. Returns structured JSON: suggested page sequence with type + layout + headline placeholders. Chat panel surfaces "Apply suggestions" which dispatches existing `add_page` / `set_article_layout` / `update_page_field` patches.
- Existing `/api/chat` system prompt extended with a compact `references` block (filenames + extracted text snippets + signed URLs for any images). For vision-capable turns, image refs are attached as message parts so Gemini actually "sees" them.

## Out of scope (call out, don't build)

- InDesign .indd/.idml — no Worker-compatible parser exists.
- OCR of scanned PDFs (only embedded text extracted in v1).
- Multi-page-per-article references (one file per page in v1).

## Technical notes

- PDF rendering uses `pdfjs-dist` (Worker-compatible, pure JS) inside `analyzeTemplate.server.ts` to produce page PNGs in memory, base64 to Gemini.
- Word extraction via `mammoth` (pure JS, Worker-safe).
- Uploads go from the browser straight to Supabase Storage with the publishable key, then a server fn is called to run extraction and write the `issue_attachments` row.
- File size cap 10 MB client-side; surface a toast on reject.

## Order of work

1. Migration (table + bucket + RLS) — needs user approval first.
2. Upload UI (header + per-page) wired to storage and table.
3. Text extraction server fn + display of "references" strip in assistant.
4. `analyzeTemplate` server fn + "Apply suggestions" flow.

Confirm and I'll start with step 1.
