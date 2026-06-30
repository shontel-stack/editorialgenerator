import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthPageContent } from "@/components/AuthPageContent";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

function AuthGate() {
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      console.warn("[AuthGate] supabase.auth.getUser() timed out after 5s; falling back to sign-in.");
      setStatus((prev) => (prev === "checking" ? "denied" : prev));
    }, 5000);

    // Fast local-storage path so a hung network call can't block render.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        window.clearTimeout(timeout);
        setStatus("allowed");
      }
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      window.clearTimeout(timeout);
      if (error || !data.user) {
        setStatus("denied");
        return;
      }
      setStatus("allowed");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, []);

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

  if (status === "denied") {
    return <AuthPageContent onAuthenticated={() => setStatus("allowed")} />;
  }

  return <Outlet />;
}
