import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownUp, Download, Loader2, Search } from "lucide-react";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { adminGetSystemLogs } from "@/lib/admin-logs.functions";
import { exportCsv, exportPdf } from "@/lib/admin-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/system-logs")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "System logs — MediScan AI admin" },
      { name: "description", content: "Search, filter and export system events with severity and date ranges." },
      { property: "og:title", content: "System logs — MediScan AI admin" },
      { property: "og:description", content: "Severity-filtered system event log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SystemLogs,
});

const SEVERITIES = ["all", "info", "warning", "error", "critical"] as const;
type Severity = (typeof SEVERITIES)[number];
type LogRow = {
  id: string;
  actor_email: string | null;
  role: string | null;
  action: string;
  status: string;
  ip: string | null;
  user_agent: string | null;
  metadata: unknown;
  created_at: string;
  severity: "info" | "warning" | "error" | "critical";
};

const badgeClass = (sev: string) =>
  sev === "critical"
    ? "bg-destructive/20 text-destructive"
    : sev === "error"
      ? "bg-destructive/10 text-destructive"
      : sev === "warning"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-primary/10 text-primary";

function SystemLogs() {
  const fetchLogs = useServerFn(adminGetSystemLogs);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<Severity>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<"created_at" | "severity">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const params = { search, severity, action: "all" as const, status: "all" as const, from: from || undefined, to: to || undefined, sortBy, sortDir };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-system-logs", params, page, pageSize],
    queryFn: () => fetchLogs({ data: { ...params, page, pageSize } }),
    staleTime: 10_000,
  });

  const rows = (data?.rows ?? []) as LogRow[];

  /** Exports pull the full filtered result set from the server, not just this page. */
  const exportAll = async (kind: "csv" | "pdf") => {
    setExporting(true);
    try {
      const all = await fetchLogs({ data: { ...params, page: 1, pageSize: 500 } });
      const flat = (all.rows as LogRow[]).map((r) => ({
        timestamp: new Date(r.created_at).toISOString(),
        severity: r.severity,
        status: r.status,
        action: r.action,
        user: r.actor_email ?? "",
        role: r.role ?? "",
        ip: r.ip ?? "",
        device: r.user_agent ?? "",
        details: r.metadata ? JSON.stringify(r.metadata) : "",
      }));
      if (!flat.length) return;
      if (kind === "csv") exportCsv("system-logs", flat);
      else exportPdf("System logs", flat);
    } finally {
      setExporting(false);
    }
  };

  const toggleSort = (field: "created_at" | "severity") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <AdminShell
      title="System logs"
      description="Every recorded platform event with severity, actor and device details."
      actions={
        <>
          <Button variant="outline" className="rounded-xl" disabled={exporting} onClick={() => exportAll("csv")}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} CSV
          </Button>
          <Button variant="outline" className="rounded-xl" disabled={exporting} onClick={() => exportAll("pdf")}>
            PDF
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Events (filtered)" value={data?.total ?? 0} />
        <StatCard label="Errors on page" value={rows.filter((r) => r.severity === "error" || r.severity === "critical").length} />
        <StatCard label="Recent analysis failures" value={data?.recentFailures.length ?? 0} />
      </div>

      <div className="glass rounded-3xl p-4 shadow-card">
        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search email, action or IP"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="log-from" className="text-xs text-muted-foreground">From</Label>
            <Input id="log-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="log-to" className="text-xs text-muted-foreground">To</Label>
            <Input id="log-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Severity</Label>
            <Select value={severity} onValueChange={(v) => { setSeverity(v as Severity); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Page size</Label>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load logs."}</p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No system events match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">
                    <button className="flex items-center gap-1" onClick={() => toggleSort("severity")}>
                      Severity <ArrowDownUp className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2">Action</th>
                  <th className="py-2">User</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">IP / device</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">
                    <button className="flex items-center gap-1" onClick={() => toggleSort("created_at")}>
                      Timestamp <ArrowDownUp className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-t border-border/60">
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(l.severity)}`}>{l.severity}</span>
                    </td>
                    <td className="py-2">{l.action}</td>
                    <td className="max-w-[180px] truncate py-2">{l.actor_email ?? "—"}</td>
                    <td className="py-2">{l.role ?? "—"}</td>
                    <td className="max-w-[180px] truncate py-2 text-muted-foreground">
                      {l.ip ?? "—"}
                      {l.user_agent ? ` · ${l.user_agent.slice(0, 24)}…` : ""}
                    </td>
                    <td className="py-2 capitalize">{l.status}</td>
                    <td className="py-2">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setSelected(l)}>
                        Details
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
            {(data?.total ?? 0) === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data?.total ?? 0)}`} of{" "}
            {data?.total ?? 0}
            {isFetching && " · updating…"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page * pageSize >= (data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Log details</SheetTitle>
            <SheetDescription>Complete record for this system event.</SheetDescription>
          </SheetHeader>
          {selected && (
            <dl className="mt-6 space-y-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Timestamp</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Severity</dt><dd className="capitalize">{selected.severity}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Action</dt><dd>{selected.action}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="capitalize">{selected.status}</dd></div>
              <div><dt className="text-xs text-muted-foreground">User</dt><dd>{selected.actor_email ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Role</dt><dd>{selected.role ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">IP</dt><dd>{selected.ip ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Device</dt><dd className="break-words">{selected.user_agent ?? "—"}</dd></div>
              <div>
                <dt className="text-xs text-muted-foreground">Details</dt>
                <dd>
                  <pre className="mt-1 overflow-x-auto rounded-xl bg-accent/40 p-3 text-xs">
                    {JSON.stringify(selected.metadata ?? {}, null, 2)}
                  </pre>
                </dd>
              </div>
            </dl>
          )}
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}
