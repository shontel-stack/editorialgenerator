import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_staff_note",
  title: "Create staff note",
  description:
    "File an actionable note into the signed-in user's inbox for a given issue (comment, edit suggestion, status change, or flag).",
  inputSchema: {
    issue_id: z.string().min(1),
    type: z.enum(["comment", "edit_suggestion", "status_change", "flag"]),
    title: z.string().min(3).max(120),
    body: z.string().max(2000).optional(),
    page_id: z.string().optional(),
    severity: z.enum(["low", "med", "high"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("staff_notes")
      .insert({
        user_id: ctx.getUserId(),
        issue_id: input.issue_id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        page_id: input.page_id ?? null,
        role: "assistant",
        payload: { severity: input.severity ?? null, source: "mcp" },
      })
      .select()
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Note created: ${data.id}` }],
      structuredContent: { note: data },
    };
  },
});
