import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminRow = {
  user_id: string;
  email: string | null;
  created_at: string;
};

async function assertAdmin(ctx: { supabase: { rpc: (n: string, p: unknown) => Promise<{ data: unknown; error: { message: string } | null }> }; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at, role")
      .eq("role", "admin")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows: AdminRow[] = [];
    for (const r of roles ?? []) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      rows.push({
        user_id: r.user_id,
        email: userData?.user?.email ?? null,
        created_at: r.created_at as string,
      });
    }
    return rows;
  });

export const addAdminByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => {
    const email = input?.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address");
    }
    return { email };
  })
  .handler(async ({ data, context }): Promise<AdminRow> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Locate user by paginating listUsers (no direct email lookup on admin API).
    let foundId: string | null = null;
    let foundCreated: string | null = null;
    let page = 1;
    const perPage = 200;
    for (let i = 0; i < 25; i++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      const match = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
      if (match) {
        foundId = match.id;
        foundCreated = match.created_at;
        break;
      }
      if (list.users.length < perPage) break;
      page += 1;
    }
    if (!foundId) throw new Error(`No user found with email ${data.email}. They must sign up first.`);

    const { error: insertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: foundId, role: "admin" });
    // Ignore duplicate (already admin).
    if (insertErr && !/duplicate|unique/i.test(insertErr.message)) {
      throw new Error(insertErr.message);
    }

    return {
      user_id: foundId,
      email: data.email,
      created_at: foundCreated ?? new Date().toISOString(),
    };
  });

export const removeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId required");
    return { userId: input.userId };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("You can't remove your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
