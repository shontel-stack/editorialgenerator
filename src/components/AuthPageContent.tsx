import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolbarDiagnostics } from "@/components/ToolbarDiagnostics";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";


export function AuthPageContent({
  onAuthenticated,
  timedOut = false,
  onRetry,
}: {
  onAuthenticated?: () => void;
  timedOut?: boolean;
  onRetry?: () => void;
} = {}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

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


  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        onAuthenticated?.();
        navigate({ to: "/" });
      }
    });
  }, [navigate, onAuthenticated]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || rateLimited) return;

    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
        onAuthenticated?.();
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated?.();
        navigate({ to: "/" });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const lower = raw.toLowerCase();
      let message = "Something went wrong. Please try again.";
      if (mode === "signin") {
        // Avoid leaking whether the account exists or which field was wrong.
        message = "The email or password you entered is incorrect. Please try again.";
        if (lower.includes("email not confirmed") || lower.includes("confirm")) {
          message = "Please confirm your email address before signing in.";
        } else if (lower.includes("rate") || lower.includes("too many")) {
          message = "Too many attempts. Please wait a moment and try again.";
        }
      } else if (lower.includes("registered") || lower.includes("already")) {
        message = "That email can't be used to create a new account. Try signing in instead.";
      } else if (lower.includes("password")) {
        message = "Please choose a stronger password (at least 8 characters).";
      } else if (lower.includes("valid email") || lower.includes("invalid email")) {
        message = "Please enter a valid email address.";
      } else if (lower.includes("rate") || lower.includes("too many")) {
        message = "Too many attempts. Please wait a moment and try again.";
      } else {
        message = "We couldn't create your account. Please try again.";
      }
      toast.error(message);
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
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={signInGoogle} disabled={busy}>
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
