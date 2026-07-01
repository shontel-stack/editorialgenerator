import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function SignOutButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Cancel in-flight queries before the 401s land, then drop cached data.
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error && !/session|missing/i.test(error.message)) {
        toast.error("Couldn't sign out cleanly. Please try again.");
        return;
      }
      // Clear any stray sb-* auth tokens so AuthGate sees no local session.
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && /^sb-.*-auth-token$/.test(key)) {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // ignore
      }
      toast.success("Signed out.");
      await navigate({ to: "/auth", replace: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={busy}
      className="gap-1.5"
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">{busy ? "Signing out…" : "Sign out"}</span>
    </Button>
  );
}
