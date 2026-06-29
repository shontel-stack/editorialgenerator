import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SignupRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  provider: string | null;
};

export const listSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignupRow[]> => {
    const { data: adminRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!adminRow) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows: SignupRow[] = [];
    let page = 1;
    const perPage = 200;
    // Cap at a few pages defensively.
    for (let i = 0; i < 25; i++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        rows.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          confirmed_at: (u as { confirmed_at?: string | null }).confirmed_at ?? null,
          provider: u.app_metadata?.provider ?? null,
        });
      }
      if (data.users.length < perPage) break;
      page += 1;
    }

    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return rows;
  });
