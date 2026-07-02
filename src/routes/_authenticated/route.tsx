import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AuthPageContent } from "@/components/AuthPageContent";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  // Session lives in client-only localStorage, so SSR always renders the
  // "denied" branch and produces a hydration flash of the sign-in form
  // (or a blank tree if a downstream client-only component throws during
  // the mismatch). Opting out of SSR lets the client run the AuthGate
  // useState initializer against localStorage on first render.
  ssr: false,
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

function describeOauthParams(): { hasCode: boolean; hasAccessToken: boolean; hasRefreshToken: boolean; hasError: boolean; raw: string } {
  if (typeof window === "undefined") {
    return { hasCode: false, hasAccessToken: false, hasRefreshToken: false, hasError: false, raw: "" };
  }
  const url = window.location.href;
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  const combined = `${search}${hash}`;
  return {
    hasCode: /[?#&]code=/.test(url),
    hasAccessToken: /[?#&]access_token=/.test(url),
    hasRefreshToken: /[?#&]refresh_token=/.test(url),
    hasError: /[?#&]error(_description)?=/.test(url),
    raw: combined.slice(0, 200),
  };
}

export function AuthGate() {
  const initialLocal = typeof window !== "undefined" ? hasLocalSupabaseSession() : false;
  if (typeof window !== "undefined") {
    // Mount-time snapshot to correlate blank-screen reports with what the
    // gate observed synchronously.
    console.info("[AuthGate] mount", {
      hasLocalSession: initialLocal,
      href: window.location.href,
      oauthParams: describeOauthParams(),
      userAgent: window.navigator.userAgent,
    });
  }

  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "timeout">(
    () => (initialLocal ? "allowed" : "denied"),
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    console.info("[AuthGate] initial status", { status, attempt });
    // We intentionally log the seed value only; subsequent transitions log below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t0 = performance.now();
    console.info("[AuthGate] effect start", { attempt, oauthParams: describeOauthParams() });

    const transition = (next: "checking" | "allowed" | "denied" | "timeout", reason: string, extra?: Record<string, unknown>) => {
      setStatus((prev) => {
        if (prev === next) {
          console.debug("[AuthGate] transition skipped (same status)", { status: prev, reason, ...extra });
          return prev;
        }
        console.info("[AuthGate] transition", { from: prev, to: next, reason, elapsedMs: Math.round(performance.now() - t0), ...extra });
        return next;
      });
    };

    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      console.warn("[AuthGate] supabase.auth.getUser() timed out after 5s; offering retry.");
      setStatus((prev) => {
        if (prev === "checking") {
          console.info("[AuthGate] transition", { from: prev, to: "timeout", reason: "getUser-timeout" });
          return "timeout";
        }
        return prev;
      });
    }, 5000);

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      console.info("[AuthGate] onAuthStateChange", {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id ?? null,
      });
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        window.clearTimeout(timeout);
        transition("allowed", `authStateChange:${event}`);
      } else if (event === "SIGNED_OUT") {
        transition("denied", "authStateChange:SIGNED_OUT");
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        console.info("[AuthGate] getSession resolved", {
          hasSession: !!data.session,
          hasUser: !!data.session?.user,
          userId: data.session?.user?.id ?? null,
          expiresAt: data.session?.expires_at ?? null,
          elapsedMs: Math.round(performance.now() - t0),
        });
        if (data.session?.user) {
          window.clearTimeout(timeout);
          transition("allowed", "getSession:user-present");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[AuthGate] getSession failed; continuing to sign-in.", error);
      });

    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        console.info("[AuthGate] getUser resolved", {
          hasUser: !!data.user,
          userId: data.user?.id ?? null,
          error: error ? { name: error.name, message: error.message, status: (error as unknown as { status?: number }).status } : null,
          elapsedMs: Math.round(performance.now() - t0),
        });
        if (data.user) {
          transition("allowed", "getUser:user-present");
          return;
        }
        const oauth = describeOauthParams();
        const oauthInFlight = oauth.hasCode || oauth.hasAccessToken || oauth.hasRefreshToken;
        if (oauthInFlight) {
          console.info("[AuthGate] OAuth callback params detected; waiting for session.", oauth);
          return;
        }
        setStatus((prev) => {
          if (prev === "allowed") {
            console.info("[AuthGate] getUser returned no user but keeping 'allowed' (localStorage session).");
            return prev;
          }
          console.info("[AuthGate] transition", { from: prev, to: "denied", reason: "getUser:no-user" });
          return "denied";
        });
        if (error) {
          console.warn("[AuthGate] getUser returned no user.", error);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        console.warn("[AuthGate] getUser failed; keeping prior status.", error);
        setStatus((prev) => (prev === "allowed" ? prev : "denied"));
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      authSub.subscription.unsubscribe();
      console.debug("[AuthGate] effect cleanup", { attempt });
    };
  }, [attempt]);

  const retry = useCallback(() => {
    console.info("[AuthGate] retry requested by user");
    setStatus("checking");
    setAttempt((n) => n + 1);
  }, []);

  console.debug("[AuthGate] render", { status });

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
        onAuthenticated={() => {
          console.info("[AuthGate] AuthPageContent reported authenticated");
          setStatus("allowed");
        }}
        timedOut={status === "timeout"}
        onRetry={retry}
      />
    );
  }

  return <Outlet />;
}

