## AI Creative Generator — Plan

A brand-aware image generator that produces model shots, full ad layouts, product/still-life images, and article hero art. Available as **both** a standalone route and an in-editor sidebar panel, sharing one backend.

### 1. Backend (shared by both surfaces)

**Streaming image endpoint** — `src/routes/api/generate-image.ts` (server route, not a serverFn — server functions can't stream `Response`).
- Uses Lovable AI Gateway, model `google/gemini-3.1-flash-image` (Nano Banana 2) — fast, high quality, supports partial previews natively.
- Body shape: `{ messages, modalities: ["image","text"], stream: true }` per the image-gen knowledge.
- Passes upstream SSE body straight through — no re-wrapping.

**Prompt-craft server function** — `src/lib/generator.functions.ts`
- `craftGenerationPrompt({ creativeType, subject, mood, aspect, brandContext? })` — uses `google/gemini-2.5-flash` via AI Gateway to expand the user's short inputs into a detailed image prompt tuned per creative type (model / ad / still-life / hero).
- Non-streaming, typed RPC. Called by both surfaces before hitting the streaming endpoint.

**Save-to-project server function** — `src/lib/generator.functions.ts`
- `saveGeneratedAsset({ dataUrl, meta })` — decodes base64 PNG, uploads to `issue-attachments` bucket under `generated/{userId}/{uuid}.png`, inserts a `generated_assets` row.
- Uses `requireSupabaseAuth`.

### 2. Database

New table `public.generated_assets`:

```text
id uuid pk, user_id uuid, publication_id uuid nullable,
creative_type text, prompt text, refined_prompt text,
storage_path text, public_url text,
brand_applied boolean, created_at timestamptz
```

- RLS: owner-only (`auth.uid() = user_id`).
- GRANTs: `authenticated` CRUD, `service_role` ALL.

### 3. Client — shared component

`src/components/GeneratorStudio.tsx` — the actual generator UI, used by both the panel and the standalone page.

Fields:
- **Creative type** chip row: Model shot · Full ad · Product · Article hero.
- Per-type input scaffolds (e.g. Model shot → subject description, styling, setting, mood; Ad → brand, headline, product; etc.).
- **Aspect** (portrait / square / landscape).
- **Brand-aware** toggle (default off) — when on, injects the issue's palette + font style + tone descriptor from `brandKitContext` into the crafted prompt.
- **Enhance prompt** button → calls `craftGenerationPrompt`, shows the refined prompt (editable).
- **Generate** → streams via `streamImage` helper (reused pattern from `ai-image-generation` knowledge), with the mandatory `flushSync` parser and blur-on-partial CSS.
- Result actions: **Use on this page** (only shown in editor context — writes to current page's `imageUrl`), **Save to library**, **Download**, **Regenerate**.

Uses `streamImage` implementation from the knowledge (eventsource-parser + flushSync).

### 4. Surface A — in-editor sidebar panel

- New rail button (`Wand2` icon) in `src/routes/_authenticated/index.lazy.tsx` next to Attachments.
- Popover renders `<GeneratorStudio context="editor" onUseImage={(url) => setImageOnCurrentPage(url)} />`.
- The "Use on this page" button routes the image into whatever the currently selected page's image slot is (cover imageUrl, article imageUrl, photo imageUrl, ad image, article hero, or a new Custom Block if the page has no obvious slot).

### 5. Surface B — standalone page

- Route `src/routes/_authenticated/generate.tsx` — full-page layout with `<GeneratorStudio context="standalone" />` plus a "Library" sidebar listing prior `generated_assets` rows for the user (thumbnail grid, click to preview / copy URL / download).
- Reachable from the editor rail's overflow menu and from the top nav.
- Has its own head() metadata (title/desc/og).

### 6. Brand-awareness (optional toggle)

When enabled, the prompt-craft function receives:
- Active issue's palette (existing `data.palette`),
- Fonts (`master.fonts.display` / `serif` label),
- Publication name + tagline,
- A short style descriptor derived from the brand kit.

These are woven into the refined prompt (e.g. *"...palette dominated by deep burgundy #6b1320 and cream #f5f0e6, editorial serif type feel, quiet luxury tone..."*). Palette is a soft steer, not a hard constraint.

### 7. Technical notes

- **`flushSync` is mandatory** on the SSE parser — without it React batches partial frames and progressive preview disappears.
- **CSS blur** on partial frames (`filter: blur(16px)` → `blur(0)` on completion) so intermediate images don't flicker.
- Never call the image endpoint from client code with `LOVABLE_API_KEY` — always through the server route.
- Content-policy errors from the model (real people, IP characters) surface as user-visible errors with a suggestion to rephrase or switch model.
- No new secrets; `LOVABLE_API_KEY` is already provisioned.

### 8. Deferrals

Not in this pass (call out for future rounds):
- Multi-image reference conditioning (upload a photo → "generate more like this"). Nano Banana 2 supports it, but adds UI/upload complexity.
- Video generation.
- Full ad layout as compiled InDesign-ready art (this pass generates the *image*; assembly into the Ad page template can be a follow-up).

Ship the plan?