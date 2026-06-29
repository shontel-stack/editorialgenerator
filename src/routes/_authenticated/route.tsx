import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  // Always start in "checking" state so the SSR HTML and the very first
  // client render are byte-for-byte identical. The auth decision happens
  // in a client-only effect, after hydration, which avoids React #418.
  const [status, setStatus] = useState<"checking" | "authed">("checking");

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      setStatus("authed");
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === "checking") {
    return (
      <div
        aria-busy="true"
        className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground"
      >
        Loading…
      </div>
    );
  }

  return <Outlet />;
}
