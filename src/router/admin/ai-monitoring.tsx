import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock, Gauge, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { adminAiMetrics } from "@/lib/admin-monitoring.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/ai-monitoring")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI monitoring — MediScan AI admin" },
      { name: "description", content: "Live AI request volume, success rate, latency and confidence trends." },
      { property: "og:title", content: "AI monitoring — MediScan AI admin" },
      { property: "og:description", content: "Live AI reliability metrics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AiMonitoring,
});

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 shadow-card">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

const axisProps = {
  stroke: "currentColor",
  tick: { fontSize: 11 },
  className: "text-muted-foreground",
} as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    color: "var(--foreground)",
    fontSize: 12,
  },
} as const;

function AiMonitoring() {
  const fetchMetrics = useServerFn(adminAiMetrics);
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [live, setLive] = useState(true);

  const query = useQuery({
    queryKey: ["admin-ai-metrics", from, to],
    queryFn: () => fetchMetrics({ data: { from, to } }),
    refetchInterval: live ? 30_000 : false,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });

  const d = query.data;

  return (
    <AdminShell
      title="AI monitoring"
      description="Live model reliability, latency and confidence from real analysis runs."
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="ai-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="ai-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="ai-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
          </div>
          <Button variant={live ? "default" : "outline"} size="sm" className="h-9 rounded-xl" onClick={() => setLive((v) => !v)}>
            {live ? "Auto-refresh on" : "Auto-refresh off"}
          </Button>
          <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      }
    >
      {query.isLoading ? (
        <div className="grid h-60 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : query.isError ? (
        <div className="glass rounded-3xl p-8 text-center shadow-card">
          <p className="text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Could not load AI metrics."}
          </p>
          <Button className="mt-4 rounded-xl" variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      ) : !d || d.total === 0 ? (
        <div className="glass rounded-3xl p-10 text-center shadow-card">
          <p className="text-sm text-muted-foreground">No AI requests recorded in this date range.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(d.generatedAt).toLocaleTimeString()}
            {query.isFetching && " · refreshing…"}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total AI requests" value={d.total} icon={Sparkles} />
            <StatCard label="Successful" value={d.success} hint={`${d.successRate}% success rate`} icon={CheckCircle2} />
            <StatCard label="Failed" value={d.failed} hint={`${d.errorRate}% error rate`} icon={XCircle} />
            <StatCard label="Avg processing" value={`${(d.avgMs / 1000).toFixed(1)}s`} hint={`p95 ${(d.p95Ms / 1000).toFixed(1)}s`} icon={Clock} />
            <StatCard label="Avg confidence" value={`${d.avgConfidence}%`} hint={`${d.scoredReports} scored reports`} icon={Gauge} />
            <StatCard label="Retries" value={d.retries} icon={RefreshCw} />
            <StatCard label="Invalid JSON" value={d.jsonFailures} icon={AlertTriangle} />
            <StatCard label="In progress" value={d.pending} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="AI request volume over time">
              <AreaChart data={d.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="total" className="fill-primary/25 stroke-primary" strokeWidth={2} />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Success vs failure">
              <BarChart data={d.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="success" stackId="a" className="fill-primary" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" stackId="a" className="fill-destructive" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="Average processing time (ms)">
              <LineChart data={d.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="avgMs" dot={false} strokeWidth={2} className="stroke-primary" />
              </LineChart>
            </ChartCard>

            <ChartCard title="Confidence trend (%)">
              <LineChart data={d.series}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="confidence" dot={false} strokeWidth={2} className="stroke-primary" />
              </LineChart>
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Error trends by type</h2>
              {d.errorBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failures in this range.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.errorBreakdown.map((e) => (
                    <li key={e.type} className="flex items-center justify-between">
                      <span className="capitalize">{e.type}</span>
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{e.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Recent failures</h2>
              {d.recentFailures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failed runs in this range.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {d.recentFailures.slice(0, 10).map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3 border-t border-border/60 pt-2 first:border-0 first:pt-0">
                      <span className="text-muted-foreground">{f.error ?? f.error_type ?? "Unknown error"}</span>
                      <span className="shrink-0">{new Date(f.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AdminShell>
  );
}
