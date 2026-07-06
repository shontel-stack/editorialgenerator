import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Local typed wrapper for the Supabase auth.oauth beta namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{
    data: {
      client?: { name?: string } | null;
      redirect_url?: string | null;
      redirect_to?: string | null;
    } | null;
    error: { message: string } | null;
  }>;
  approveAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (id: string) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
};

function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 text-sm text-foreground">
      Could not load this authorization request: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauth();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md border border-border rounded-lg p-6 bg-card">
        <h1 className="text-xl font-semibold text-foreground">
          Connect {clientName} to your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This lets {clientName} use the Editorial Generator on your behalf — read your issues
          and publications, and file notes into your inbox.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <button
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(true)}
          >
            Approve
          </button>
          <button
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
