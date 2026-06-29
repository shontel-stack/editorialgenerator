import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

/**
 * Read-only "propose a layout" mode.
 *
 * Given a user instruction, the current page list, and the items in the
 * publication library, the AI returns a structured plan of operations the
 * user can review and Apply. Nothing is mutated server-side — the client
 * applies the plan against IssueDoc state through existing setters.
 */

const PageInput = z.object({
  id: z.string(),
  index: z.number().int().min(0),
  pageType: z.string(),
  title: z.string().default(""),
});

const LibraryItemInput = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  kind: z.string(),
  summary: z.string().default(""),
});

const Input = z.object({
  instruction: z.string().min(3).max(4000),
  publication: z.string().default(""),
  pages: z.array(PageInput).min(1).max(200),
  library: z.array(LibraryItemInput).max(200),
});

const OpSchema = z.object({
  kind: z.enum(["add_image_block", "add_text_block", "set_field"]),
  pageId: z.string().describe("Target page id from the page list."),
  attachmentId: z
    .string()
    .optional()
    .describe("Library item id (required for add_image_block)."),
  text: z.string().optional().describe("Text content for add_text_block."),
  field: z
    .string()
    .optional()
    .describe(
      "Field name for set_field (article: headline|dek|byline|body|section|pullQuote|imageCaption; cover: headline|dek|feature|credit; ad: eyebrow|brand|headline|body|cta).",
    ),
  value: z.string().optional().describe("Field value for set_field."),
  x: z
    .number()
    .optional()
    .describe("Page-space x (0..3200) for add_image_block / add_text_block."),
  y: z
    .number()
    .optional()
    .describe("Page-space y (0..4267) for add_image_block / add_text_block."),
  w: z.number().optional().describe("Block width in page-px."),
  h: z.number().optional().describe("Block height in page-px."),
  fontFamily: z.enum(["display", "serif", "sans"]).optional(),
  fontSize: z.number().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  rationale: z
    .string()
    .optional()
    .describe("One short sentence the user will see in the plan preview."),
});

const Schema = z.object({
  summary: z
    .string()
    .min(10)
    .max(600)
    .describe("Two or three sentences describing the overall plan."),
  operations: z.array(OpSchema).min(1).max(40),
});

export type LayoutPlanOp = z.infer<typeof OpSchema>;
export type LayoutPlan = z.infer<typeof Schema>;

export const proposeLibraryLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<LayoutPlan> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are the layout director for "${data.publication || "this publication"}".
You are given:
  - the user's editorial instruction
  - the current page list (id, index, pageType, working title)
  - items in the publication's library (uploaded images, PDFs, IDML packages, Word docs)

Return a STRUCTURED PLAN as operations. Do not mutate anything — the user reviews and applies.

Rules:
- Only reference pageId values that appear in the page list. Only reference attachmentId values that appear in the library.
- Page canvas is 3200 wide × 4267 tall. Keep blocks inside the page.
- Prefer set_page_background (mode "replace") for full-bleed cover/ad art when an image or PDF matches the user's instruction.
- Use add_image_block for placed photos — pick reasonable rectangles (typical hero: x≈160 y≈900 w≈2880 h≈1800; quarter image: w≈1400 h≈1000).
- Use add_text_block for free-floating copy that doesn't fit the template's built-in slots.
- Use set_field for article/cover/ad copy that should go into the template's existing fields (headline, dek, body, byline, etc.). Body fields use \\n\\n between paragraphs.
- Give each operation a one-sentence rationale.
- If the instruction is ambiguous or the library doesn't have what's needed, return a smaller plan and explain in summary. Never invent ids.`;

    const prompt = `User instruction:
"""${data.instruction}"""

Pages (id · index · type · title):
${data.pages.map((p) => `- ${p.id} · ${p.index} · ${p.pageType} · ${p.title}`).join("\n") || "(none)"}

Library items (id · kind · mime · file · summary):
${
  data.library
    .map(
      (a) =>
        `- ${a.id} · ${a.kind} · ${a.mimeType} · ${a.fileName}${
          a.summary ? ` · ${a.summary.slice(0, 140).replace(/\s+/g, " ")}` : ""
        }`,
    )
    .join("\n") || "(library is empty)"
}

Return the plan now.`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
      experimental_output: Output.object({ schema: Schema }),
    });

    // Filter ops to known ids so the client doesn't have to revalidate.
    const pageIds = new Set(data.pages.map((p) => p.id));
    const libIds = new Set(data.library.map((l) => l.id));
    const ops = experimental_output.operations.filter((op) => {
      if (!pageIds.has(op.pageId)) return false;
      if (
        op.kind === "add_image_block" &&
        (!op.attachmentId || !libIds.has(op.attachmentId))
      )
        return false;
      return true;
    });

    return { summary: experimental_output.summary, operations: ops };
  });
