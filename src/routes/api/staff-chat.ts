import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { getRole } from "@/lib/staffRoles";
import type { IssueSnapshot } from "@/lib/issue-snapshot";

type StaffChatBody = {
  role?: string;
  issueId?: string;
  messages?: UIMessage[];
  issueSnapshot?: IssueSnapshot;
  selectedPageId?: string;
};

const createNoteSchema = z.object({
  type: z
    .enum(["comment", "edit_suggestion", "status_change", "flag"])
    .describe(
      "comment = general note; edit_suggestion = proposed copy/layout change; status_change = production state update; flag = blocker or factual concern.",
    ),
  title: z.string().min(3).max(120).describe("Short headline for the inbox row."),
  body: z.string().max(2000).optional().describe("Longer detail, rationale, or proposed text."),
  page_id: z.string().optional().describe("Page id from the snapshot this note targets, if any."),
  severity: z.enum(["low", "med", "high"]).optional(),
});

export const Route = createFileRoute("/api/staff-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: StaffChatBody;
        try {
          body = (await request.json()) as StaffChatBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!body.role || typeof body.role !== "string") {
          return new Response("Missing role", { status: 400 });
        }
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const role = getRole(body.role);
        if (!role) return new Response("Unknown role", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway(role.model);

        const systemParts: string[] = [
          role.prompt,
          `You are speaking with the user about issue: ${body.issueId ?? "(unknown)"}.`,
          `INBOX: When you have an actionable item the user should be able to track and resolve later (a specific edit suggestion, a fact to verify, a production status change, a blocker, or any concrete to-do), call the create_note tool in addition to your reply. Keep the note title under ~12 words. Use page_id from the snapshot. Do not create notes for chit-chat or for the user's own questions.`,
        ];
        if (body.selectedPageId) {
          systemParts.push(`Currently selected page in the editor: ${body.selectedPageId}`);
        }
        if (body.issueSnapshot) {
          systemParts.push(
            `Current issue snapshot (JSON, source of truth — do not invent page ids):\n\`\`\`json\n${JSON.stringify(
              body.issueSnapshot,
              null,
              2,
            )}\n\`\`\``,
          );
        }

        const tools = {
          create_note: tool({
            description:
              "File an actionable note into the shared inbox. Use for edit suggestions, fact-check flags, status changes, and production blockers.",
            inputSchema: createNoteSchema,
            execute: async (args) => ({ kind: "note", ...args }),
          }),
        };

        const result = streamText({
          model,
          system: systemParts.join("\n\n"),
          messages: await convertToModelMessages(body.messages),
          tools,
          stopWhen: stepCountIs(50),
          onError: (err) => console.error("[staff-chat]", role.id, err),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
        });
      },
    },
  },
});
