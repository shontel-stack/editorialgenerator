import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AuthPageContent } from "@/components/AuthPageContent";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGate,
});

export function hasLocalSupabaseSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
      const expiresAt =
        parsed?.expires_at ?? parsed?.currentSession?.expires_at;
      if (!token) continue;
      if (typeof expiresAt === "number" && expiresAt * 1000 < Date.now()) continue;
      return true;
    }
  } catch {
    // ignore malformed entries
  }
  return false;
}

export function AuthGate() {
  // Seed synchronously from localStorage so a signed-in user doesn't flash
  // the sign-in form while getSession()/getUser() are still resolving.
  // No local session → render sign-in immediately (getUser can still upgrade
  // to "allowed" if it turns out a session exists). Prevents a stuck
  // "Checking your session…" screen when getSession/getUser hang.
  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "timeout">(
    () => (hasLocalSupabaseSession() ? "allowed" : "denied"),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      console.warn("[AuthGate] supabase.auth.getUser() timed out after 5s; offering retry.");
      setStatus((prev) => (prev === "checking" ? "timeout" : prev));
    }, 5000);

    // Fast local-storage path so a hung network call can't block render.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session?.user) {
          window.clearTimeout(timeout);
          setStatus("allowed");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[AuthGate] supabase.auth.getSession() failed; continuing to sign-in.", error);
      });

    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        if (data.user) {
          setStatus("allowed");
          return;
        }
        // Don't downgrade an already-allowed session on a transient getUser
        // failure — getSession() succeeded from localStorage, so a network
        // hiccup or pending token refresh shouldn't kick the user out.
        setStatus((prev) => (prev === "allowed" ? prev : "denied"));
        if (error) {
          console.warn("[AuthGate] supabase.auth.getUser() returned no user.", error);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        console.warn("[AuthGate] supabase.auth.getUser() failed; keeping prior status.", error);
        setStatus((prev) => (prev === "allowed" ? prev : "denied"));
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus("checking");
    setAttempt((n) => n + 1);
  }, []);

  if (status === "checking") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      >
        Checking your session…
      </div>
    );
  }

  if (status === "denied" || status === "timeout") {
    return (
      <AuthPageContent
        onAuthenticated={() => setStatus("allowed")}
        timedOut={status === "timeout"}
        onRetry={retry}
      />
    );
  }

  return <Outlet />;
}
