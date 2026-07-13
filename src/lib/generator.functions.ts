import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";
import { z } from "zod";

/**
 * Creative types the generator supports. Each has its own prompt scaffolding
 * on the client and its own tuning in `craftGenerationPrompt` below.
 */
export const CREATIVE_TYPES = ["model", "ad", "product", "hero"] as const;
export type CreativeType = (typeof CREATIVE_TYPES)[number];

const BrandContextSchema = z.object({
  publication: z.string().optional(),
  tagline: z.string().optional(),
  paletteHex: z.array(z.string()).optional(),
  fontLabel: z.string().optional(),
  tone: z.string().optional(),
}).nullable().optional();

const CraftInput = z.object({
  creativeType: z.enum(CREATIVE_TYPES),
  brief: z.string().min(2).max(2000),
  aspect: z.enum(["portrait", "square", "landscape"]).optional(),
  brand: BrandContextSchema,
});

const TYPE_GUIDANCE: Record<CreativeType, string> = {
  model:
    "editorial fashion / lifestyle model photograph. Focus on styling, wardrobe, pose, lighting, setting, mood and lens feel. Avoid naming real people or copyrighted characters.",
  ad:
    "polished full-page magazine advertisement image. Consider staging, product hero, negative space for headline, brand feel. Do NOT try to render text or a headline — the design system overlays text separately.",
  product:
    "still-life product / object photograph. Consider surface, background, light direction, shadows, materials, small props. Studio-grade, tactile.",
  hero:
    "editorial feature-story hero image evoking the article's headline and mood. Cinematic, singular, magazine-cover worthy.",
};

/**
 * Turn a short user brief into a detailed image prompt tuned for the chosen
 * creative type. Optionally weaves in brand context (palette, fonts, tone).
 */
export const craftGenerationPrompt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CraftInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-2.5-flash");

    const brandBits = data.brand
      ? [
          data.brand.publication ? `Publication: ${data.brand.publication}.` : "",
          data.brand.tagline ? `Tagline: ${data.brand.tagline}.` : "",
          data.brand.paletteHex?.length
            ? `Steer the palette softly toward these brand colors: ${data.brand.paletteHex.join(", ")}.`
            : "",
          data.brand.fontLabel ? `Editorial type feel: ${data.brand.fontLabel}.` : "",
          data.brand.tone ? `Tone: ${data.brand.tone}.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";

    const aspectHint =
      data.aspect === "portrait"
        ? "Compose vertically (portrait, ~3:4)."
        : data.aspect === "landscape"
          ? "Compose horizontally (landscape, ~16:9)."
          : data.aspect === "square"
            ? "Compose as a square (1:1)."
            : "";

    const system = [
      "You write concise image-generation prompts for an image model.",
      "Return ONLY the prompt text — no preface, no quotes, no explanation, no bullet points.",
      "Keep it under 120 words. Concrete, sensory, visual. No brand names of real people or copyrighted characters.",
      "Never ask the image model to render legible text, logos, or typography — the layout system overlays real type separately.",
    ].join(" ");

    const user = [
      `Creative type: ${TYPE_GUIDANCE[data.creativeType]}`,
      `User brief: ${data.brief}`,
      aspectHint,
      brandBits,
      "Write the final prompt now.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const { text } = await generateText({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const refined = text.trim().replace(/^["'`]|["'`]$/g, "");
    return { refined };
  });

const SaveInput = z.object({
  creativeType: z.enum(CREATIVE_TYPES),
  prompt: z.string().min(1).max(4000),
  refinedPrompt: z.string().max(4000).optional(),
  storagePath: z.string().min(1).max(500),
  publicUrl: z.string().min(1).max(2000),
  brandApplied: z.boolean().optional(),
  aspect: z.string().max(20).optional(),
  publicationId: z.string().uuid().nullable().optional(),
});

/** Insert a row for a generated asset the client already uploaded to storage. */
export const saveGeneratedAssetRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("generated_assets")
      .insert({
        user_id: context.userId,
        creative_type: data.creativeType,
        prompt: data.prompt,
        refined_prompt: data.refinedPrompt ?? null,
        storage_path: data.storagePath,
        public_url: data.publicUrl,
        brand_applied: data.brandApplied ?? false,
        aspect: data.aspect ?? null,
        publication_id: data.publicationId ?? null,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** List the current user's saved generated assets, newest first. */
export const listGeneratedAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("generated_assets")
      .select("id, creative_type, prompt, refined_prompt, storage_path, public_url, brand_applied, aspect, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteGeneratedAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("generated_assets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
