import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const roleEnum = z.enum(["user", "doctor", "pharmacist", "admin"]);

/** Full user directory with auth metadata (verification, last login, ban state). */
export const adminGetUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).default(""),
        role: z.enum(["all", "user", "doctor", "pharmacist", "admin"]).default("all"),
        status: z.enum(["all", "active", "inactive"]).default("all"),
        sort: z.enum(["newest", "oldest"]).default("newest"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const [{ data: profiles, error }, { data: roles }, { data: uploads }, authList] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at, is_active, deactivated_at, last_login_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("prescriptions").select("user_id"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (error) throw new Error(error.message);

    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as string]);
    const uploadCounts = new Map<string, number>();
    for (const u of uploads ?? []) uploadCounts.set(u.user_id, (uploadCounts.get(u.user_id) ?? 0) + 1);
    const authMap = new Map(
      (authList.data?.users ?? []).map((u) => [
        u.id,
        {
          verified: Boolean(u.email_confirmed_at),
          lastSignInAt: u.last_sign_in_at ?? null,
          banned: Boolean((u as { banned_until?: string | null }).banned_until),
        },
      ]),
    );

    let rows = (profiles ?? []).map((p) => {
      const meta = authMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        is_active: p.is_active !== false && !meta?.banned,
        deactivated_at: p.deactivated_at,
        last_login_at: meta?.lastSignInAt ?? p.last_login_at,
        verified: meta?.verified ?? false,
        roles: roleMap.get(p.id) ?? ["user"],
        uploads: uploadCounts.get(p.id) ?? 0,
      };
    });

    const q = data.search.toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.full_name ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          r.roles.join(",").toLowerCase().includes(q),
      );
    }
    if (data.role !== "all") rows = rows.filter((r) => r.roles.includes(data.role));
    if (data.status !== "all") rows = rows.filter((r) => (data.status === "active" ? r.is_active : !r.is_active));

    rows.sort((a, b) =>
      data.sort === "newest"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const total = rows.length;
    const start = (data.page - 1) * data.pageSize;
    return { rows: rows.slice(start, start + data.pageSize), total, page: data.page, pageSize: data.pageSize };
  });

/** Single-user drill-down: profile, roles, auth metadata, activity. */
export const adminGetUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const [{ data: profile }, { data: roles }, { data: uploads }, { data: reports }, { data: logs }, authUser] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
        supabaseAdmin
          .from("prescriptions")
          .select("id, file_name, status, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("user_id", data.userId),
        supabaseAdmin
          .from("system_logs")
          .select("id, action, status, ip, created_at")
          .eq("user_id", data.userId)
          .not("action", "like", "rl:%")
          .order("created_at", { ascending: false })
          .limit(15),
        supabaseAdmin.auth.admin.getUserById(data.userId),
      ]);
    if (!profile) throw new Error("User not found.");

    const u = authUser.data?.user;
    return {
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
      verified: Boolean(u?.email_confirmed_at),
      lastSignInAt: u?.last_sign_in_at ?? null,
      banned: Boolean((u as { banned_until?: string | null } | undefined)?.banned_until),
      provider: u?.app_metadata?.provider ?? "email",
      recentUploads: uploads ?? [],
      reportCount: reports?.length ?? 0,
      recentActivity: logs ?? [],
    };
  });

export const adminUpdateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().trim().max(120).nullable().default(null),
        email: z.string().trim().email().max(255).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.userId)
      .maybeSingle();

    const patch: { full_name: string | null; email?: string } = { full_name: data.fullName };
    if (data.email) patch.email = data.email;
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    if (data.email && data.email !== before?.email) {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email });
    }

    await adminAudit({
      adminId: context.userId,
      action: "profile_updated",
      targetUserId: data.userId,
      targetEmail: data.email ?? before?.email ?? null,
      previousValue: before ?? null,
      newValue: patch,
    });
    return { ok: true };
  });

export const adminChangeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: roleEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit, audit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role.");
    }

    const { data: before } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    const previous = (before ?? []).map((r) => r.role as string);

    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (del.error) throw new Error(del.error.message);
    const ins = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (ins.error) throw new Error(ins.error.message);

    const { data: notif } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: data.userId,
        title: "Your role was updated",
        body: `An administrator set your account role to ${data.role}.`,
        type: "info",
      })
      .select("id")
      .maybeSingle();
    if (notif) {
      await supabaseAdmin.from("notification_logs").insert({
        notification_id: notif.id,
        user_id: data.userId,
        channel: "in_app",
        status: "sent",
      });
    }

    const rank = ["user", "pharmacist", "doctor", "admin"];
    const promoted = rank.indexOf(data.role) > Math.max(...previous.map((p) => rank.indexOf(p)), 0);
    await adminAudit({
      adminId: context.userId,
      action: promoted ? "user_promoted" : "user_demoted",
      targetUserId: data.userId,
      previousValue: previous,
      newValue: [data.role],
    });
    await audit({ userId: context.userId, action: "role_changed", metadata: { target: data.userId, role: data.role } });
    return { ok: true };
  });

export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot deactivate your own account.");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: data.active, deactivated_at: data.active ? null : new Date().toISOString() })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });

    await adminAudit({
      adminId: context.userId,
      action: data.active ? "user_activated" : "user_deactivated",
      targetUserId: data.userId,
      previousValue: { is_active: !data.active },
      newValue: { is_active: data.active },
    });
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");

    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: files } = await supabaseAdmin.from("prescriptions").select("storage_path").eq("user_id", data.userId);
    const paths = (files ?? []).map((f) => f.storage_path).filter(Boolean);
    if (paths.length) await supabaseAdmin.storage.from("prescriptions").remove(paths);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await adminAudit({
      adminId: context.userId,
      action: "user_deleted",
      targetUserId: data.userId,
      targetEmail: before?.email ?? null,
      previousValue: before ?? null,
      newValue: null,
    });
    return { ok: true };
  });
