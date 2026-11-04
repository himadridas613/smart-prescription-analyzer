import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Stethoscope, LayoutDashboard, Upload, FileText, History, Bell, User as UserIcon,
  LogOut, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAccount } from "@/hooks/useAccount";
import { ShieldCheck, Stethoscope as ReviewIcon } from "lucide-react";
import { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login" as const } });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: s => s.location.pathname });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" as const }, replace: true });
  };

  const { data: account } = useAccount();
  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/upload", label: "Upload", icon: Upload },
    { to: "/history", label: "History", icon: History },
    { to: "/reports", label: "Reports", icon: FileText },
    { to: "/notifications", label: "Notifications", icon: Bell },
    ...(account?.isClinician || account?.isAdmin ? [{ to: "/review", label: "Clinical review", icon: ReviewIcon }] : []),
    ...(account?.isAdmin ? [{ to: "/admin", label: "Admin console", icon: ShieldCheck }] : []),
  ] as Array<{ to: string; label: string; icon: typeof LayoutDashboard }>;

  const initials = (user.user_metadata?.full_name ?? user.email ?? "U")
    .split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-hero">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            MediScan<span className="gradient-text">AI</span>
          </span>
        </div>
        <nav className="p-3">
          {nav.map(item => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link key={item.to} to={item.to as "/dashboard"} onClick={() => setOpen(false)}
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "gradient-hero text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(o => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-secondary transition">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="gradient-hero text-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium md:block">{user.user_metadata?.full_name ?? user.email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm">{user.user_metadata?.full_name ?? "Account"}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><UserIcon className="mr-2 h-4 w-4" /> Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}

// Loader helpers used by children (keep QueryClient reference to satisfy tree-shake).
export type AuthCtx = { user: { id: string; email?: string } };
export const _qcRef: QueryClient | undefined = undefined;
