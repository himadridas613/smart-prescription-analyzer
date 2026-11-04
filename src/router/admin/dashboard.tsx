import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, Clock, FileText, Pill, ShieldCheck, Stethoscope, Users,
} from "lucide-react";
import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin dashboard — MediScan AI" },
      { name: "description", content: "System-wide analytics, usage and health for MediScan AI." },
      { property: "og:title", content: "Admin dashboard — MediScan AI" },
      { property: "og:description", content: "System-wide analytics, usage and health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const fetchOverview = useServerFn(getAdminOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 30_000,
  });

  return (
    <AdminShell title="Dashboard" description="Live platform activity, usage and system health.">
      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total users" value={data.totalUsers} icon={Users} />
            <StatCard label="Doctors" value={data.doctors} icon={Stethoscope} />
            <StatCard label="Pharmacists" value={data.pharmacists} icon={Pill} />
            <StatCard label="Admins" value={data.admins} icon={ShieldCheck} />
            <StatCard label="Uploads" value={data.totalUploads} icon={FileText} />
            <StatCard label="Reports" value={data.totalReports} icon={BarChart3} />
            <StatCard label="Completed" value={data.completed} hint={`${data.successRate}% success rate`} icon={CheckCircle2} />
            <StatCard label="Failed" value={data.failed} hint={`${data.processing} in progress`} icon={AlertTriangle} />
            <StatCard
              label="Avg processing"
              value={data.avgProcessingMs ? `${(data.avgProcessingMs / 1000).toFixed(1)}s` : "—"}
              icon={Clock}
            />
            <StatCard label="Avg confidence" value={`${data.avgConfidence}%`} icon={Activity} />
            <StatCard label="High-risk reports" value={data.highRisk} icon={AlertTriangle} />
            <StatCard
              label="System health"
              value={data.health.ai === "operational" ? "Operational" : "Degraded"}
              hint="Database · AI · Storage"
              icon={ShieldCheck}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Daily activity (14 days)</h2>
              <div className="flex h-40 items-end gap-1">
                {data.trend.map((d) => {
                  const max = Math.max(1, ...data.trend.map((t) => t.uploads));
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t gradient-hero"
                        style={{ height: `${(d.uploads / max) * 100}%`, minHeight: d.uploads ? 4 : 1 }}
                        title={`${d.date}: ${d.uploads}`}
                      />
                      <span className="text-[9px] text-muted-foreground">{d.date}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Top medicines</h2>
              {data.topMedicines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No analysed medicines yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.topMedicines.map((m) => (
                    <li key={m.name} className="flex items-center justify-between text-sm">
                      <span className="truncate">{m.name}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{m.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="glass rounded-3xl p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Recent logins</h2>
            {data.recentLogins.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sign-ins recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">User</th>
                      <th className="py-2">Role</th>
                      <th className="py-2">IP</th>
                      <th className="py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLogins.map((l) => (
                      <tr key={l.id} className="border-t border-border/60">
                        <td className="py-2">{l.actor_email ?? "—"}</td>
                        <td className="py-2">{l.role ?? "—"}</td>
                        <td className="py-2">{l.ip ?? "—"}</td>
                        <td className="py-2">{new Date(l.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
