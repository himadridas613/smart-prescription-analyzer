import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReports } from "@/lib/reports.functions";
import { Upload, FileText, Activity, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MediScan AI" },
      { name: "description", content: "Your prescription analyses and safety insights at a glance." },
      { property: "og:title", content: "Dashboard — MediScan AI" },
      { property: "og:description", content: "Prescription reports and safety insights." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const fetchReports = useServerFn(listReports);
  const { data: reports = [] } = useQuery({
    queryKey: ["reports"],
    queryFn: () => fetchReports(),
  });

  const total = reports.length;
  const highRisk = reports.filter(r => r.risk_level === "high").length;
  const recent = reports.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Welcome back, <span className="gradient-text">{user.user_metadata?.full_name?.split(" ")[0] ?? "there"}</span>
        </h1>
        <p className="mt-1 text-muted-foreground">Analyze prescriptions and review AI-generated safety reports.</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total analyses", value: total, icon: FileText },
          { label: "High-risk flagged", value: highRisk, icon: Activity },
          { label: "Secure uploads", value: total, icon: ShieldCheck },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <div className="grid h-9 w-9 place-items-center rounded-xl gradient-hero">
                <s.icon className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-3xl gradient-hero p-8 text-primary-foreground shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Analyze a new prescription</h2>
            <p className="mt-1 opacity-90">Upload a photo, PDF or take one with your camera.</p>
          </div>
          <Link to="/upload">
            <Button size="lg" className="rounded-full bg-background text-foreground hover:bg-background/90">
              <Upload className="mr-2 h-4 w-4" /> New upload
            </Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="text-lg font-semibold">Recent reports</h2>
          <Link to="/reports" className="text-sm text-primary hover:underline inline-flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm">No analyses yet. Upload your first prescription to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map(r => (
              <li key={r.id}>
                <Link to="/reports/$id" params={{ id: r.id }} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.patient_name || "Untitled prescription"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <RiskBadge level={r.risk_level} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
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
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{level ?? "unknown"}</span>;
}
