import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireAuthFromRequest } from "@/lib/require-auth.server";
import { getRole, buildHouseVoice, type PublicationVoice } from "@/lib/staffRoles";
import type { IssueSnapshot } from "@/lib/issue-snapshot";

type AttachmentBrief = {
  id: string;
  file_name: string;
  mime_type: string;
  kind: "template" | "reference";
  page_id: string | null;
  region: string | null;
  position_x: number | null;
  position_y: number | null;
};

type StaffChatBody = {
  role?: string;
  issueId?: string;
  messages?: UIMessage[];
  issueSnapshot?: IssueSnapshot;
  selectedPageId?: string;
  attachments?: AttachmentBrief[];
  publicationVoice?: PublicationVoice | null;
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

const placeAttachmentSchema = z.object({
  attachment_id: z
    .string()
    .describe("The id of the attachment to place. Must come from the attachments list in context."),
  page_id: z
    .string()
    .describe("Page id from the snapshot to assign the attachment to."),
  region: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Optional region: 'header', 'footer', or 'column-N' (N starts at 1). Pass null to clear region and use free-form coordinates.",
    ),
  position_x: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .optional()
    .describe("Optional horizontal pin position 0..1 (0 = left edge, 1 = right edge)."),
  position_y: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .optional()
    .describe("Optional vertical pin position 0..1 (0 = top, 1 = bottom)."),
  rationale: z
    .string()
    .max(400)
    .optional()
    .describe("Short reason shown to the user for why you placed it here."),
});

export const Route = createFileRoute("/api/staff-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (auth instanceof Response) return auth;

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
          buildHouseVoice(body.publicationVoice),
          `You are speaking with the user about issue: ${body.issueId ?? "(unknown)"}.`,
          `INBOX: When you have an actionable item the user should be able to track and resolve later (a specific edit suggestion, a fact to verify, a production status change, a blocker, or any concrete to-do), call the create_note tool in addition to your reply. Keep the note title under ~12 words. Use page_id from the snapshot. Do not create notes for chit-chat or for the user's own questions.`,
          `PLACEMENT: When the user asks you to place, pin, move, or assign an uploaded file (image / document / pdf / text reference) to a page or region, call the place_attachment tool. Use attachment_id from the attachments list. Region must be 'header', 'footer', or 'column-N' (matching the page's layout column count). Use position_x / position_y (0..1) for a free-form pin, or omit them when using a region. Do not invent attachment ids. If the user is vague, pick the most recently uploaded matching file and explain your choice.`,
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
        if (body.attachments && body.attachments.length > 0) {
          systemParts.push(
            `Uploaded attachments available for placement (JSON — use these exact ids):\n\`\`\`json\n${JSON.stringify(
              body.attachments,
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
          place_attachment: tool({
            description:
              "Assign or pin an uploaded attachment (image, PDF, document, text reference) to a specific page, region, or free-form coordinate on the layout. The client applies the placement immediately.",
            inputSchema: placeAttachmentSchema,
            execute: async (args) => ({ kind: "placement", ...args }),
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
