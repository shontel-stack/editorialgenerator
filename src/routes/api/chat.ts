import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
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
- When the user gives you raw layout / article information, integrate it into the publication by CALLING TOOLS to update page fields, change article layouts, adjust master pages, set fonts, add/remove/reorder pages.
- Reference pages by their id from the snapshot below. Do not invent ids.
- Keep edits surgical. Make one tool call per logical change; you can chain calls.
- Write copy in the magazine's voice: precise, quiet, sensory, no exclamation marks, no marketing fluff.
- After tool calls, briefly tell the user what changed and why.

When the user has uploaded reference files:
- The issue-level "template" file shows the OVERALL look the user is matching. Use it to inform layout choices (page sequence, article layout presets, fonts, palette).
- A per-page "reference" file is attached to a specific page. When the user asks you to work on that page, treat the reference as the visual or textual source of truth.
- PDFs and images are attached directly so you can see them. Word documents are converted to text and included below.`;

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
function attachVisualRefsToLastUserMessage(
  messages: UIMessage[],
  attachments: ChatAttachment[],
  selectedPageId: string | undefined,
): UIMessage[] {
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

  const fileParts = visual.map((a) => ({
    type: "file" as const,
    mediaType: a.mime_type,
    url: a.signed_url!,
    filename: a.file_name,
  }));

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
        const messagesWithRefs = attachVisualRefsToLastUserMessage(
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
