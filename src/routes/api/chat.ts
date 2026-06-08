import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireAuthFromRequest } from "@/lib/require-auth.server";
import {
  addPageSchema,
  addSpreadSchema,
  moveBlockSchema,
  removePageSchema,
  reorderPagesSchema,
  scaleBlockSchema,
  setArticleLayoutSchema,
  setFontsSchema,
  updateMasterSchema,
  updatePageFieldSchema,
} from "@/lib/chat-tools";
import type { IssueSnapshot } from "@/lib/issue-snapshot";

type ChatAttachment = {
  kind: "template" | "reference";
  page_id: string | null;
  file_name: string;
  mime_type: string;
  signed_url: string | null;
  extracted_text: string | null;
};

type ChatBody = {
  messages?: UIMessage[];
  issueSnapshot?: IssueSnapshot;
  selectedPageId?: string;
  attachments?: ChatAttachment[];
};

function buildSystem(
  snapshot: IssueSnapshot | undefined,
  attachments: ChatAttachment[],
  selectedPageId: string | undefined,
): string {
  const base = `You are the in-app editorial assistant for "The Arts Today" — a luxe, slow, contemporary art & culture magazine built in a custom layout tool.

Your job:
- Critique drafts, suggest pacing across spreads, propose headlines/deks/pull quotes, tighten copy.
- When the user gives you raw layout / article information, integrate it into the publication by CALLING TOOLS to update page fields, change article layouts, adjust master pages, set fonts, add/remove/reorder pages, and reposition or resize individual blocks (move_block / scale_block) when asked to rearrange items like "move the QR to the left" or "shift the headline up". Spatial proposals (move_block / scale_block) are NOT applied immediately — they appear as an amber-highlighted PREVIEW on the page, and the user clicks Apply or Cancel in the chat. Call one move/scale at a time and wait for the user's decision before issuing more spatial changes on the same block. Briefly tell the user what you proposed and that they can Apply or Cancel.
- Reference pages by their id from the snapshot below. Do not invent ids.
- Keep edits surgical. Make one tool call per logical change; you can chain calls.
- Write copy in the magazine's voice: precise, quiet, sensory, no exclamation marks, no marketing fluff.
- After tool calls, briefly tell the user what changed and why.

SPATIAL REASONING — translate natural phrases into move_block / scale_block calls:
- Page canvas is 3200px wide × 4267px tall. Origin (0,0) is top-left. dx is horizontal (+right / -left), dy is vertical (+down / -up). Offsets snap to 40px.
- Default block positions (approximate, intrinsic px):
  • COVER — masthead-bar: top ~120; masthead-title: top ~200, centered; hero image: fills page; title-block (headline+dek): bottom-left ~2600,160; credit: bottom-left ~3900,160; qr: bottom-right ~3900,2700; bottom-rule: ~3850.
  • ARTICLE — section: top ~240,160; headline: ~300,160; dek: ~varies; byline: ~under dek; body: middle; pull-quote: mid column; image: ~900,160 (1300–3000 wide); caption: ~2120,160; article-footer: bottom.
  • PHOTO — image: full-bleed or framed; photo-header: top ~120,160 (or right column when split); copy: under header; caption: bottom; page-number: bottom corner.
  • CONTENTS — section: ~240,160; title: ~340; intro: middle; entries: list; contents-footer: bottom.
  • AD — image: full; eyebrow/copy: overlaid; ad-footer: bottom.
  • BACK — masthead: top; quote: center; back-footer: bottom.
- Phrase → action mapping (infer target block + dx/dy yourself):
  • "move the QR to the left" → move_block qr with dx ≈ -2400 (cover qr default is far right), dy 0.
  • "put the QR under the logo / masthead" → move_block qr with dx ≈ -1200 (center), dy ≈ -3500 (just below masthead bar near top).
  • "center the headline" → move_block headline with dx chosen so the block sits around x=1600 from its default left (~160), i.e. dx ≈ +600–800 depending on block width; or dy 0 if already vertically OK.
  • "shift the headline up / down" → move_block headline with dy ≈ ±200–400.
  • "make the headline bigger / smaller" → scale_block headline scale 1.3 / 0.8.
  • "reset the QR position" → move_block qr dx 0 dy 0 reset=true.
  • "move the byline below the body" → move_block byline with dy large positive (~+2000).
- If the user references something ambiguously ("the logo", "the title"), pick the most likely block from the current page's pageType and explain your choice in the reply. If the page has no such block, say so instead of guessing.
- Prefer one move_block per block. Combine with scale_block when the user asks to resize at the same time.

When the user has uploaded reference files:
- The issue-level "template" file shows the OVERALL look the user is matching. Use it to inform layout choices (page sequence, article layout presets, fonts, palette).
- A per-page "reference" file is attached to a specific page. When the user asks you to work on that page, treat the reference as the visual or textual source of truth.
- PDFs and images are attached directly so you can see them. Word documents are converted to text and included below.

MIRRORING AN ISSUE TEMPLATE (when the user says "mirror this template", "match the layout of the attached PDF", "rebuild the sequence to match", etc.):
- Treat the issue-level [ISSUE TEMPLATE] attachment as ground truth for page order, page types, and per-spread structure. Walk it spread by spread (pages 1–2, 3–4, …) and decide a pageType for each: cover, contents, article, photo, ad, back.
  • Heuristics: large single image filling the page with little body copy → photo. Brand/product page with logo, call-to-action, minimal editorial → ad. Numbered list of stories with page numbers → contents. Headline + dek + columns of body + byline → article. First page → cover, last page → back.
- Plan first, then execute in one aggressive pass — do NOT ask the user to confirm each spread:
  1. Briefly summarise the plan in one short paragraph (e.g. "120 pages: cover, ad, contents, then 14 article/photo spreads interleaved with 6 full-page ads, back").
  2. Issue reorder_pages first if the existing middle pages can be rearranged to fit.
  3. Use add_spread for facing pairs (article+article, photo+article, ad+article) and add_page for singletons. Insert in template order.
  4. For each new article page, call set_article_layout with the preset that best matches the template spread (single-column for long-form, two-column or image-led for visual essays, etc.).
  5. Use remove_page for leftover pages that don't fit the template. Never remove cover, back, or contents.
  6. Do NOT call move_block / scale_block during a mirror pass — those are preview-only and would stall the rebuild. Fine-tune positions afterwards if the user asks.
- Keep cover and back pages; only rebuild the middle. Don't invent copy unless the user asks — leave placeholder text in new pages and tell the user which pages still need content.
- After the pass, post a short recap: total pages now, count by type, and any spreads you skipped or approximated.`;


  const refLines: string[] = [];
  for (const a of attachments) {
    const tag = a.kind === "template"
      ? "[ISSUE TEMPLATE]"
      : `[PAGE REFERENCE · page_id=${a.page_id ?? "?"}]`;
    refLines.push(`${tag} ${a.file_name} (${a.mime_type})`);
    if (a.extracted_text) {
      const snippet = a.extracted_text.slice(0, 4000);
      refLines.push(`Text content:\n${snippet}${a.extracted_text.length > 4000 ? "\n…(truncated)" : ""}`);
    }
  }

  const parts = [base];
  if (selectedPageId) {
    parts.push(`Currently selected page in the editor: ${selectedPageId}`);
  }
  if (refLines.length) {
    parts.push(`References:\n${refLines.join("\n\n")}`);
  }
  if (snapshot) {
    parts.push(`Current issue snapshot (JSON):\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``);
  }
  return parts.join("\n\n");
}

/** Attach visual references (PDF/image) as file parts on the latest user message. */
/** Max bytes the Lovable AI Gateway can inline per file. PDFs larger than
 *  this are dropped before the request goes out and replaced with a short
 *  text note so the model can still reason about them by name. */
const MAX_INLINE_PDF_BYTES = 15 * 1024 * 1024;

async function pdfTooLarge(url: string): Promise<{ tooLarge: boolean; bytes: number | null }> {
  try {
    const head = await fetch(url, { method: "HEAD" });
    const len = head.headers.get("content-length");
    if (!len) return { tooLarge: false, bytes: null };
    const bytes = Number(len);
    if (!Number.isFinite(bytes)) return { tooLarge: false, bytes: null };
    return { tooLarge: bytes > MAX_INLINE_PDF_BYTES, bytes };
  } catch {
    return { tooLarge: false, bytes: null };
  }
}

async function attachVisualRefsToLastUserMessage(
  messages: UIMessage[],
  attachments: ChatAttachment[],
  selectedPageId: string | undefined,
): Promise<UIMessage[]> {
  if (!messages.length) return messages;
  const lastIdx = messages.length - 1;
  const last = messages[lastIdx];
  if (last.role !== "user") return messages;

  const visual = attachments.filter(
    (a) =>
      a.signed_url &&
      (a.mime_type === "application/pdf" || a.mime_type.startsWith("image/")) &&
      (a.kind === "template" || a.page_id === selectedPageId),
  );
  if (!visual.length) return messages;

  // Pre-flight each PDF; downscale step = skip oversized PDFs and substitute
  // a text note so the assistant can still discuss them.
  const fileParts: Array<{ type: "file"; mediaType: string; url: string; filename: string } | { type: "text"; text: string }> = [];
  for (const a of visual) {
    if (a.mime_type === "application/pdf") {
      const { tooLarge, bytes } = await pdfTooLarge(a.signed_url!);
      if (tooLarge) {
        const mb = bytes ? (bytes / (1024 * 1024)).toFixed(1) : "?";
        fileParts.push({
          type: "text",
          text: `[Attachment "${a.file_name}" (${mb} MB PDF) was skipped — too large for inline vision. Export a lower-resolution PDF (e.g. 144 DPI) or split into individual pages so I can read it.]`,
        });
        continue;
      }
    }
    fileParts.push({
      type: "file",
      mediaType: a.mime_type,
      url: a.signed_url!,
      filename: a.file_name,
    });
  }

  const next: UIMessage = {
    ...last,
    parts: [...last.parts, ...(fileParts as UIMessage["parts"])],
  };
  const out = messages.slice();
  out[lastIdx] = next;
  return out;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (auth instanceof Response) return auth;

        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        // gemini-2.5-flash supports vision (PDFs and images).
        const model = gateway("google/gemini-2.5-flash");

        const attachments = body.attachments ?? [];
        const messagesWithRefs = await attachVisualRefsToLastUserMessage(
          body.messages,
          attachments,
          body.selectedPageId,
        );

        const tools = {
          update_page_field: tool({
            description:
              "Set a single text field on a page (headline, dek, body, byline, caption, etc.). Always use the page id from the snapshot.",
            inputSchema: updatePageFieldSchema,
            execute: async (args) => ({ kind: "update_page_field", ...args }),
          }),
          set_article_layout: tool({
            description: "Change the layout preset of an article page.",
            inputSchema: setArticleLayoutSchema,
            execute: async (args) => ({ kind: "set_article_layout", ...args }),
          }),
          update_master: tool({
            description:
              "Update issue-wide master settings: publication name, folio template, page-number style, folio visibility toggles.",
            inputSchema: updateMasterSchema,
            execute: async (args) => ({ kind: "update_master", patch: args }),
          }),
          set_fonts: tool({
            description:
              "Set one or more of the publication's display/serif/sans fonts. Pass the font label exactly as shown in the snapshot.",
            inputSchema: setFontsSchema,
            execute: async (args) => ({ kind: "set_fonts", ...args }),
          }),
          add_page: tool({
            description: "Insert a single new page before the back cover.",
            inputSchema: addPageSchema,
            execute: async (args) => ({ kind: "add_page", ...args }),
          }),
          add_spread: tool({
            description: "Insert two facing pages (a spread) before the back cover.",
            inputSchema: addSpreadSchema,
            execute: async (args) => ({ kind: "add_spread", ...args }),
          }),
          remove_page: tool({
            description: "Remove a page (or its spread pair) by id. Cover, back, and contents cannot be removed.",
            inputSchema: removePageSchema,
            execute: async (args) => ({ kind: "remove_page", ...args }),
          }),
          reorder_pages: tool({
            description: "Reorder the middle pages. Provide the full list of page ids in desired order.",
            inputSchema: reorderPagesSchema,
            execute: async (args) => ({ kind: "reorder_pages", ...args }),
          }),
          move_block: tool({
            description:
              "Reposition a single block (text, image, QR, etc.) on a page by offsetting it from its default position. Use this when the user asks to move things like 'put the QR on the left' or 'shift the headline up'. Offsets are in intrinsic pixels (page is 3200x4267); typical nudges are 200–1200px. Snaps to 40px grid.",
            inputSchema: moveBlockSchema,
            execute: async (args) => ({ kind: "move_block", ...args }),
          }),
          scale_block: tool({
            description:
              "Resize the contents of a block (make text bigger/smaller, scale an image block). 1 = default; 0.5 = half size; 2 = double.",
            inputSchema: scaleBlockSchema,
            execute: async (args) => ({ kind: "scale_block", ...args }),
          }),
        };

        const result = streamText({
          model,
          system: buildSystem(body.issueSnapshot, attachments, body.selectedPageId),
          messages: await convertToModelMessages(messagesWithRefs),
          tools,
          stopWhen: stepCountIs(50),
          onError: (err) => console.error("[chat]", err),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
        });
      },
    },
  },
});
