import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, ScanLine, Search } from "lucide-react";
import {
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
import { adminOcrMetrics, adminOcrRecord } from "@/lib/admin-monitoring.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/admin/ocr-monitoring")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "OCR monitoring — MediScan AI admin" },
      { name: "description", content: "OCR quality, confidence distribution and failed extraction inspection." },
      { property: "og:title", content: "OCR monitoring — MediScan AI admin" },
      { property: "og:description", content: "Live OCR quality dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OcrMonitoring,
});

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const pct = (v: unknown) => (v == null ? "—" : `${Math.round(Number(v) * 100)}%`);

const axisProps = { stroke: "currentColor", tick: { fontSize: 11 }, className: "text-muted-foreground" } as const;
const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    color: "var(--foreground)",
    fontSize: 12,
  },
} as const;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "low_confidence", label: "Low confidence" },
  { id: "failed", label: "Failed" },
  { id: "successful", label: "Successful" },
] as const;

function OcrMonitoring() {
  const fetchMetrics = useServerFn(adminOcrMetrics);
  const fetchRecord = useServerFn(adminOcrRecord);

  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const pageSize = 25;

  const query = useQuery({
    queryKey: ["admin-ocr-metrics", from, to, filter, search, page],
    queryFn: () => fetchMetrics({ data: { from, to, filter, search, page, pageSize } }),
    refetchInterval: live ? 30_000 : false,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });

  const record = useQuery({
    queryKey: ["admin-ocr-record", openId],
    queryFn: () => fetchRecord({ data: { id: openId as string } }),
    enabled: Boolean(openId),
  });

  const d = query.data;
  const rows = d?.rows ?? [];

  return (
    <AdminShell
      title="OCR monitoring"
      description="Extraction quality, confidence distribution and failed uploads."
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="ocr-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="ocr-from" type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ocr-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="ocr-to" type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-[150px]" />
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
      {query.isError ? (
        <div className="glass rounded-3xl p-8 text-center shadow-card">
          <p className="text-sm text-destructive">
            {query.error instanceof Error ? query.error.message : "Could not load OCR metrics."}
          </p>
          <Button className="mt-4 rounded-xl" variant="outline" onClick={() => query.refetch()}>Try again</Button>
        </div>
      ) : query.isLoading || !d ? (
        <div className="grid h-60 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(d.generatedAt).toLocaleTimeString()}
            {query.isFetching && " · refreshing…"}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total OCR jobs" value={d.totals.jobs} icon={ScanLine} />
            <StatCard label="Successful" value={d.totals.success} hint={`${d.totals.successRate}% success`} />
            <StatCard label="Failed" value={d.totals.failed} hint={`${d.totals.failureRate}% failure`} />
            <StatCard label="Avg confidence" value={`${d.totals.avgConfidence}%`} hint={`${d.totals.scored} scored`} />
            <StatCard label="Low confidence" value={d.totals.lowConfidence} hint="below 60%" />
            <StatCard label="Avg image quality" value={`${d.totals.avgQuality}%`} />
            <StatCard label="Avg processing" value={`${(d.totals.avgMs / 1000).toFixed(1)}s`} />
            <StatCard label="Pending / other" value={d.totals.jobs - d.totals.success - d.totals.failed} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">OCR volume and outcome</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="success" stackId="a" className="fill-primary" />
                    <Bar dataKey="failed" stackId="a" className="fill-destructive" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Confidence trend (%)</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis domain={[0, 100]} {...axisProps} />
                    <Tooltip {...tooltipStyle} />
                    <Line type="monotone" dataKey="confidence" dot={false} strokeWidth={2} className="stroke-primary" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="glass rounded-3xl p-5 shadow-card xl:col-span-2">
              <h2 className="mb-3 text-sm font-semibold">Quality distribution</h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.distribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="bucket" {...axisProps} />
                    <YAxis allowDecimals={false} {...axisProps} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" className="fill-primary" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="glass rounded-3xl p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-sm font-semibold">OCR records</h2>
              <div className="relative min-w-[200px] flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-9"
                  placeholder="Search file or error"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              {FILTERS.map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filter === f.id ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => { setFilter(f.id); setPage(1); }}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No OCR records match these filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">File</th>
                      <th className="py-2">Uploaded</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Confidence</th>
                      <th className="py-2">Processing</th>
                      <th className="py-2">Failure reason</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="max-w-[200px] truncate py-2">{r.file_name ?? "—"}</td>
                        <td className="py-2">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="py-2 capitalize">{r.status}</td>
                        <td className="py-2">{pct(r.ocr_confidence)}</td>
                        <td className="py-2">{r.processing_ms ? `${(Number(r.processing_ms) / 1000).toFixed(1)}s` : "—"}</td>
                        <td className="max-w-[220px] truncate py-2 text-muted-foreground">{r.error ?? "—"}</td>
                        <td className="py-2 text-right">
                          <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setOpenId(r.id)}>
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {d.total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, d.total)}`} of {d.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg" disabled={page * pageSize >= d.total} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </section>
        </>
      )}

      <Sheet open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>OCR inspection</SheetTitle>
            <SheetDescription>Extraction result loaded directly from the database.</SheetDescription>
          </SheetHeader>

          {record.isLoading ? (
            <div className="grid h-40 place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : record.isError ? (
            <p className="mt-6 text-sm text-destructive">
              {record.error instanceof Error ? record.error.message : "Could not load this record."}
            </p>
          ) : record.data ? (
            <div className="mt-6 space-y-5 text-sm">
              <div className="rounded-2xl bg-accent/40 p-4">
                <p className="font-medium">{record.data.prescription.file_name ?? "Untitled upload"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(record.data.prescription.created_at).toLocaleString()} ·{" "}
                  {record.data.owner?.email ?? "unknown owner"}
                </p>
              </div>

              {record.data.fileUrl ? (
                record.data.prescription.file_type?.startsWith("image/") ? (
                  <img
                    src={record.data.fileUrl}
                    alt={`Uploaded prescription ${record.data.prescription.file_name ?? ""}`}
                    className="max-h-72 w-full rounded-2xl object-contain"
                  />
                ) : (
                  <a href={record.data.fileUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                    Open original file
                  </a>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Original file is no longer available in storage.</p>
              )}

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-muted-foreground">Status</dt><dd className="capitalize">{record.data.prescription.status}</dd></div>
                <div><dt className="text-muted-foreground">Stage</dt><dd className="capitalize">{record.data.prescription.stage}</dd></div>
                <div><dt className="text-muted-foreground">OCR confidence</dt><dd>{pct(record.data.prescription.ocr_confidence)}</dd></div>
                <div><dt className="text-muted-foreground">Image quality</dt><dd>{pct(record.data.prescription.image_quality)}</dd></div>
                <div><dt className="text-muted-foreground">Blur score</dt><dd>{record.data.prescription.blur_score ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Processing</dt><dd>{record.data.prescription.processing_ms ? `${(Number(record.data.prescription.processing_ms) / 1000).toFixed(1)}s` : "—"}</dd></div>
                <div><dt className="text-muted-foreground">Retries</dt><dd>{record.data.prescription.retry_count}</dd></div>
                <div><dt className="text-muted-foreground">Model</dt><dd>{record.data.prescription.ai_model ?? "—"}</dd></div>
              </dl>

              {record.data.prescription.error && (
                <div className="rounded-2xl bg-destructive/10 p-4 text-xs text-destructive">
                  <p className="font-medium capitalize">{record.data.prescription.error_type ?? "error"}</p>
                  <p>{record.data.prescription.error}</p>
                </div>
              )}

              {record.data.report ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Extracted summary</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{record.data.report.summary ?? "No summary stored."}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      Detected medicines ({Array.isArray(record.data.report.medicines) ? record.data.report.medicines.length : 0})
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {((Array.isArray(record.data.report.medicines) ? record.data.report.medicines : []) as Array<Record<string, unknown>>).map(
                        (m, i) => (
                          <li key={i} className="rounded-xl bg-accent/40 p-3 text-xs">
                            <p className="font-medium">{String(m['name'] ?? "Unnamed")}</p>
                            <p className="text-muted-foreground">
                              {[m['dosage'], m['frequency'], m['duration']].filter(Boolean).join(" · ") || "No dosage details"}
                            </p>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Report confidence {pct(record.data.report.confidence)} · risk {record.data.report.risk_level ?? "—"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No extraction result stored for this upload.</p>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}
