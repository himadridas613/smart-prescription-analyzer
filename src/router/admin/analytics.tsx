import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, BarChart3, CheckCircle2, Clock, Loader2 } from "lucide-react";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { adminGetAiMonitoring } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Analytics — MediScan AI admin" },
      { name: "description", content: "Usage volume, success rates and processing performance for MediScan AI." },
      { property: "og:title", content: "Analytics — MediScan AI admin" },
      { property: "og:description", content: "Platform usage and AI performance analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const fetchAi = useServerFn(adminGetAiMonitoring);
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: () => fetchAi({ data: { days } }),
    staleTime: 30_000,
  });

  return (
    <AdminShell
      title="Analytics"
      description="Volume, success rate and AI performance over time."
      actions={
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} className="rounded-full" onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
      }
    >
      {isLoading || !data ? (
        <div className="grid h-60 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Analyses" value={data.total} icon={BarChart3} />
            <StatCard label="Success rate" value={`${data.successRate ?? 0}%`} icon={CheckCircle2} />
            <StatCard label="Avg response" value={data.avgResponseMs ? `${(data.avgResponseMs / 1000).toFixed(1)}s` : "—"} icon={Clock} />
            <StatCard label="P95 response" value={data.p95ResponseMs ? `${(data.p95ResponseMs / 1000).toFixed(1)}s` : "—"} icon={Activity} />
          </div>

          <section className="glass rounded-3xl p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Daily volume</h2>
            <div className="flex h-44 items-end gap-1">
              {data.daily.map((d) => {
                const max = Math.max(1, ...data.daily.map((x) => x.total));
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t gradient-hero"
                      style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 4 : 1 }}
                      title={`${d.date}: ${d.total} (${d.failed} failed)`}
                    />
                    <span className="text-[8px] text-muted-foreground">{d.date}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass rounded-3xl p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Most analysed medicines</h2>
            {data.topMedicines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No analysed medicines yet.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.topMedicines.map((m) => (
                  <li key={m.name} className="flex items-center justify-between rounded-xl bg-accent/40 px-3 py-2 text-sm">
                    <span className="truncate">{m.name}</span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs">{m.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
