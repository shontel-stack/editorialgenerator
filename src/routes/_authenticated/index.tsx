import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Editor landing decision point. Signed-in users with at least one
 * publication drop straight into the editor (lazy component in
 * `index.lazy.tsx`). First-run users with zero publications are sent to
 * the onboarding wizard instead of being confronted with a raw editor
 * against nothing.
 *
 * Runs client-side only — the `_authenticated` layout opts out of SSR
 * because the Supabase session lives in localStorage.
 */
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: async () => {
    // Defensive: if there's no user yet the AuthGate in the layout will
    // render the sign-in screen. Don't try to redirect from here.
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    try {
      const { count, error } = await supabase
        .from("publications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userData.user.id);
      if (error) return; // fail open — better to show the editor than to loop
      if (!count) {
        throw redirect({ to: "/onboarding" });
      }
    } catch (err) {
      // Re-throw router redirects; swallow only real query failures.
      if (err instanceof Error && err.name === "Error" && !("to" in err)) return;
      throw err;
    }
  },
  head: () => ({
    meta: [
      { title: "Pageluxe Issue Builder" },
      {
        name: "description",
        content:
          "Build the whole monthly issue with Pageluxe: cover, contents, articles, ads, photo essays. Export print-ready PDFs for InDesign, Canva, and Fresco.",
      },
      { property: "og:title", content: "Pageluxe Issue Builder" },
      {
        property: "og:description",
        content:
          "Assemble articles, ads, photo essays and cover into a single interactive publication PDF — round-trips with Canva and InDesign.",
      },
    ],
  }),
});
