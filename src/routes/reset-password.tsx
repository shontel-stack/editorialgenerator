import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash on load and emits
    // a PASSWORD_RECOVERY event with an active session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Couldn't update password.");
      return;
    }
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border rounded-lg p-6 bg-card">
        <h1 className="text-2xl font-semibold text-foreground">Reset password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ready
            ? "Choose a new password for your account."
            : "Open this page from the reset link in your email."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              disabled={!ready}
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
              disabled={!ready}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !ready}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => navigate({ to: "/auth", search: { next: undefined } })}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          Back to sign in
        </button>
      </div>
    </main>
  );
}
