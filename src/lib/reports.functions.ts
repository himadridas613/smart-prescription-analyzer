import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, patient_name, doctor_name, risk_level, confidence, created_at, user_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Doctors / pharmacists: only reports a patient explicitly granted them. */
export const listReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireRole } = await import("@/lib/permissions.server");
    await requireRole(context.userId, "doctor", "pharmacist", "admin");

    const { data: grants } = await supabaseAdmin
      .from("report_grants")
      .select("report_id, expires_at")
      .eq("grantee_id", context.userId)
      .is("revoked_at", null)
      .limit(200);

    const ids = (grants ?? [])
      .filter((g) => !g.expires_at || new Date(g.expires_at) > new Date())
      .map((g) => g.report_id);

    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("id, patient_name, doctor_name, medicines, interactions, duplicates, warnings, risk_level, confidence, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { canReadReport, audit, requestMeta } = await import("@/lib/permissions.server");

    if (!(await canReadReport(context.userId, data.id))) {
      await audit({
        userId: context.userId,
        action: "permission_denied",
        status: "denied",
        metadata: { report_id: data.id },
      });
      throw new Error("Report not found");
    }

    const { data: row, error } = await supabaseAdmin.from("reports").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Report not found");

    let imageUrl: string | null = null;
    let fileType: string | null = null;
    const { data: presc } = await supabaseAdmin
      .from("prescriptions")
      .select("storage_path, file_type")
      .eq("id", row.prescription_id)
      .maybeSingle();
    if (presc?.storage_path) {
      const signed = await supabaseAdmin.storage.from("prescriptions").createSignedUrl(presc.storage_path, 60 * 30);
      imageUrl = signed.data?.signedUrl ?? null;
      fileType = presc.file_type;
    }

    if (row.user_id !== context.userId) {
      const { ip, userAgent } = requestMeta();
      await supabaseAdmin.from("report_access_log").insert({
        report_id: row.id,
        owner_id: row.user_id,
        viewer_id: context.userId,
        access_type: "grant",
        ip,
        user_agent: userAgent,
        status: "allowed",
      });
      await audit({ userId: context.userId, action: "report_viewed", metadata: { report_id: row.id } });
    }

    return { ...row, imageUrl, fileType, isOwner: row.user_id === context.userId };
  });
