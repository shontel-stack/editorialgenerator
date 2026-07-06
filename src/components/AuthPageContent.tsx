import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolbarDiagnostics } from "@/components/ToolbarDiagnostics";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import {
  consumeRetryAfterDeadline,
  installAuthRateLimitCapture,
} from "@/lib/authRateLimit";


export function AuthPageContent({
  onAuthenticated,
  timedOut = false,
  onRetry,
  nextPath,
}: {
  onAuthenticated?: () => void;
  timedOut?: boolean;
  onRetry?: () => void;
  nextPath?: string;
} = {}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    installAuthRateLimitCapture();
  }, []);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) {
        setCooldownUntil(null);
        window.clearInterval(id);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownSeconds =
    cooldownUntil && cooldownUntil > now ? Math.ceil((cooldownUntil - now) / 1000) : 0;
  const rateLimited = cooldownSeconds > 0;


  // Only accept same-origin relative paths as redirect targets.
  const safeNext = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : null;
  const goNext = () => {
    if (safeNext) {
      window.location.href = safeNext;
    } else {
      navigate({ to: "/" });
    }
  };
  const returnUrl = safeNext
    ? `${window.location.origin}/auth?next=${encodeURIComponent(safeNext)}`
    : window.location.origin;

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        onAuthenticated?.();
        goNext();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, onAuthenticated, safeNext]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || rateLimited) return;

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: returnUrl },
        });
        if (error) throw error;
        if (data.session?.user) {
          toast.success("Account created. You're signed in.");
          onAuthenticated?.();
          goNext();
          return;
        }
        toast.success("Account created. Check your email to confirm it, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated?.();
        goNext();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const lower = raw.toLowerCase();
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status?: unknown }).status) || 0
          : 0;
      const isRateLimited =
        status === 429 ||
        lower.includes("rate") ||
        lower.includes("too many") ||
        lower.includes("after") && /\d+\s*seconds?/.test(lower);
      if (isRateLimited) {
        // Prefer the exact deadline from the server's Retry-After / rate-limit
        // headers captured during the failed request. Fall back to parsing the
        // error message, then a conservative default.
        const headerDeadline = consumeRetryAfterDeadline();
        let deadline: number;
        if (headerDeadline != null) {
          deadline = headerDeadline;
        } else {
          const match = raw.match(/(\d+)\s*seconds?/i);
          const seconds = match ? Math.max(1, parseInt(match[1], 10)) : 30;
          deadline = Date.now() + seconds * 1000;
        }
        const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
        setCooldownUntil(deadline);
        setNow(Date.now());
        toast.error(
          `Too many attempts. Please wait ${seconds} second${seconds === 1 ? "" : "s"} before trying again.`,
        );
      } else {
        let message = "Something went wrong. Please try again.";
        if (mode === "signin") {
          message = "The email or password you entered is incorrect. Please try again.";
          if (lower.includes("email not confirmed") || lower.includes("confirm")) {
            message = "Please confirm your email address before signing in.";
          }
        } else if (lower.includes("registered") || lower.includes("already")) {
          message = "That email can't be used to create a new account. Try signing in instead.";
        } else if (lower.includes("password")) {
          message = "Please choose a stronger password (at least 8 characters).";
        } else if (lower.includes("valid email") || lower.includes("invalid email")) {
          message = "Please enter a valid email address.";
        } else {
          message = "We couldn't create your account. Please try again.";
        }
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
      } else if (!result.redirected) {
        onAuthenticated?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border rounded-lg p-6 bg-card">
        <h1 className="text-2xl font-semibold text-foreground">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Access the editorial generator.
        </p>

        {timedOut && (
          <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <p>Couldn't reach the auth service. You can sign in below, or retry the check.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 inline-flex items-center justify-center rounded border border-amber-500/50 px-2 py-1 font-medium hover:bg-amber-500/20"
              >
                Retry auth check
              </button>
            )}
          </div>
        )}

        {rateLimited && (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
          >
            <p className="font-medium">Sign-in temporarily paused</p>
            <p className="mt-1">
              For your security, please wait{" "}
              <span className="tabular-nums font-semibold">
                {cooldownSeconds} second{cooldownSeconds === 1 ? "" : "s"}
              </span>{" "}
              before trying again.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || rateLimited}>
            {rateLimited
              ? `Try again in ${cooldownSeconds}s`
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </Button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            className="mt-3 text-xs text-muted-foreground hover:text-foreground w-full text-center underline-offset-2 hover:underline"
            onClick={async () => {
              if (!email) {
                toast.error("Enter your email above, then click Forgot password.");
                return;
              }
              setBusy(true);
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
              });
              setBusy(false);
              if (error) {
                toast.error("Couldn't send reset email. Please try again.");
              } else {
                toast.success("Password reset email sent. Check your inbox.");
              }
            }}
            disabled={busy}
          >
            Forgot password?
          </button>
        )}

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={signInGoogle} disabled={busy || rateLimited}>
          Continue with Google
        </Button>

        <button
          type="button"
          className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
      <ToolbarDiagnostics />
    </main>
  );
}
