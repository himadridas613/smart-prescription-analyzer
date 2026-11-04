import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------------------------------------------------------------- */
/* Overview                                                          */
/* ---------------------------------------------------------------- */

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const [users, roles, prescriptions, reports, logins] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin
        .from("prescriptions")
        .select("id, status, created_at, processing_ms, retry_count, json_valid, error_type, ocr_confidence, image_quality, blur_score"),
      supabaseAdmin.from("reports").select("id, risk_level, confidence, medicines, created_at"),
      supabaseAdmin
        .from("system_logs")
        .select("id, user_id, actor_email, role, ip, status, created_at")
        .eq("action", "login")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const p = prescriptions.data ?? [];
    const r = reports.data ?? [];
    const roleRows = roles.data ?? [];

    const countRole = (role: string) => new Set(roleRows.filter((x) => x.role === role).map((x) => x.user_id)).size;

    const byDay = new Map<string, number>();
    for (const row of p) {
      const day = new Date(row.created_at).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const trend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
      return { date: d.slice(5), uploads: byDay.get(d) ?? 0 };
    });

    const medCounts = new Map<string, number>();
    for (const rep of r) {
      const meds = (rep.medicines ?? []) as Array<{ name?: string }>;
      for (const m of Array.isArray(meds) ? meds : []) {
        const name = (m?.name ?? "").trim();
        if (name) medCounts.set(name, (medCounts.get(name) ?? 0) + 1);
      }
    }
    const topMedicines = Array.from(medCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const durations = p.map((x) => Number(x.processing_ms ?? 0)).filter((n) => n > 0);
    const conf = r.map((x) => Number(x.confidence ?? 0)).filter((n) => n > 0);
    const completed = p.filter((x) => x.status === "completed").length;
    const failed = p.filter((x) => x.status === "failed").length;

    return {
      totalUsers: (users.data ?? []).length,
      doctors: countRole("doctor"),
      pharmacists: countRole("pharmacist"),
      admins: countRole("admin"),
      totalReports: r.length,
      totalUploads: p.length,
      completed,
      failed,
      processing: p.filter((x) => x.status === "processing").length,
      highRisk: r.filter((x) => x.risk_level === "high").length,
      avgProcessingMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      avgConfidence: conf.length ? Math.round((conf.reduce((a, b) => a + b, 0) / conf.length) * 100) : 0,
      successRate: p.length ? Math.round((completed / p.length) * 100) : 0,
      trend,
      topMedicines,
      riskBreakdown: [
        { name: "Low", value: r.filter((x) => x.risk_level === "low").length },
        { name: "Medium", value: r.filter((x) => x.risk_level === "medium").length },
        { name: "High", value: r.filter((x) => x.risk_level === "high").length },
      ],
      recentLogins: logins.data ?? [],
      health: {
        database: "operational" as const,
        ai: failed > completed && p.length > 4 ? ("degraded" as const) : ("operational" as const),
        storage: "operational" as const,
      },
    };
  });

/* ---------------------------------------------------------------- */
/* Users & roles                                                     */
/* ---------------------------------------------------------------- */

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const [{ data: profiles, error }, { data: roles }, { data: uploads }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("prescriptions").select("user_id"),
    ]);
    if (error) throw new Error(error.message);

    const map = new Map<string, string[]>();
    for (const r of roles ?? []) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role as string]);
    const uploadCounts = new Map<string, number>();
    for (const u of uploads ?? []) uploadCounts.set(u.user_id, (uploadCounts.get(u.user_id) ?? 0) + 1);

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: map.get(p.id) ?? ["user"],
      uploads: uploadCounts.get(p.id) ?? 0,
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["user", "doctor", "pharmacist", "admin"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, audit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role.");
    }
    const del = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (del.error) throw new Error(del.error.message);
    const ins = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (ins.error) throw new Error(ins.error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      title: "Your role was updated",
      body: `An administrator set your account role to ${data.role}.`,
      type: "info",
    });
    await audit({
      userId: context.userId,
      action: "role_changed",
      metadata: { target: data.userId, role: data.role },
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Uploads, reports                                                  */
/* ---------------------------------------------------------------- */

export const adminListUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data, error } = await supabaseAdmin
      .from("prescriptions")
      .select(
        "id, user_id, file_name, file_type, status, stage, error, error_type, processing_ms, retry_count, created_at, reports(id, risk_level, confidence)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email");
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (data ?? []).map((row) => {
      const rep = ((row.reports ?? []) as Array<{ id: string; risk_level: string | null; confidence: number | null }>)[0];
      const owner = pmap.get(row.user_id);
      return {
        id: row.id,
        file_name: row.file_name,
        status: row.status,
        stage: row.stage,
        error: row.error,
        error_type: row.error_type,
        processing_ms: row.processing_ms,
        retry_count: row.retry_count,
        created_at: row.created_at,
        owner_email: owner?.email ?? null,
        owner_name: owner?.full_name ?? null,
        report_id: rep?.id ?? null,
        risk_level: rep?.risk_level ?? null,
        confidence: rep?.confidence ?? null,
      };
    });
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("id, user_id, patient_name, doctor_name, risk_level, confidence, medicines, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, email");
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (data ?? []).map((r) => ({
      id: r.id,
      patient_name: r.patient_name,
      doctor_name: r.doctor_name,
      risk_level: r.risk_level,
      confidence: r.confidence,
      medicine_count: Array.isArray(r.medicines) ? (r.medicines as unknown[]).length : 0,
      created_at: r.created_at,
      owner_email: pmap.get(r.user_id)?.email ?? null,
    }));
  });

export const adminDeleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, audit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("reports").delete().eq("id", data.reportId);
    if (error) throw new Error(error.message);
    await audit({ userId: context.userId, action: "report_deleted", metadata: { report_id: data.reportId } });
    return { ok: true };
  });

export const adminDeleteUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prescriptionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, audit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    await supabaseAdmin.from("reports").delete().eq("prescription_id", data.prescriptionId);
    const { error } = await supabaseAdmin.from("prescriptions").delete().eq("id", data.prescriptionId);
    if (error) throw new Error(error.message);
    await audit({
      userId: context.userId,
      action: "upload_deleted",
      metadata: { prescription_id: data.prescriptionId },
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* Logs                                                              */
/* ---------------------------------------------------------------- */

const LOG_KINDS = ["activity", "system"] as const;

export const adminListLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(LOG_KINDS).default("activity"),
        limit: z.number().int().min(1).max(2000).default(300),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const systemActions = ["analysis_started", "analysis_completed", "analysis_failed", "analysis_retried", "rate_limited"];
    let q = supabaseAdmin
      .from("system_logs")
      .select("id, user_id, actor_email, role, action, status, ip, user_agent, metadata, created_at")
      .not("action", "like", "rl:%")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    q = data.kind === "system" ? q.in("action", systemActions) : q.not("action", "in", `(${systemActions.join(",")})`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ---------------------------------------------------------------- */
/* AI + OCR monitoring                                               */
/* ---------------------------------------------------------------- */

export const adminGetAiMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [{ data: p }, { data: r }] = await Promise.all([
      supabaseAdmin
        .from("prescriptions")
        .select("id, status, error_type, error, retry_count, processing_ms, json_valid, ocr_confidence, image_quality, blur_score, ai_model, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabaseAdmin.from("reports").select("confidence, medicines, created_at").gte("created_at", since),
    ]);

    const rows = p ?? [];
    const total = rows.length;
    const completed = rows.filter((x) => x.status === "completed").length;
    const failed = rows.filter((x) => x.status === "failed").length;
    const durations = rows.map((x) => Number(x.processing_ms ?? 0)).filter((n) => n > 0);

    const errorCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.status !== "failed") continue;
      const key = row.error_type ?? "unknown";
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }

    const buckets = [0, 0, 0, 0, 0];
    for (const rep of r ?? []) {
      const c = Number(rep.confidence ?? 0);
      if (c <= 0) continue;
      const idx = Math.min(4, Math.floor(c * 5));
      buckets[idx] = (buckets[idx] ?? 0) + 1;
    }

    const dayKeys = Array.from({ length: Math.min(data.days, 60) }, (_, i) =>
      new Date(Date.now() - (Math.min(data.days, 60) - 1 - i) * 86400000).toISOString().slice(0, 10),
    );
    const daily = dayKeys.map((day) => {
      const inDay = rows.filter((x) => x.created_at.slice(0, 10) === day);
      const d = inDay.map((x) => Number(x.processing_ms ?? 0)).filter((n) => n > 0);
      return {
        date: day.slice(5),
        total: inDay.length,
        completed: inDay.filter((x) => x.status === "completed").length,
        failed: inDay.filter((x) => x.status === "failed").length,
        avgMs: d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : 0,
      };
    });

    const medCounts = new Map<string, number>();
    for (const rep of r ?? []) {
      const meds = (rep.medicines ?? []) as Array<{ name?: string }>;
      for (const m of Array.isArray(meds) ? meds : []) {
        const name = (m?.name ?? "").trim();
        if (name) medCounts.set(name, (medCounts.get(name) ?? 0) + 1);
      }
    }

    return {
      total,
      days: data.days,
      daily,
      topMedicines: Array.from(medCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),

      successRate: total ? Math.round((completed / total) * 100) : 0,
      failureRate: total ? Math.round((failed / total) * 100) : 0,
      avgResponseMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      p95ResponseMs: durations.length
        ? durations.slice().sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] ?? 0
        : 0,
      apiErrors: rows.filter((x) => x.error_type === "ai_gateway").length,
      jsonFailures: rows.filter((x) => x.json_valid === false).length,
      retries: rows.reduce((a, b) => a + Number(b.retry_count ?? 0), 0),
      errorBreakdown: Array.from(errorCounts.entries()).map(([type, count]) => ({ type, count })),
      confidenceDistribution: [
        { bucket: "0–20%", count: buckets[0] ?? 0 },
        { bucket: "20–40%", count: buckets[1] ?? 0 },
        { bucket: "40–60%", count: buckets[2] ?? 0 },
        { bucket: "60–80%", count: buckets[3] ?? 0 },
        { bucket: "80–100%", count: buckets[4] ?? 0 },
      ],
      recentFailures: rows
        .filter((x) => x.status === "failed")
        .slice(0, 20)
        .map((x) => ({ id: x.id, error: x.error, error_type: x.error_type, created_at: x.created_at })),
    };
  });

export const adminGetOcrMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(d ?? {}))
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data } = await supabaseAdmin
      .from("prescriptions")
      .select("id, file_name, file_type, status, stage, ocr_confidence, image_quality, blur_score, error, error_type, created_at")
      .gte("created_at", new Date(Date.now() - input.days * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = data ?? [];
    const scored = rows.filter((x) => x.ocr_confidence != null);
    const quality = rows.map((x) => Number(x.image_quality ?? 0)).filter((n) => n > 0);
    const blurry = rows.filter((x) => Number(x.blur_score ?? 0) > 0.5);
    const lowConfidence = scored.filter((x) => Number(x.ocr_confidence) < 0.6);

    const errorCounts = new Map<string, number>();
    for (const row of rows) {
      if (!row.error) continue;
      const key = (row.error_type ?? "unknown") + ": " + String(row.error).slice(0, 80);
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }

    return {
      analysed: rows.length,
      scored: scored.length,
      avgOcrConfidence: scored.length
        ? Math.round((scored.reduce((a, b) => a + Number(b.ocr_confidence), 0) / scored.length) * 100)
        : 0,
      avgImageQuality: quality.length ? Math.round((quality.reduce((a, b) => a + b, 0) / quality.length) * 100) : 0,
      blurryCount: blurry.length,
      lowConfidenceCount: lowConfidence.length,
      byFileType: Array.from(
        rows.reduce((m, x) => {
          const k = x.file_type ?? "unknown";
          return m.set(k, (m.get(k) ?? 0) + 1);
        }, new Map<string, number>()),
      ).map(([type, count]) => ({ type, count })),
      commonErrors: Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([message, count]) => ({ message, count })),
      lowQuality: rows
        .filter((x) => Number(x.blur_score ?? 0) > 0.5 || Number(x.ocr_confidence ?? 1) < 0.6)
        .slice(0, 25)
        .map((x) => ({
          id: x.id,
          file_name: x.file_name,
          ocr_confidence: x.ocr_confidence,
          image_quality: x.image_quality,
          blur_score: x.blur_score,
          created_at: x.created_at,
        })),
    };
  });

/* ---------------------------------------------------------------- */
/* Announcements                                                     */
/* ---------------------------------------------------------------- */

export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(120),
        body: z.string().trim().min(3).max(1000),
        audience: z.enum(["all", "user", "doctor", "pharmacist", "admin"]).default("all"),
        type: z.enum(["info", "warning", "success"]).default("info"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin, audit } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    let recipients: string[] = [];
    if (data.audience === "all") {
      const { data: profiles } = await supabaseAdmin.from("profiles").select("id");
      recipients = (profiles ?? []).map((p) => p.id);
    } else {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", data.audience);
      recipients = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    }
    if (!recipients.length) throw new Error("No recipients match that audience.");

    const { error } = await supabaseAdmin
      .from("notifications")
      .insert(recipients.map((id) => ({ user_id: id, title: data.title, body: data.body, type: data.type })));
    if (error) throw new Error(error.message);

    await audit({
      userId: context.userId,
      action: "admin_action",
      metadata: { kind: "broadcast", audience: data.audience, recipients: recipients.length },
    });
    return { ok: true, recipients: recipients.length };
  });

export const adminListNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("id, user_id, title, body, type, read, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
