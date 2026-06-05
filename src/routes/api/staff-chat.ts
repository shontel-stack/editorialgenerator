import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
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

        const result = streamText({
          model,
          system: systemParts.join("\n\n"),
          messages: await convertToModelMessages(body.messages),
          onError: (err) => console.error("[staff-chat]", role.id, err),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
        });
      },
    },
  },
});
