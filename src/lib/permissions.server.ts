/**
 * Central, server-only permission + audit layer.
 *
 * Nothing in here may be imported from client code. Role lookups run through the
 * service-role client so the database no longer needs a publicly callable
 * SECURITY DEFINER helper.
 */
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole = "user" | "doctor" | "pharmacist" | "admin";

export const ROLES: AppRole[] = ["user", "doctor", "pharmacist", "admin"];

export class PermissionError extends Error {
  constructor(message = "You do not have permission to do this.") {
    super(message);
    this.name = "PermissionError";
  }
}

/** All roles held by a user. Always returns at least ["user"]. */
export async function getRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as AppRole);
  return roles.length ? roles : ["user"];
}

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  return (await getRoles(userId)).includes(role);
}

export async function requireRole(userId: string, ...roles: AppRole[]): Promise<AppRole[]> {
  const held = await getRoles(userId);
  if (!roles.some((r) => held.includes(r))) {
    throw new PermissionError(`Requires ${roles.join(" or ")} access.`);
  }
  return held;
}

export async function requireAdmin(userId: string): Promise<AppRole[]> {
  return requireRole(userId, "admin");
}

/** True when the user owns the report, holds an active grant on it, or is an admin. */
export async function canReadReport(userId: string, reportId: string): Promise<boolean> {
  const { data: report } = await supabaseAdmin
    .from("reports")
    .select("user_id")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return false;
  if (report.user_id === userId) return true;

  const { data: grant } = await supabaseAdmin
    .from("report_grants")
    .select("id, expires_at, revoked_at")
    .eq("report_id", reportId)
    .eq("grantee_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (grant && (!grant.expires_at || new Date(grant.expires_at) > new Date())) return true;

  return hasRole(userId, "admin");
}

/* ------------------------------------------------------------------ */
/* Request metadata                                                    */
/* ------------------------------------------------------------------ */

export function requestMeta(): { ip: string | null; userAgent: string | null } {
  try {
    const req = getRequest();
    const h = req.headers;
    const ip =
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null;
    return { ip, userAgent: h.get("user-agent") };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/* ------------------------------------------------------------------ */
/* Audit logging                                                       */
/* ------------------------------------------------------------------ */

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "signup"
  | "role_changed"
  | "upload_created"
  | "upload_deleted"
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "analysis_retried"
  | "report_viewed"
  | "report_downloaded"
  | "report_deleted"
  | "report_shared"
  | "report_share_revoked"
  | "report_grant_created"
  | "report_grant_revoked"
  | "shared_link_viewed"
  | "shared_link_denied"
  | "admin_action"
  | "rate_limited"
  | "permission_denied";

export async function audit(entry: {
  userId?: string | null;
  action: AuditAction;
  status?: "success" | "failure" | "denied";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { ip, userAgent } = requestMeta();
  let role: string | null = null;
  let actorEmail: string | null = null;

  if (entry.userId) {
    try {
      role = (await getRoles(entry.userId)).join(",");
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", entry.userId)
        .maybeSingle();
      actorEmail = data?.email ?? null;
    } catch {
      /* auditing must never break the request */
    }
  }

  const { error } = await supabaseAdmin.from("system_logs").insert({
    user_id: entry.userId ?? null,
    action: entry.action,
    status: entry.status ?? "success",
    metadata: (entry.metadata ?? {}) as never,
    role,
    ip,
    user_agent: userAgent,
    actor_email: actorEmail,
  });
  if (error) console.error("[audit] failed to write log:", error.message);
}

/** Admin-specific audit trail with before/after values. */
export async function adminAudit(entry: {
  adminId: string;
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { ip, userAgent } = requestMeta();
  let adminEmail: string | null = null;
  try {
    const { data } = await supabaseAdmin.from("profiles").select("email").eq("id", entry.adminId).maybeSingle();
    adminEmail = data?.email ?? null;
  } catch {
    /* never break the request */
  }
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    admin_id: entry.adminId,
    admin_email: adminEmail,
    target_user_id: entry.targetUserId ?? null,
    target_email: entry.targetEmail ?? null,
    action: entry.action,
    previous_value: (entry.previousValue ?? null) as never,
    new_value: (entry.newValue ?? null) as never,
    ip,
    user_agent: userAgent,
    metadata: (entry.metadata ?? {}) as never,
  });
  if (error) console.error("[adminAudit] failed:", error.message);
}

/* ------------------------------------------------------------------ */
/* Rate limiting (durable, DB-backed)                                  */
/* ------------------------------------------------------------------ */

/**
 * Simple sliding-window limiter backed by system_logs, so it survives the
 * stateless worker runtime. Returns true when the caller is within budget.
 */
export async function rateLimit(opts: {
  key: string;
  userId?: string | null;
  limit: number;
  windowSeconds: number;
}): Promise<boolean> {
  const since = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();
  const { ip } = requestMeta();
  let query = supabaseAdmin
    .from("system_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", `rl:${opts.key}`)
    .gte("created_at", since);

  if (opts.userId) query = query.eq("user_id", opts.userId);
  else if (ip) query = query.eq("ip", ip);

  const { count } = await query;
  if ((count ?? 0) >= opts.limit) return false;

  await supabaseAdmin.from("system_logs").insert({
    user_id: opts.userId ?? null,
    action: `rl:${opts.key}`,
    status: "success",
    ip,
    metadata: {} as never,
  });
  return true;
}

export async function enforceRateLimit(opts: {
  key: string;
  userId?: string | null;
  limit: number;
  windowSeconds: number;
  message?: string;
}): Promise<void> {
  const ok = await rateLimit(opts);
  if (!ok) {
    await audit({
      userId: opts.userId,
      action: "rate_limited",
      status: "denied",
      metadata: { key: opts.key },
    });
    throw new Error(opts.message ?? "Too many requests. Please wait a moment and try again.");
  }
}
