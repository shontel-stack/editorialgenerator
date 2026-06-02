import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  addPageSchema,
  addSpreadSchema,
  removePageSchema,
  reorderPagesSchema,
  setArticleLayoutSchema,
  setFontsSchema,
  updateMasterSchema,
  updatePageFieldSchema,
} from "@/lib/chat-tools";
import type { IssueSnapshot } from "@/lib/issue-snapshot";

type ChatBody = {
  messages?: UIMessage[];
  issueSnapshot?: IssueSnapshot;
};

function buildSystem(snapshot: IssueSnapshot | undefined): string {
  const base = `You are the in-app editorial assistant for "The Arts Today" — a luxe, slow, contemporary art & culture magazine built in a custom layout tool.

Your job:
- Critique drafts, suggest pacing across spreads, propose headlines/deks/pull quotes, tighten copy.
- When the user gives you raw layout / article information, integrate it into the publication by CALLING TOOLS to update page fields, change article layouts, adjust master pages, set fonts, add/remove/reorder pages.
- Reference pages by their id from the snapshot below. Do not invent ids.
- Keep edits surgical. Make one tool call per logical change; you can chain calls.
- Write copy in the magazine's voice: precise, quiet, sensory, no exclamation marks, no marketing fluff.
- After tool calls, briefly tell the user what changed and why.`;

  if (!snapshot) return base;
  return `${base}

Current issue snapshot (JSON):
\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\``;
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
        const model = gateway("google/gemini-3-flash-preview");

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
        };

        const result = streamText({
          model,
          system: buildSystem(body.issueSnapshot),
          messages: await convertToModelMessages(body.messages),
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
