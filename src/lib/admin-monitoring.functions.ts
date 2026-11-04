/**
 * Admin AI + OCR monitoring.
 *
 * Every number here is derived from live rows in `prescriptions` / `reports`
 * (the tables the analysis pipeline writes its metrics into). No sample data.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeSchema = z.object({
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
});

function bounds(input: { from?: string | undefined; to?: string | undefined }) {
  const to = input.to ? new Date(`${input.to}T23:59:59.999`) : new Date();
  const from = input.from ? new Date(`${input.from}T00:00:00`) : new Date(to.getTime() - 29 * 86400000);
  return { fromIso: from.toISOString(), toIso: to.toISOString(), from, to };
}

function dayKeys(from: Date, to: Date) {
  const keys: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= end && keys.length < 180) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/* ------------------------------------------------------------------ */
/* AI monitoring                                                       */
/* ------------------------------------------------------------------ */

export const adminAiMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { fromIso, toIso, from, to } = bounds(data);
    const [{ data: p, error: pErr }, { data: r, error: rErr }] = await Promise.all([
      supabaseAdmin
        .from("prescriptions")
        .select("id, status, stage, error, error_type, retry_count, processing_ms, json_valid, ocr_confidence, ai_model, created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("reports")
        .select("confidence, created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);

    const rows = p ?? [];
    const reports = r ?? [];
    const total = rows.length;
    const success = rows.filter((x) => x.status === "completed").length;
    const failed = rows.filter((x) => x.status === "failed").length;
    const pending = total - success - failed;
    const durations = rows.map((x) => Number(x.processing_ms ?? 0)).filter((n) => n > 0);
    const sorted = durations.slice().sort((a, b) => a - b);

    const keys = dayKeys(from, to);
    const series = keys.map((day) => {
      const inDay = rows.filter((x) => x.created_at.slice(0, 10) === day);
      const dayReports = reports.filter((x) => x.created_at.slice(0, 10) === day);
      const ms = inDay.map((x) => Number(x.processing_ms ?? 0)).filter((n) => n > 0);
      const conf = dayReports.map((x) => Number(x.confidence ?? 0)).filter((n) => n > 0);
      return {
        date: day,
        label: day.slice(5),
        total: inDay.length,
        success: inDay.filter((x) => x.status === "completed").length,
        failed: inDay.filter((x) => x.status === "failed").length,
        avgMs: Math.round(avg(ms)),
        confidence: Math.round(avg(conf) * 100),
      };
    });

    const errorCounts = new Map<string, number>();
    for (const row of rows) {
      if (row.status !== "failed") continue;
      const key = row.error_type ?? "unknown";
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }

    const models = new Map<string, number>();
    for (const row of rows) {
      if (!row.ai_model) continue;
      models.set(row.ai_model, (models.get(row.ai_model) ?? 0) + 1);
    }

    const confidences = reports.map((x) => Number(x.confidence ?? 0)).filter((n) => n > 0);

    return {
      range: { from: fromIso, to: toIso },
      generatedAt: new Date().toISOString(),
      total,
      success,
      failed,
      pending,
      successRate: total ? Math.round((success / total) * 100) : 0,
      errorRate: total ? Math.round((failed / total) * 100) : 0,
      avgMs: Math.round(avg(durations)),
      p95Ms: sorted.length ? (sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0) : 0,
      retries: rows.reduce((a, b) => a + Number(b.retry_count ?? 0), 0),
      jsonFailures: rows.filter((x) => x.json_valid === false).length,
      avgConfidence: Math.round(avg(confidences) * 100),
      scoredReports: confidences.length,
      series,
      errorBreakdown: Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count })),
      models: Array.from(models.entries()).map(([model, count]) => ({ model, count })),
      recentFailures: rows
        .filter((x) => x.status === "failed")
        .slice(0, 25)
        .map((x) => ({ id: x.id, error: x.error, error_type: x.error_type, created_at: x.created_at })),
    };
  });

/* ------------------------------------------------------------------ */
/* OCR monitoring                                                      */
/* ------------------------------------------------------------------ */

export const adminOcrMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    rangeSchema
      .extend({
        filter: z.enum(["all", "low_confidence", "failed", "successful"]).default("all"),
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

    const { fromIso, toIso, from, to } = bounds(data);
    const { data: p, error } = await supabaseAdmin
      .from("prescriptions")
      .select("id, file_name, file_type, status, stage, error, error_type, processing_ms, ocr_confidence, image_quality, blur_score, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const rows = p ?? [];
    const scored = rows.filter((x) => x.ocr_confidence != null);
    const success = rows.filter((x) => x.status === "completed");
    const failed = rows.filter((x) => x.status === "failed");
    const lowConfidence = scored.filter((x) => Number(x.ocr_confidence) < 0.6);
    const durations = rows.map((x) => Number(x.processing_ms ?? 0)).filter((n) => n > 0);

    const keys = dayKeys(from, to);
    const series = keys.map((day) => {
      const inDay = rows.filter((x) => x.created_at.slice(0, 10) === day);
      const conf = inDay.map((x) => Number(x.ocr_confidence ?? 0)).filter((n) => n > 0);
      const ms = inDay.map((x) => Number(x.processing_ms ?? 0)).filter((n) => n > 0);
      return {
        date: day,
        label: day.slice(5),
        total: inDay.length,
        success: inDay.filter((x) => x.status === "completed").length,
        failed: inDay.filter((x) => x.status === "failed").length,
        confidence: Math.round(avg(conf) * 100),
        avgMs: Math.round(avg(ms)),
      };
    });

    const buckets = [
      { bucket: "0–20%", min: 0, max: 0.2 },
      { bucket: "20–40%", min: 0.2, max: 0.4 },
      { bucket: "40–60%", min: 0.4, max: 0.6 },
      { bucket: "60–80%", min: 0.6, max: 0.8 },
      { bucket: "80–100%", min: 0.8, max: 1.01 },
    ].map((b) => ({
      bucket: b.bucket,
      count: scored.filter((x) => Number(x.ocr_confidence) >= b.min && Number(x.ocr_confidence) < b.max).length,
    }));

    let list = rows;
    if (data.filter === "failed") list = failed;
    else if (data.filter === "successful") list = success;
    else if (data.filter === "low_confidence") list = lowConfidence;
    if (data.search) {
      const q = data.search.toLowerCase();
      list = list.filter((x) => (x.file_name ?? "").toLowerCase().includes(q) || (x.error ?? "").toLowerCase().includes(q));
    }

    const start = (data.page - 1) * data.pageSize;

    return {
      range: { from: fromIso, to: toIso },
      generatedAt: new Date().toISOString(),
      totals: {
        jobs: rows.length,
        success: success.length,
        failed: failed.length,
        lowConfidence: lowConfidence.length,
        scored: scored.length,
        successRate: rows.length ? Math.round((success.length / rows.length) * 100) : 0,
        failureRate: rows.length ? Math.round((failed.length / rows.length) * 100) : 0,
        avgConfidence: Math.round(avg(scored.map((x) => Number(x.ocr_confidence))) * 100),
        avgQuality: Math.round(avg(rows.map((x) => Number(x.image_quality ?? 0)).filter((n) => n > 0)) * 100),
        avgMs: Math.round(avg(durations)),
      },
      series,
      distribution: buckets,
      rows: list.slice(start, start + data.pageSize),
      total: list.length,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

/** Full OCR result for one upload, read live from the database + storage. */
export const adminOcrRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireAdmin } = await import("@/lib/permissions.server");
    await requireAdmin(context.userId);

    const { data: presc, error } = await supabaseAdmin
      .from("prescriptions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!presc) throw new Error("Upload not found.");

    const [{ data: report }, { data: owner }] = await Promise.all([
      supabaseAdmin
        .from("reports")
        .select("id, patient_name, doctor_name, medicines, warnings, interactions, duplicates, summary, risk_level, confidence, created_at")
        .eq("prescription_id", presc.id)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("email, full_name").eq("id", presc.user_id).maybeSingle(),
    ]);

    let fileUrl: string | null = null;
    if (presc.storage_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("prescriptions")
        .createSignedUrl(presc.storage_path, 300);
      fileUrl = signed?.signedUrl ?? null;
    }

    return {
      prescription: {
        id: presc.id,
        file_name: presc.file_name,
        file_type: presc.file_type,
        file_size: presc.file_size,
        status: presc.status,
        stage: presc.stage,
        error: presc.error,
        error_type: presc.error_type,
        processing_ms: presc.processing_ms,
        retry_count: presc.retry_count,
        ocr_confidence: presc.ocr_confidence,
        image_quality: presc.image_quality,
        blur_score: presc.blur_score,
        json_valid: presc.json_valid,
        ai_model: presc.ai_model,
        created_at: presc.created_at,
        updated_at: presc.updated_at,
      },
      owner: owner ?? null,
      report: report ?? null,
      fileUrl,
    };
  });
