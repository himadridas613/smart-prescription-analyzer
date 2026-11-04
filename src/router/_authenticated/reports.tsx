import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReports } from "@/lib/reports.functions";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MediScan AI" },
      { name: "description", content: "Your prescription analysis reports and history." },
      { property: "og:title", content: "Reports — MediScan AI" },
      { property: "og:description", content: "Prescription analysis history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsLayout,
});

function ReportsLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isDetail = pathname !== "/reports";
  if (isDetail) return <Outlet />;
  return <ReportsList />;
}

function ReportsList() {
  const fetchReports = useServerFn(listReports);
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"], queryFn: () => fetchReports(),
  });
  const [q, setQ] = useState("");
  const filtered = reports.filter(r =>
    !q || (r.patient_name || "").toLowerCase().includes(q.toLowerCase())
    || (r.doctor_name || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Reports</h1>
          <p className="mt-1 text-muted-foreground">All your prescription analyses.</p>
        </div>
        <Link to="/upload">
          <Button className="rounded-full gradient-hero text-primary-foreground border-0 shadow-glow">
            <Upload className="mr-2 h-4 w-4" /> New upload
          </Button>
        </Link>
      </div>
      <Input placeholder="Search by patient or doctor…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md rounded-xl" />
      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-secondary" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-16 text-center text-muted-foreground">
          <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>No reports yet.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map(r => (
            <li key={r.id}>
              <Link to="/reports/$id" params={{ id: r.id }}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:shadow-glow">
                <div className="grid h-11 w-11 place-items-center rounded-xl gradient-hero">
                  <FileText className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.patient_name || "Untitled prescription"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.doctor_name ? `Dr. ${r.doctor_name} · ` : ""}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <RiskBadge level={r.risk_level} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskBadge({ level }: { level: string | null }) {
  const map: Record<string, string> = {
    low: "bg-success/10 text-success",
    medium: "bg-warning/20 text-warning-foreground",
    high: "bg-destructive/10 text-destructive",
  };
  const cls = map[level ?? "low"] ?? "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{level ?? "unknown"} risk</span>;
}
