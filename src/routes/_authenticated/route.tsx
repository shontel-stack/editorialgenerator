import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthPageContent } from "@/components/AuthPageContent";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        setStatus("denied");
        return;
      }
      setStatus("allowed");
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === "checking") {
    return (
      <main
        className="min-h-screen flex items-center justify-center bg-background px-4 text-sm text-muted-foreground"
        aria-busy="true"
      >
        Loading…
      </main>
    );
  }

  if (status === "denied") return <AuthPageContent />;

  return <Outlet />;
}
