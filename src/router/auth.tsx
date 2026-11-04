import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { oauth } from "@/integrations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["login", "signup", "forgot"]).catch("login"),
  email: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — MediScan AI" },
      { name: "description", content: "Access your MediScan AI prescription analyzer account." },
      { property: "og:title", content: "Sign in — MediScan AI" },
      { property: "og:description", content: "Log in or create your MediScan AI account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const mode = search.mode ?? "login";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && mode !== "forgot") {
        navigate({ to: "/dashboard", replace: true });
      }
    });
  }, [mode, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden mesh-bg px-4 py-12">
      <Link to="/" className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-hero shadow-glow">
            <Stethoscope className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            {mode === "signup" && "Create your account"}
            {mode === "login" && "Welcome back"}
            {mode === "forgot" && "Reset password"}
          </h1>
        </div>
        <div className="glass rounded-3xl p-6 shadow-card md:p-8">
          <AnimatePresence mode="wait">
            {mode === "login" && <LoginForm key="login" />}
            {mode === "signup" && <SignupForm key="signup" />}
            {mode === "forgot" && <ForgotForm key="forgot" />}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await oauth.signInWithOAuth("google", {
        redirectTo: window.location.origin,
      });
      if (result.error) toast.error("Google sign-in failed. Please try again.");
      else if (!result.redirected) window.location.href = "/dashboard";
    } catch {
      toast.error("Google sign-in failed.");
    } finally { setLoading(false); }
  };
  return (
    <Button type="button" variant="outline" className="w-full rounded-xl" onClick={handleGoogle} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.1A6.75 6.75 0 015.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 001 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
      )}
      Continue with Google
    </Button>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        toast.error("This account isn't active yet. Please try signing up again or contact support.");
      } else if (/invalid/i.test(error.message)) {
        toast.error("Invalid email or password.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" type="email" required autoComplete="email" placeholder="you@clinic.com"
            className="pl-9" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link to="/auth" search={{ mode: "forgot" as const }} className="text-xs text-primary hover:underline">Forgot?</Link>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" type="password" required autoComplete="current-password"
            className="pl-9" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
      </div>
      <Button type="submit" className="w-full rounded-xl gradient-hero text-primary-foreground border-0 shadow-glow" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
      </Button>
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
      </div>
      <GoogleButton />
      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/auth" search={{ mode: "signup" as const }} className="text-primary hover:underline">Sign up</Link>
      </p>
      <Link to="/admin/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
        Administrator? Admin login
      </Link>

    </motion.form>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "doctor" | "pharmacist">("user");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName, role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(/already registered|exists/i.test(error.message) ? "An account with this email already exists. Please sign in." : error.message);
      return;
    }
    if (signUpData.user && (signUpData.user.identities?.length ?? 0) === 0) {
      toast.error("An account with this email already exists. Please sign in or reset your password.");
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    if (!signUpData.session) {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) { toast.error(loginErr.message); return; }
    }
    toast.success("Account created — welcome!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="name" required className="pl-9" value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" type="email" required autoComplete="email" className="pl-9" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" className="pl-9"
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="space-y-2">
        <Label>I am a</Label>
        <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Patient / User</SelectItem>
            <SelectItem value="doctor">Doctor</SelectItem>
            <SelectItem value="pharmacist">Pharmacist</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full rounded-xl gradient-hero text-primary-foreground border-0 shadow-glow" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
      </Button>
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
      </div>
      <GoogleButton />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth" search={{ mode: "login" as const }} className="text-primary hover:underline">Sign in</Link>
      </p>
    </motion.form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("Reset link sent — check your inbox.");
  };
  if (sent) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 text-center">
      <p className="text-sm text-muted-foreground">We've emailed a password reset link to <b>{email}</b>.</p>
      <Link to="/auth" search={{ mode: "login" as const }}>
        <Button variant="outline" className="rounded-xl">Back to sign in</Button>
      </Link>
    </motion.div>
  );
  return (
    <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full rounded-xl gradient-hero text-primary-foreground border-0 shadow-glow" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset link
      </Button>
      <Link to="/auth" search={{ mode: "login" as const }} className="block text-center text-sm text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </motion.form>
  );
}
