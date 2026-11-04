import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSharedReport } from "@/lib/share.functions";
import { Stethoscope, Pill, AlertTriangle, ShieldAlert, Copy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Shared prescription report — MediScan AI" },
      { name: "description", content: "A securely shared AI prescription safety report with medicines, dosages, interactions and warnings." },
      { property: "og:title", content: "Shared prescription report — MediScan AI" },
      { property: "og:description", content: "Securely shared AI prescription safety report." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

type Medicine = { name?: string; dosage?: string | null; frequency?: string | null; duration?: string | null; instructions?: string | null };

function SharePage() {
  const { token } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-report", token],
    queryFn: () => getSharedReport({ data: { token } }),
    retry: false,
  });

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center mesh-bg"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center mesh-bg px-4">
        <div className="glass max-w-md rounded-3xl p-10 text-center shadow-card">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <h1 className="text-xl font-semibold">Link unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "This share link is invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  const meds = (Array.isArray(data.medicines) ? data.medicines : []) as Medicine[];
  const warnings = (Array.isArray(data.warnings) ? data.warnings : []) as string[];
  const interactions = (Array.isArray(data.interactions) ? data.interactions : []) as string[];
  const duplicates = (Array.isArray(data.duplicates) ? data.duplicates : []) as string[];

  return (
    <div className="min-h-screen mesh-bg px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl gradient-hero shadow-glow">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            MediScan<span className="gradient-text">AI</span>
          </span>
          <Badge variant="secondary" className="ml-auto">Shared report</Badge>
        </div>

        <div className="glass rounded-3xl p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                {data.patient_name ?? "Prescription report"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {data.doctor_name ? `Prescriber: ${data.doctor_name} · ` : ""}
                {new Date(data.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant={data.risk_level === "high" ? "destructive" : "secondary"}>{data.risk_level ?? "unknown"} risk</Badge>
              <Badge variant="secondary">{Math.round(Number(data.confidence ?? 0) * 100)}% confidence</Badge>
            </div>
          </div>
          {data.summary && <p className="mt-4 text-sm text-muted-foreground">{data.summary}</p>}
        </div>

        <div className="glass rounded-3xl p-6 shadow-card">
          <h2 className="mb-3 font-semibold">Medicines</h2>
          <div className="space-y-2">
            {meds.map((m, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3">
                <p className="flex items-center gap-2 font-medium"><Pill className="h-4 w-4 text-primary" /> {m?.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[m?.dosage, m?.frequency, m?.duration].filter(Boolean).join(" · ") || "No dosage details detected"}
                </p>
                {m?.instructions && <p className="mt-1 text-xs text-muted-foreground">{m.instructions}</p>}
              </div>
            ))}
            {meds.length === 0 && <p className="text-sm text-muted-foreground">No medicines detected.</p>}
          </div>
        </div>

        {[["Drug interactions", interactions, AlertTriangle], ["Duplicate therapy", duplicates, Copy], ["Safety warnings", warnings, ShieldAlert]]
          .filter(([, list]) => (list as string[]).length > 0)
          .map(([title, list, Icon]) => {
            const IconC = Icon as typeof AlertTriangle;
            return (
              <div key={title as string} className="glass rounded-3xl p-6 shadow-card">
                <h2 className="mb-3 flex items-center gap-2 font-semibold"><IconC className="h-4 w-4 text-destructive" /> {title as string}</h2>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {(list as string[]).map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            );
          })}

        <p className="pb-6 text-center text-xs text-muted-foreground">
          AI-generated analysis for informational purposes only — always confirm with a licensed clinician.
        </p>
      </div>
    </div>
  );
}
