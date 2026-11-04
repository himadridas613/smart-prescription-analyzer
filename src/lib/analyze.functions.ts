import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  storagePath: z.string(),
  fileName: z.string().optional(),
  fileType: z.string(),
  fileSize: z.number().optional(),
  fileBase64: z.string().min(1),
});

const AnalysisSchema = z.object({
  patient_name: z.string().nullable().optional(),
  doctor_name: z.string().nullable().optional(),
  medicines: z.array(z.object({
    name: z.string(),
    dosage: z.string().nullable().optional(),
    frequency: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    instructions: z.string().nullable().optional(),
    confidence: z.number().min(0).max(1).nullable().optional(),
  })).default([]),
  warnings: z.array(z.string()).default([]),
  interactions: z.array(z.string()).default([]),
  duplicates: z.array(z.string()).default([]),
  summary: z.string().nullable().optional(),
  risk_level: z.enum(["low", "medium", "high"]).default("low"),
  confidence: z.number().min(0).max(1).default(0.8),
});

const SYSTEM_PROMPT = `You are a clinical assistant that analyzes handwritten or printed prescriptions.
Extract structured medicine data and identify potential safety concerns.

Return STRICT JSON matching this exact shape (no extra keys, no markdown fences):
{
  "patient_name": string | null,
  "doctor_name": string | null,
  "medicines": [
    { "name": string, "dosage": string | null, "frequency": string | null,
      "duration": string | null, "instructions": string | null, "confidence": number }
  ],
  "warnings": string[],
  "interactions": string[],
  "duplicates": string[],
  "summary": string,
  "risk_level": "low" | "medium" | "high",
  "confidence": number
}

Rules:
- Confidence is 0..1. Include a per-medicine confidence.
- "interactions" lists risky drug-drug interactions between the medicines present.
- "duplicates" lists duplicated therapy (same drug class) present in the prescription.
- "warnings" are important safety notes (allergies, contraindications, dosage risks).
- "risk_level" reflects overall clinical risk of the prescription.
- If a field is unknown, use null (or empty array). Never invent medicines.
- Normalize medicine names to their generic/brand spelling as written; expand common
  abbreviations (e.g. "OD"=once daily, "BD"/"BID"=twice daily, "TDS"/"TID"=three times daily,
  "QID"=four times daily, "HS"=at bedtime, "SOS"=as needed, "PO"=by mouth).
- Dosage must include strength and unit when legible (e.g. "500 mg", "10 ml").
- Duration must be explicit when legible (e.g. "5 days", "2 weeks").
- Detect duplicates by active ingredient AND therapeutic class (e.g. two NSAIDs, two PPIs).
- Report only clinically meaningful drug-drug interactions and state the mechanism briefly.
- Lower per-medicine confidence when handwriting is ambiguous; never guess a drug name to
  fill a gap — omit it and add a warning that part of the prescription was illegible.
- Output ONLY the JSON object.`;

async function setStage(
  supabase: { from: (t: string) => any },
  id: string,
  stage: string,
) {
  await supabase.from("prescriptions").update({ stage }).eq("id", id);
}

// Vision model used for OCR/analysis. Defaults to a free-tier OpenRouter model;
// override with the OPENROUTER_MODEL environment variable.
const AI_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

async function runAnalysis(mime: string, fileName: string | undefined, base64: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI service not configured. Set OPENROUTER_API_KEY.");

  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  if (!isImage && !isPdf) throw new Error("Unsupported file type");

  const userContent = isImage
    ? [
        { type: "text", text: "Analyze this prescription and return the JSON described in the system message." },
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
      ]
    : [
        { type: "text", text: "Analyze this prescription PDF and return the JSON described in the system message." },
        { type: "file", file: { filename: fileName || "prescription.pdf", file_data: `data:${mime};base64,${base64}` } },
      ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/your-username/smart-prescription-analyzer",
      "X-Title": "Smart Prescription Analyzer",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI service is busy — please try again in a moment.");
    if (res.status === 401) throw new Error("Invalid OPENROUTER_API_KEY.");
    if (res.status === 402) throw new Error("AI credits exhausted. Check your OpenRouter account.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const stripped = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return AnalysisSchema.parse(JSON.parse(stripped));
}

export const analyzePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: presc, error: pErr } = await context.supabase
      .from("prescriptions")
      .insert({
        user_id: context.userId,
        storage_path: data.storagePath,
        file_name: data.fileName,
        file_type: data.fileType,
        file_size: data.fileSize,
        status: "processing",
        stage: "uploading",
      })
      .select("id").single();
    if (pErr || !presc) throw new Error(pErr?.message || "Failed to record upload");

    await context.supabase.from("notifications").insert({
      user_id: context.userId,
      title: "Analysis started",
      body: `We started analyzing ${data.fileName ?? "your prescription"}.`,
      type: "info",
    });

    try {
      await setStage(context.supabase, presc.id, "preprocessing");
      await setStage(context.supabase, presc.id, "ocr");
      const parsed = await runAnalysis(data.fileType, data.fileName, data.fileBase64);
      await setStage(context.supabase, presc.id, "generating_report");

      const { data: report, error: rErr } = await context.supabase
        .from("reports")
        .insert({
          prescription_id: presc.id,
          user_id: context.userId,
          patient_name: parsed.patient_name ?? null,
          doctor_name: parsed.doctor_name ?? null,
          medicines: parsed.medicines,
          warnings: parsed.warnings,
          interactions: parsed.interactions,
          duplicates: parsed.duplicates,
          summary: parsed.summary ?? null,
          risk_level: parsed.risk_level,
          confidence: parsed.confidence,
        })
        .select("id").single();
      if (rErr || !report) throw new Error(rErr?.message || "Failed to save report");

      await context.supabase.from("prescriptions").update({ status: "completed", stage: "completed", error: null }).eq("id", presc.id);
      await context.supabase.from("notifications").insert({
        user_id: context.userId,
        title: "Analysis complete",
        body: `Your prescription was analyzed successfully.`,
        type: "success",
      });

      return { reportId: report.id };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Analysis failed";
      await context.supabase.from("prescriptions")
        .update({ status: "failed", stage: "failed", error: message }).eq("id", presc.id);
      await context.supabase.from("notifications").insert({
        user_id: context.userId,
        title: "Analysis failed",
        body: message,
        type: "error",
      });
      throw new Error(message);
    }
  });

export const retryAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prescriptionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: presc, error: pErr } = await context.supabase
      .from("prescriptions")
      .select("id, user_id, storage_path, file_name, file_type")
      .eq("id", data.prescriptionId)
      .maybeSingle();
    if (pErr || !presc) throw new Error(pErr?.message || "Prescription not found");
    if (presc.user_id !== context.userId) throw new Error("Not allowed");

    await context.supabase.from("prescriptions")
      .update({ status: "processing", stage: "uploading", error: null }).eq("id", presc.id);

    await setStage(context.supabase, presc.id, "preprocessing");
    try {
      const dl = await context.supabase.storage.from("prescriptions").download(presc.storage_path);
      if (dl.error || !dl.data) throw new Error(dl.error?.message || "File not found in storage");
      const buf = await dl.data.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const mime = presc.file_type || "image/jpeg";

      await setStage(context.supabase, presc.id, "ocr");
      const parsed = await runAnalysis(mime, presc.file_name ?? undefined, base64);
      await setStage(context.supabase, presc.id, "generating_report");

      // Remove existing report(s) for this prescription
      await context.supabase.from("reports").delete().eq("prescription_id", presc.id);

      const { data: report, error: rErr } = await context.supabase
        .from("reports")
        .insert({
          prescription_id: presc.id,
          user_id: context.userId,
          patient_name: parsed.patient_name ?? null,
          doctor_name: parsed.doctor_name ?? null,
          medicines: parsed.medicines,
          warnings: parsed.warnings,
          interactions: parsed.interactions,
          duplicates: parsed.duplicates,
          summary: parsed.summary ?? null,
          risk_level: parsed.risk_level,
          confidence: parsed.confidence,
        })
        .select("id").single();
      if (rErr || !report) throw new Error(rErr?.message || "Failed to save report");

      await context.supabase.from("prescriptions").update({ status: "completed", stage: "completed", error: null }).eq("id", presc.id);
      await context.supabase.from("notifications").insert({
        user_id: context.userId,
        title: "Re-analysis complete",
        body: `Your prescription was re-analyzed successfully.`,
        type: "success",
      });

      return { reportId: report.id };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Analysis failed";
      await context.supabase.from("prescriptions")
        .update({ status: "failed", stage: "failed", error: message }).eq("id", presc.id);
      await context.supabase.from("notifications").insert({
        user_id: context.userId,
        title: "Analysis failed",
        body: message,
        type: "error",
      });
      throw new Error(message);
    }
  });

export const listUploads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prescriptions")
      .select("id, file_name, file_type, file_size, status, stage, error, storage_path, created_at, updated_at, reports(id, medicines, patient_name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const reports = (row.reports ?? []) as Array<{ id: string; medicines: unknown; patient_name: string | null }>;
      const report = reports[0];
      const medicines = Array.isArray(report?.medicines)
        ? (report!.medicines as Array<{ name?: string }>).map(m => m?.name).filter(Boolean).join(", ")
        : "";
      return {
        id: row.id,
        file_name: row.file_name,
        file_type: row.file_type,
        file_size: row.file_size,
        status: row.status,
        stage: row.stage,
        error: row.error,
        created_at: row.created_at,
        report_id: report?.id ?? null,
        patient_name: report?.patient_name ?? null,
        medicines,
      };
    });
  });

export const deleteUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prescriptionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: presc, error: pErr } = await context.supabase
      .from("prescriptions")
      .select("id, user_id, storage_path")
      .eq("id", data.prescriptionId)
      .maybeSingle();
    if (pErr || !presc) throw new Error(pErr?.message || "Prescription not found");
    if (presc.user_id !== context.userId) throw new Error("Not allowed");

    // Best-effort storage cleanup; ignore errors so DB delete still proceeds
    await context.supabase.storage.from("prescriptions").remove([presc.storage_path]);
    await context.supabase.from("reports").delete().eq("prescription_id", presc.id);
    const { error } = await context.supabase.from("prescriptions").delete().eq("id", presc.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUploadStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ prescriptionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("prescriptions")
      .select("id, status, stage, error, reports(id)")
      .eq("id", data.prescriptionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Upload not found");
    const reports = (row.reports ?? []) as Array<{ id: string }>;
    return { status: row.status, stage: row.stage, error: row.error, reportId: reports[0]?.id ?? null };
  });
