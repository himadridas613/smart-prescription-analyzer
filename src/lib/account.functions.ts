import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AppRole = "user" | "doctor" | "pharmacist" | "admin";

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email, avatar_url").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    const roleList = (roles ?? []).map(r => r.role as AppRole);
    return {
      userId: context.userId,
      profile: profile ?? null,
      roles: roleList.length ? roleList : (["user"] as AppRole[]),
      isAdmin: roleList.includes("admin"),
      isClinician: roleList.includes("doctor") || roleList.includes("pharmacist"),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ fullName: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
