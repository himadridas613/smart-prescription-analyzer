import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Pill,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Upload,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { verifyAdminAccess, recordAuthEvent } from "@/lib/auth.functions";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV: Array<{ to: string; label: string; icon: typeof Users; exact?: boolean }> = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/admin/pharmacists", label: "Pharmacists", icon: Pill },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/uploads", label: "Uploads", icon: Upload },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/monitoring", label: "Monitoring", icon: Activity },
  { to: "/admin/ai-monitoring", label: "AI monitoring", icon: Activity },
  { to: "/admin/ocr-monitoring", label: "OCR monitoring", icon: ScrollText },
  { to: "/admin/activity", label: "Activity logs", icon: ScrollText },
  { to: "/admin/system-logs", label: "System logs", icon: ShieldAlert },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const verify = useServerFn(verifyAdminAccess);
  const logEvent = useServerFn(recordAuthEvent);
  const { data: account } = useAccount();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("admin-sidebar-collapsed") === "1");
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("admin-sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-access"],
    queryFn: () => verify(),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isLoading && isError) navigate({ to: "/admin/login", replace: true });
  }, [isError, isLoading, navigate]);

  const signOut = async () => {
    await logEvent({ data: { event: "logout", userId: account?.userId ?? null, context: "admin" } }).catch(() => {});
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  };

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center mesh-bg">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Signed in but not an administrator → explicit 403, no admin data is fetched.
  if (data && !data.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center mesh-bg px-4">
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center shadow-card">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">403 — Forbidden</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have administrator access to this console.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/dashboard">
              <Button className="rounded-xl gradient-hero text-primary-foreground border-0 shadow-glow">
                Go to my dashboard
              </Button>
            </Link>
            <Button variant="outline" className="rounded-xl" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center mesh-bg">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const profile = account?.profile;
  const initials = (profile?.full_name ?? profile?.email ?? "A").slice(0, 2).toUpperCase();

  const SidebarBody = (
    <>
      <div className={cn("mb-4 flex items-center gap-2 px-2 py-3", collapsed && "justify-center px-0")}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-hero shadow-glow">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Admin console</p>
            <p className="truncate text-xs text-muted-foreground">MediScan AI</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "gradient-hero text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-border/60 pt-3">
        <Link
          to="/admin/settings"
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent",
            collapsed && "justify-center px-0",
          )}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Admin avatar" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </span>
          )}
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{profile?.full_name ?? "Administrator"}</span>
              <span className="block truncate text-xs text-muted-foreground">{profile?.email}</span>
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          className={cn("mt-1 w-full justify-start rounded-xl", collapsed && "justify-center px-0")}
          onClick={signOut}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && "Sign out"}
        </Button>
        <Button
          variant="ghost"
          className={cn("mt-1 hidden w-full justify-start rounded-xl lg:flex", collapsed && "justify-center px-0")}
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="mr-2 h-4 w-4" />}
          {!collapsed && "Collapse"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen mesh-bg">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6">
        <aside
          className={cn(
            "sticky top-6 hidden h-[calc(100vh-3rem)] shrink-0 flex-col rounded-3xl glass p-3 shadow-card transition-all lg:flex",
            collapsed ? "w-[76px]" : "w-60",
          )}
        >
          {SidebarBody}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Close menu"
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-card p-3 shadow-card">{SidebarBody}</aside>
          </div>
        )}

        <main className="min-w-0 flex-1 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open admin menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                  {title}
                </h1>
                {description && <p className="mt-1 text-muted-foreground">{description}</p>}
              </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: typeof Users;
}) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
