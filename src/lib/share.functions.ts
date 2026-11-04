import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        expiresInDays: z.number().int().min(1).max(90).default(7),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { audit, enforceRateLimit } = await import("@/lib/permissions.server");
    await enforceRateLimit({ key: "share", userId: context.userId, limit: 30, windowSeconds: 3600 });

    const { data: report, error: rErr } = await context.supabase
      .from("reports")
      .select("id, user_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (rErr || !report) throw new Error(rErr?.message || "Report not found");
    if (report.user_id !== context.userId) throw new Error("Not allowed");

    const expires = new Date(Date.now() + data.expiresInDays * 86400000).toISOString();
    const { data: share, error } = await context.supabase
      .from("shared_reports")
      .insert({ report_id: data.reportId, user_id: context.userId, expires_at: expires })
      .select("id, token, expires_at")
      .single();
    if (error || !share) throw new Error(error?.message || "Could not create share link");

    await context.supabase.from("notifications").insert({
      user_id: context.userId,
      title: "Report shared",
      body: "A secure share link was created for your report.",
      type: "info",
    });
    await audit({
      userId: context.userId,
      action: "report_shared",
      metadata: { report_id: data.reportId, share_id: share.id, expires_at: share.expires_at },
    });
    return { token: share.token, expiresAt: share.expires_at };
  });

export const listShareLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("shared_reports")
      .select("id, token, expires_at, created_at")
      .eq("report_id", data.reportId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shareId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { audit } = await import("@/lib/permissions.server");
    const { error } = await context.supabase
      .from("shared_reports")
      .delete()
      .eq("id", data.shareId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await audit({ userId: context.userId, action: "report_share_revoked", metadata: { share_id: data.shareId } });
    return { ok: true };
  });

export const getSharedReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requestMeta, enforceRateLimit, audit } = await import("@/lib/permissions.server");
    await enforceRateLimit({
      key: "sharedview",
      limit: 60,
      windowSeconds: 300,
      message: "Too many attempts. Please wait a few minutes.",
    });

    const { ip, userAgent } = requestMeta();
    const { data: share } = await supabaseAdmin
      .from("shared_reports")
      .select("id, report_id, user_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!share) {
      await audit({ action: "shared_link_denied", status: "denied", metadata: { reason: "invalid_token" } });
      throw new Error("This share link is invalid.");
    }
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      await supabaseAdmin.from("report_access_log").insert({
        report_id: share.report_id,
        owner_id: share.user_id,
        access_type: "token",
        token_id: share.id,
        ip,
        user_agent: userAgent,
        status: "expired",
      });
      throw new Error("This share link has expired.");
    }

    const { data: report } = await supabaseAdmin
      .from("reports")
      .select(
        "id, patient_name, doctor_name, medicines, warnings, interactions, duplicates, summary, risk_level, confidence, created_at",
      )
      .eq("id", share.report_id)
      .maybeSingle();
    if (!report) throw new Error("Report no longer available.");

    await supabaseAdmin.from("report_access_log").insert({
      report_id: share.report_id,
      owner_id: share.user_id,
      access_type: "token",
      token_id: share.id,
      ip,
      user_agent: userAgent,
      status: "allowed",
    });
    return report;
  });
