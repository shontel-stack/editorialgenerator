import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const PageInput = z.object({
  id: z.string(),
  pageType: z.string(),
  title: z.string(),
});

const Input = z.object({
  publication: z.string().min(1),
  issueLabel: z.string().min(1),
  dateLabel: z.string().min(1),
  pages: z.array(PageInput).min(1).max(60),
});

const Schema = z.object({
  subject: z.string().min(3).max(120),
  preheader: z.string().min(3).max(160),
  intro: z.string().min(20).max(400),
  highlights: z
    .array(
      z.object({
        pageId: z.string(),
        title: z.string().min(2).max(120),
        blurb: z.string().min(20).max(280),
      }),
    )
    .min(3)
    .max(6),
  ctaLabel: z.string().min(2).max(40),
});

export const generateNewsletterHighlights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    // Skip non-feature pages from candidate set, but include their context.
    const candidates = data.pages.filter(
      (p) => !["cover", "back", "contents"].includes(p.pageType),
    );

    const system = `You are the Newsletter Editor for "${data.publication}".
Pick 3 to 6 of the strongest feature pages from this issue and write a short, magazine-voiced email teaser for each.
Tone: warm, editorial, intelligent — never marketing-speak.
Each blurb is 1-2 sentences (about 25-50 words).
Subject line is concrete and inviting (no clickbait, no emojis).
Preheader complements (does not repeat) the subject.
Intro paragraph (2-3 sentences) frames the issue's mood.
Only use pageId values from the provided list.`;

    const prompt = `Issue: ${data.issueLabel} — ${data.dateLabel}

Pages in this issue (id · type · working title):
${data.pages.map((p) => `- ${p.id} · ${p.pageType} · ${p.title}`).join("\n")}

Eligible feature pages (pick 3-6 from these):
${candidates.map((p) => `- ${p.id} · ${p.pageType} · ${p.title}`).join("\n")}

Write the newsletter content as a single structured object.`;

    const { experimental_output } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt,
      experimental_output: Output.object({ schema: Schema }),
    });

    return { ...experimental_output, ctaUrl: "" } as z.infer<typeof Schema> & {
      ctaUrl: string;
    };
  });
