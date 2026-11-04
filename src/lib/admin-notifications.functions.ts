import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const audienceEnum = z.enum(["all", "user", "doctor", "pharmacist", "admin"]);

export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(3).max(140),
        body: z.string().trim().min(3).max(2000),
        audience: audienceEnum.default("all"),
        type: z.enum(["info", "warning", "success"]).default("info"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    if (data.id) {
      const { data: before } = await supabaseAdmin.from("announcements").select("*").eq("id", data.id).maybeSingle();
      const { error } = await supabaseAdmin
        .from("announcements")
        .update({
          title: data.title,
          body: data.body,
          audience: data.audience,
          type: data.type,
          updated_by: context.userId,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await adminAudit({
        adminId: context.userId,
        action: "announcement_updated",
        previousValue: before ?? null,
        newValue: data,
      });
      return { ok: true, id: data.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("announcements")
      .insert({
        title: data.title,
        body: data.body,
        audience: data.audience,
        type: data.type,
        status: "draft",
        created_by: context.userId,
        updated_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await adminAudit({ adminId: context.userId, action: "announcement_created", newValue: data });
    return { ok: true, id: row.id };
  });

export const adminSetAnnouncementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data: ann } = await supabaseAdmin.from("announcements").select("*").eq("id", data.id).maybeSingle();
    if (!ann) throw new Error("Announcement not found.");

    const { error } = await supabaseAdmin
      .from("announcements")
      .update({
        status: data.status,
        updated_by: context.userId,
        published_at: data.status === "published" ? new Date().toISOString() : ann.published_at,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    let delivered = 0;
    if (data.status === "published" && !ann.published_at) {
      let recipients: string[] = [];
      if (ann.audience === "all") {
        const { data: profiles } = await supabaseAdmin.from("profiles").select("id");
        recipients = (profiles ?? []).map((p) => p.id);
      } else {
        const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", ann.audience as "user" | "doctor" | "pharmacist" | "admin");
        recipients = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      }
      if (recipients.length) {
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("notifications")
          .insert(
            recipients.map((id) => ({ user_id: id, title: ann.title, body: ann.body, type: ann.type })),
          )
          .select("id, user_id");
        if (insErr) throw new Error(insErr.message);
        delivered = inserted?.length ?? 0;
        const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email").in("id", recipients);
        const emails = new Map((profiles ?? []).map((p) => [p.id, p.email]));
        await supabaseAdmin.from("notification_logs").insert(
          (inserted ?? []).map((n) => ({
            notification_id: n.id,
            announcement_id: data.id,
            user_id: n.user_id,
            recipient_email: emails.get(n.user_id) ?? null,
            channel: "in_app",
            status: "sent",
          })),
        );
      }
    }

    await adminAudit({
      adminId: context.userId,
      action: `announcement_${data.status}`,
      previousValue: { status: ann.status },
      newValue: { status: data.status, delivered },
    });
    return { ok: true, delivered };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    const { data: before } = await supabaseAdmin.from("announcements").select("*").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await adminAudit({ adminId: context.userId, action: "announcement_deleted", previousValue: before ?? null });
    return { ok: true };
  });

export const adminListDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(160).default(""),
        status: z.enum(["all", "sent", "failed", "pending"]).default("all"),
        channel: z.enum(["all", "in_app", "email"]).default("all"),
        read: z.enum(["all", "read", "unread"]).default("all"),
        announcementId: z.string().uuid().optional(),
        from: z.string().trim().max(40).optional(),
        to: z.string().trim().max(40).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(25),
      })
      .parse(d ?? {}),
  )

  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    let q = supabaseAdmin
      .from("notification_logs")
      .select("id, notification_id, announcement_id, user_id, recipient_email, channel, status, error, retry_count, created_at", {
        count: "exact",
      });
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.channel !== "all") q = q.eq("channel", data.channel);
    if (data.announcementId) q = q.eq("announcement_id", data.announcementId);
    if (data.from) q = q.gte("created_at", new Date(`${data.from}T00:00:00`).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59`).toISOString());
    if (data.search) q = q.ilike("recipient_email", `%${data.search}%`);


    const start = (data.page - 1) * data.pageSize;
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(start, start + data.pageSize - 1);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.notification_id).filter((x): x is string => Boolean(x));
    const readMap = new Map<string, boolean>();
    if (ids.length) {
      const { data: notifs } = await supabaseAdmin.from("notifications").select("id, read, title").in("id", ids);
      for (const n of notifs ?? []) readMap.set(n.id, n.read);
    }

    let merged = (rows ?? []).map((r) => ({
      ...r,
      read: r.notification_id ? (readMap.get(r.notification_id) ?? false) : false,
    }));
    if (data.read !== "all") merged = merged.filter((r) => (data.read === "read" ? r.read : !r.read));

    return { rows: merged, total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

export const adminRetryDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, adminAudit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data: log } = await supabaseAdmin.from("notification_logs").select("*").eq("id", data.id).maybeSingle();
    if (!log) throw new Error("Delivery record not found.");
    if (!log.user_id) throw new Error("This delivery has no recipient to retry.");

    const { data: source } = log.notification_id
      ? await supabaseAdmin.from("notifications").select("title, body, type").eq("id", log.notification_id).maybeSingle()
      : { data: null };
    const { data: ann } = log.announcement_id
      ? await supabaseAdmin.from("announcements").select("title, body, type").eq("id", log.announcement_id).maybeSingle()
      : { data: null };
    const payload = source ?? ann;
    if (!payload) throw new Error("Nothing to resend for this record.");

    const { data: notif, error } = await supabaseAdmin
      .from("notifications")
      .insert({ user_id: log.user_id, title: payload.title, body: payload.body, type: payload.type })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("notification_logs")
      .update({ status: "sent", error: null, retry_count: log.retry_count + 1, notification_id: notif.id })
      .eq("id", data.id);

    await adminAudit({
      adminId: context.userId,
      action: "notification_retried",
      targetUserId: log.user_id,
      targetEmail: log.recipient_email,
      newValue: { delivery_id: data.id },
    });
    return { ok: true };
  });

/** Audit trail limited to notification / announcement administration actions. */
export const adminNotificationAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data: rows, error } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("id, admin_email, target_email, action, previous_value, new_value, created_at")
      .or("action.ilike.announcement_%,action.ilike.notification_%")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

