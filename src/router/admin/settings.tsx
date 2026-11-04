import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/AdminShell";
import { useAccount } from "@/hooks/useAccount";
import { adminGetUserDetail } from "@/lib/admin-users.functions";
import { updateMyProfile } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin settings — MediScan AI" },
      { name: "description", content: "Administrator profile, role details and password management." },
      { property: "og:title", content: "Admin settings — MediScan AI" },
      { property: "og:description", content: "Administrator profile and security settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();
  const { data: account } = useAccount();
  const detailFn = useServerFn(adminGetUserDetail);
  const saveProfile = useServerFn(updateMyProfile);

  const [fullName, setFullName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (account?.profile?.full_name) setFullName(account.profile.full_name);
  }, [account?.profile?.full_name]);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["admin-self", account?.userId],
    queryFn: () => detailFn({ data: { userId: account!.userId } }),
    enabled: Boolean(account?.userId),
    staleTime: 30_000,
  });

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try {
      await saveProfile({ data: { fullName: fullName.trim() } });
      toast.success("Profile updated.");
      qc.invalidateQueries({ queryKey: ["account"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSavingName(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPw(false);
    if (error) return toast.error(error.message);
    setPassword("");
    setConfirm("");
    toast.success("Password changed.");
  };

  const profile = account?.profile;
  const initials = (profile?.full_name ?? profile?.email ?? "A").slice(0, 2).toUpperCase();

  return (
    <AdminShell title="Settings" description="Your administrator profile and security.">
      <section className="glass rounded-3xl p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Administrator avatar" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-2xl gradient-hero text-lg font-semibold text-primary-foreground shadow-glow">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-lg font-semibold">{profile?.full_name ?? "Administrator"}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              <ShieldCheck className="h-3 w-3" /> {(account?.roles ?? ["admin"]).join(", ")}
            </p>
          </div>
          <div className="ml-auto text-right text-sm">
            <p className="text-muted-foreground">Last login</p>
            <p className="font-medium">
              {isLoading ? "…" : detail?.lastSignInAt ? new Date(detail.lastSignInAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={submitName} className="glass space-y-4 rounded-3xl p-6 shadow-card">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-ro">Email</Label>
            <Input id="email-ro" value={profile?.email ?? ""} readOnly disabled />
          </div>
          <Button type="submit" disabled={savingName} className="rounded-xl gradient-hero text-primary-foreground border-0 shadow-glow">
            {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save profile
          </Button>
        </form>

        <form onSubmit={submitPassword} className="glass space-y-4 rounded-3xl p-6 shadow-card">
          <h2 className="text-sm font-semibold">Change password</h2>
          <div className="space-y-2">
            <Label htmlFor="pw">New password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pw" type="password" className="pl-9" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">Confirm password</Label>
            <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" disabled={savingPw} variant="outline" className="rounded-xl">
            {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
          </Button>
        </form>
      </div>

      <section className="glass rounded-3xl p-6 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Recent account activity</h2>
        {isLoading ? (
          <div className="grid h-24 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (detail?.recentActivity ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No recorded activity.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(detail?.recentActivity ?? []).map((a) => (
              <li key={a.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                <span>{a.action}</span>
                <span className="text-xs text-muted-foreground">
                  {a.ip ?? "—"} · {new Date(a.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
