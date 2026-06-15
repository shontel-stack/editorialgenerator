import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Skip auth check during SSR — supabase has no session on the server,
    // which would force a redirect to /auth and cause a hydration mismatch
    // on the client (where the user IS signed in).
    if (typeof window === "undefined") return {};
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
