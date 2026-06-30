import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        void navigate({ to: "/auth", replace: true });
        return;
      }
      setAllowed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!allowed) {
    return (
      <main
        className="min-h-screen flex items-center justify-center bg-background px-4 text-sm text-muted-foreground"
        aria-busy="true"
      >
        Loading…
      </main>
    );
  }

  return <Outlet />;
}
