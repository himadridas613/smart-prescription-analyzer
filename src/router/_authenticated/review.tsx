import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAccount } from "@/hooks/useAccount";
import { listReviewQueue } from "@/lib/reports.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Loader2, Pill, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Clinical review — MediScan AI" },
      { name: "description", content: "Doctors and pharmacists review AI-extracted medicines, dosages and drug interactions." },
      { property: "og:title", content: "Clinical review — MediScan AI" },
      { property: "og:description", content: "Review AI prescription analyses." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewPage,
});

type Medicine = { name?: string; dosage?: string | null; frequency?: string | null; duration?: string | null };

function ReviewPage() {
  const navigate = useNavigate();
  const { data: account, isLoading: accLoading } = useAccount();
  const fetchQueue = useServerFn(listReviewQueue);
  const [q, setQ] = useState("");

  const allowed = !!account && (account.isClinician || account.isAdmin);

  useEffect(() => {
    if (!accLoading && account && !allowed) {
      toast.error("Clinician access required.");
      navigate({ to: "/dashboard", replace: true });
    }
  }, [account, accLoading, allowed, navigate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => fetchQueue(),
    enabled: allowed,
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => {
      const meds = (Array.isArray(r.medicines) ? r.medicines : []) as Medicine[];
      return (r.patient_name ?? "").toLowerCase().includes(s)
        || (r.doctor_name ?? "").toLowerCase().includes(s)
        || meds.some(m => (m?.name ?? "").toLowerCase().includes(s));
    });
  }, [rows, q]);

  if (accLoading || !allowed) {
    return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Clinical review</h1>
        <p className="mt-1 text-muted-foreground">Review AI-extracted medicines, duplicates and interactions.</p>
      </div>

      <Input placeholder="Search by patient, prescriber or medicine…" value={q}
        onChange={e => setQ(e.target.value)} className="max-w-md rounded-xl" />

      {isLoading && <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map(r => {
          const meds = (Array.isArray(r.medicines) ? r.medicines : []) as Medicine[];
          const interactions = (Array.isArray(r.interactions) ? r.interactions : []) as string[];
          const duplicates = (Array.isArray(r.duplicates) ? r.duplicates : []) as string[];
          return (
            <div key={r.id} className="glass rounded-3xl p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.patient_name ?? "Unnamed patient"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.doctor_name ? `Dr. ${r.doctor_name} · ` : ""}{new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={r.risk_level === "high" ? "destructive" : "secondary"}>
                  {r.risk_level ?? "unknown"} risk
                </Badge>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                {meds.slice(0, 4).map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Pill className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{m?.name}</span>
                    <span className="text-muted-foreground">{[m?.dosage, m?.frequency, m?.duration].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
                {meds.length > 4 && <p className="text-xs text-muted-foreground">+{meds.length - 4} more</p>}
              </div>
              {(interactions.length > 0 || duplicates.length > 0) && (
                <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> {interactions.length} interaction(s), {duplicates.length} duplicate(s)</p>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Link to="/reports/$id" params={{ id: r.id }}>
                  <Button size="sm" variant="outline" className="rounded-full"><Eye className="mr-2 h-3.5 w-3.5" /> Open report</Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {!isLoading && filtered.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No reports to review yet.
        </p>
      )}
    </div>
  );
}
