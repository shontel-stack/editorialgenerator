import { createFileRoute } from "@tanstack/react-router";

/**
 * Streaming image generation endpoint. Passes the upstream Lovable AI Gateway
 * SSE body straight through so the client sees real-time partial frames.
 *
 * Uses `google/gemini-3.1-flash-image` (Nano Banana 2) — fast, high quality,
 * emits partial frames natively.
 */
export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt } = (await request.json()) as { prompt?: string };
        if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
          return new Response("Prompt is required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Upstream error", { status: upstream.status || 502 });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      },
    },
  },
});
