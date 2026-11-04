import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const baseFilter = z.object({
  search: z.string().trim().max(160).default(""),
  action: z.string().trim().max(60).default("all"),
  status: z.enum(["all", "success", "failure", "denied"]).default("all"),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(500).default(25),
});

/** Actions treated as system/infrastructure events rather than user activity. */
const SYSTEM_ACTIONS = [
  "analysis_started",
  "analysis_completed",
  "analysis_failed",
  "analysis_retried",
  "rate_limited",
  "permission_denied",
];

export const adminGetActivityLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => baseFilter.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    let q = supabaseAdmin
      .from("system_logs")
      .select("id, user_id, actor_email, role, action, status, ip, user_agent, metadata, created_at", {
        count: "exact",
      })
      .not("action", "like", "rl:%")
      .not("action", "in", `(${SYSTEM_ACTIONS.join(",")})`);

    if (data.action !== "all") q = q.eq("action", data.action);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59`).toISOString());
    if (data.search) q = q.or(`actor_email.ilike.%${data.search}%,action.ilike.%${data.search}%,ip.ilike.%${data.search}%`);

    const start = (data.page - 1) * data.pageSize;
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(start, start + data.pageSize - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });

/** Actions escalated to "critical" severity when they fail. */
const CRITICAL_ACTIONS = ["permission_denied", "login_failed", "shared_link_denied", "rate_limited"];

export const adminGetSystemLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    baseFilter
      .extend({
        severity: z.enum(["all", "info", "warning", "error", "critical"]).default("all"),
        sortBy: z.enum(["created_at", "severity"]).default("created_at"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    let q = supabaseAdmin
      .from("system_logs")
      .select("id, user_id, actor_email, role, action, status, ip, user_agent, metadata, created_at", {
        count: "exact",
      })
      .not("action", "like", "rl:%");

    if (data.action !== "all") q = q.eq("action", data.action);
    if (data.status !== "all") q = q.eq("status", data.status);

    const criticalList = `(${CRITICAL_ACTIONS.join(",")})`;
    if (data.severity === "critical") q = q.eq("status", "failure").in("action", CRITICAL_ACTIONS);
    else if (data.severity === "error") q = q.eq("status", "failure").not("action", "in", criticalList);
    else if (data.severity === "warning") q = q.eq("status", "denied");
    else if (data.severity === "info") q = q.eq("status", "success");

    if (data.from) q = q.gte("created_at", new Date(`${data.from}T00:00:00`).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59`).toISOString());
    if (data.search) q = q.or(`actor_email.ilike.%${data.search}%,action.ilike.%${data.search}%,ip.ilike.%${data.search}%`);

    const asc = data.sortDir === "asc";
    if (data.sortBy === "severity") q = q.order("status", { ascending: asc }).order("created_at", { ascending: false });
    else q = q.order("created_at", { ascending: asc });

    const start = (data.page - 1) * data.pageSize;
    const { data: rows, error, count } = await q.range(start, start + data.pageSize - 1);
    if (error) throw new Error(error.message);

    const { data: failures } = await supabaseAdmin
      .from("prescriptions")
      .select("id, error, error_type, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        severity:
          r.status === "failure"
            ? CRITICAL_ACTIONS.includes(r.action)
              ? ("critical" as const)
              : ("error" as const)
            : r.status === "denied"
              ? ("warning" as const)
              : ("info" as const),
      })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      recentFailures: failures ?? [],
    };
  });


export const adminGetAuditTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().max(160).default(""),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(200).default(25),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    let q = supabaseAdmin.from("admin_audit_logs").select("*", { count: "exact" });
    if (data.search) {
      q = q.or(`admin_email.ilike.%${data.search}%,target_email.ilike.%${data.search}%,action.ilike.%${data.search}%`);
    }
    const start = (data.page - 1) * data.pageSize;
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(start, start + data.pageSize - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, pageSize: data.pageSize };
  });
