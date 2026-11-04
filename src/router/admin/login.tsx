import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyAdminAccess } from "@/lib/auth.functions";
import { recordAuthEvent } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin sign in — MediScan AI" },
      { name: "description", content: "Secure administrator sign-in for the MediScan AI console." },
      { property: "og:title", content: "Admin sign in — MediScan AI" },
      { property: "og:description", content: "Restricted administrator access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else toast.success("If that address belongs to an admin account, a reset link is on its way.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setLoading(false);
      await recordAuthEvent({ data: { event: "login_failed", email: email.trim(), context: "admin" } }).catch(() => {});
      toast.error(
        /invalid/i.test(error?.message ?? "") ? "Invalid email or password." : error?.message ?? "Sign-in failed.",
      );
      return;
    }

    const access = await verifyAdminAccess().catch(() => null);
    if (!access?.isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      await recordAuthEvent({
        data: { event: "login_failed", userId: data.user.id, email: email.trim(), context: "admin" },
      }).catch(() => {});
      toast.error("This account does not have administrator access.");
      return;
    }

    await recordAuthEvent({ data: { event: "login", userId: data.user.id, email: email.trim(), context: "admin" } }).catch(
      () => {},
    );
    setLoading(false);
    toast.success("Administrator verified.");
    navigate({ to: "/admin/dashboard", replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden mesh-bg px-4 py-12">
      <Link to="/" className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-hero shadow-glow">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            Administrator access
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Restricted area. Admin credentials required." : "We'll email you a password reset link."}
          </p>
        </div>
        <form onSubmit={submit} className="glass space-y-4 rounded-3xl p-6 shadow-card md:p-8">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="admin-email" type="email" required autoComplete="email" className="pl-9"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {mode === "login" && (
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="admin-password" type="password" required autoComplete="current-password" className="pl-9"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
          )}
          <Button type="submit" disabled={loading}
            className="w-full rounded-xl gradient-hero text-primary-foreground border-0 shadow-glow">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in as admin" : "Send reset link"}
          </Button>
          <button type="button" onClick={() => setMode(mode === "login" ? "forgot" : "login")}
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground">
            {mode === "login" ? "Forgot your password?" : "Back to sign in"}
          </button>
          <Link to="/auth" search={{ mode: "login" as const }}
            className="block text-center text-sm text-muted-foreground hover:text-foreground">
            Not an administrator? Standard sign in
          </Link>
        </form>
      </motion.div>
    </div>
  );
}
