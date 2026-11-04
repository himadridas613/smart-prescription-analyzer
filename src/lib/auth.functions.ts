import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Confirms the signed-in caller is an administrator. Used by the admin login
 * screen and admin route guard — the role check never happens in the browser.
 */
export const verifyAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getRoles } = await import("@/lib/permissions.server");
    const roles = await getRoles(context.userId);
    return { isAdmin: roles.includes("admin"), roles };
  });

/** Records an authentication event in the audit trail. */
export const recordAuthEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        event: z.enum(["login", "login_failed", "logout", "signup"]),
        userId: z.string().uuid().nullish(),
        email: z.string().trim().email().max(255).optional(),
        context: z.string().trim().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { audit, enforceRateLimit } = await import("@/lib/permissions.server");
    await enforceRateLimit({ key: "authlog", limit: 120, windowSeconds: 300 });
    await audit({
      userId: data.userId ?? null,
      action: data.event,
      status: data.event === "login_failed" ? "failure" : "success",
      metadata: { email: data.email ?? null, surface: data.context ?? "app" },
    });
    return { ok: true };
  });
