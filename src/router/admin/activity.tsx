import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminGetActivityLogs, adminGetAuditTrail } from "@/lib/admin-logs.functions";
import { exportCsv, exportPdf } from "@/lib/admin-export";

export const Route = createFileRoute("/admin/activity")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activity logs — MediScan AI admin" },
      { name: "description", content: "Timeline of logins, uploads, sharing and role changes across MediScan AI." },
      { property: "og:title", content: "Activity logs — MediScan AI admin" },
      { property: "og:description", content: "Full platform activity timeline with export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminActivityPage,
});

const ACTIONS = [
  "login", "login_failed", "logout", "signup", "role_changed", "upload_created", "upload_deleted",
  "report_viewed", "report_downloaded", "report_deleted", "report_shared", "report_share_revoked",
  "report_grant_created", "report_grant_revoked", "shared_link_viewed", "shared_link_denied", "admin_action",
];

function AdminActivityPage() {
  const fetchLogs = useServerFn(adminGetActivityLogs);
  const fetchAudit = useServerFn(adminGetAuditTrail);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [status, setStatus] = useState<"all" | "success" | "failure" | "denied">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-activity", search, action, status, from, to, page],
    queryFn: () =>
      fetchLogs({
        data: { search, action, status, from: from || undefined, to: to || undefined, page, pageSize: 25 },
      }),
    staleTime: 10_000,
  });

  const { data: audit } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => fetchAudit({ data: { search: "", page: 1, pageSize: 15 } }),
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 25));
  const exportRows = rows.map((r) => ({
    time: r.created_at, actor: r.actor_email ?? "", role: r.role ?? "",
    action: r.action, status: r.status, ip: r.ip ?? "", user_agent: r.user_agent ?? "",
  }));

  return (
    <AdminShell title="Activity logs" description="Every user-facing event across the platform, newest first.">
      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4 shadow-card">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Email, action or IP"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Event</Label>
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="from">From</Label>
          <Input id="from" type="date" className="w-[150px]" value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="to">To</Label>
          <Input id="to" type="date" className="w-[150px]" value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => exportCsv("activity-logs", exportRows)}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" className="rounded-xl"
            onClick={() => exportPdf("MediScan AI — Activity logs", exportRows)}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <section className="glass rounded-3xl p-5 shadow-card">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No activity matches these filters.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {rows.map((r) => (
              <li key={r.id} className="relative">
                <span
                  className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${
                    r.status === "success" ? "bg-primary" : r.status === "denied" ? "bg-amber-500" : "bg-destructive"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{r.action.replace(/_/g, " ")}</span>
                  <Badge variant={r.status === "success" ? "secondary" : "destructive"}>{r.status}</Badge>
                  {r.role && <Badge variant="outline">{r.role}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.actor_email ?? "anonymous"} · {r.ip ?? "no IP"} · {new Date(r.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} events · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" className="rounded-xl" disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      <section className="glass rounded-3xl p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold">Admin audit trail</h2>
        {!audit || audit.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No administrative changes recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Admin</th><th className="py-2">Action</th><th className="py-2">Target</th>
                  <th className="py-2">IP</th><th className="py-2">When</th></tr>
              </thead>
              <tbody>
                {audit.rows.map((a) => (
                  <tr key={a.id} className="border-t border-border/60">
                    <td className="py-2">{a.admin_email ?? "—"}</td>
                    <td className="py-2">{a.action}</td>
                    <td className="py-2">{a.target_email ?? "—"}</td>
                    <td className="py-2">{a.ip ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
