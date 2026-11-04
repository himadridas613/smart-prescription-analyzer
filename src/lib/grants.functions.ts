import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Patient grants a specific doctor/pharmacist access to one report. */
export const grantReportAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        email: z.string().trim().email().max(255),
        expiresInDays: z.number().int().min(1).max(365).default(30),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit, getRoles, enforceRateLimit } = await import("@/lib/permissions.server");

    await enforceRateLimit({ key: "grant", userId: context.userId, limit: 20, windowSeconds: 3600 });

    const { data: report } = await context.supabase
      .from("reports")
      .select("id, user_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report || report.user_id !== context.userId) {
      throw new Error("Report not found.");
    }

    const email = data.email.toLowerCase();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", email)
      .maybeSingle();
    if (!profile) {
      throw new Error("No clinician account was found with that email address.");
    }
    if (profile.id === context.userId) {
      throw new Error("You already own this report.");
    }

    const roles = await getRoles(profile.id);
    const clinicalRole = roles.find((r) => r === "doctor" || r === "pharmacist");
    if (!clinicalRole) {
      throw new Error("That account is not registered as a doctor or pharmacist.");
    }

    const expires = new Date(Date.now() + data.expiresInDays * 86400000).toISOString();
    const { error } = await supabaseAdmin.from("report_grants").upsert(
      {
        report_id: data.reportId,
        owner_id: context.userId,
        grantee_id: profile.id,
        grantee_role: clinicalRole,
        note: data.note ?? null,
        expires_at: expires,
        revoked_at: null,
      },
      { onConflict: "report_id,grantee_id" },
    );
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: profile.id,
      title: "A patient shared a report with you",
      body: "A new prescription report is waiting in your review queue.",
      type: "info",
    });
    await audit({
      userId: context.userId,
      action: "report_grant_created",
      metadata: { report_id: data.reportId, grantee: profile.id, role: clinicalRole },
    });

    return { ok: true, grantee: { name: profile.full_name, email: profile.email, role: clinicalRole } };
  });

export const listReportGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report } = await context.supabase
      .from("reports")
      .select("id, user_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (!report || report.user_id !== context.userId) return [];

    const { data: grants } = await supabaseAdmin
      .from("report_grants")
      .select("id, grantee_id, grantee_role, note, expires_at, revoked_at, created_at")
      .eq("report_id", data.reportId)
      .order("created_at", { ascending: false });

    const ids = (grants ?? []).map((g) => g.grantee_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (grants ?? []).map((g) => ({
      ...g,
      name: map.get(g.grantee_id)?.full_name ?? null,
      email: map.get(g.grantee_id)?.email ?? null,
    }));
  });

export const revokeReportGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ grantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("@/lib/permissions.server");

    const { data: grant } = await supabaseAdmin
      .from("report_grants")
      .select("id, owner_id, report_id")
      .eq("id", data.grantId)
      .maybeSingle();
    if (!grant || grant.owner_id !== context.userId) throw new Error("Grant not found.");

    const { error } = await supabaseAdmin
      .from("report_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.grantId);
    if (error) throw new Error(error.message);

    await audit({
      userId: context.userId,
      action: "report_grant_revoked",
      metadata: { grant_id: data.grantId, report_id: grant.report_id },
    });
    return { ok: true };
  });

/** Access history for a report the caller owns. */
export const listReportAccessHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("report_access_log")
      .select("id, viewer_id, access_type, ip, status, created_at")
      .eq("report_id", data.reportId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
