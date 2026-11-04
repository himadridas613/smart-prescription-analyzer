import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReport } from "@/lib/reports.functions";
import { createShareLink } from "@/lib/share.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Pill, AlertTriangle, Copy, ShieldAlert, Printer, Share2, Loader2, FileText, Check,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Prescription report — MediScan AI" },
      { name: "description", content: "Detailed AI prescription report: medicines, dosages, duplicates, interactions, warnings and risk level." },
      { property: "og:title", content: "Prescription report — MediScan AI" },
      { property: "og:description", content: "Detailed AI prescription safety report." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportPage,
});

type Medicine = {
  name?: string; dosage?: string | null; frequency?: string | null;
  duration?: string | null; instructions?: string | null; confidence?: number | null;
};

function ReportPage() {
  const { id } = Route.useParams();
  const fetchReport = useServerFn(getReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => fetchReport({ data: { id } }),
  });

  if (isLoading) {
    return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-10 text-center">
        <p className="font-medium">Report unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Not found"}</p>
        <Link to="/reports"><Button variant="outline" className="mt-5 rounded-full">Back to reports</Button></Link>
      </div>
    );
  }

  const meds = (Array.isArray(data.medicines) ? data.medicines : []) as Medicine[];
  const warnings = (Array.isArray(data.warnings) ? data.warnings : []) as string[];
  const interactions = (Array.isArray(data.interactions) ? data.interactions : []) as string[];
  const duplicates = (Array.isArray(data.duplicates) ? data.duplicates : []) as string[];
  const confidence = Math.round(Number(data.confidence ?? 0) * 100);

  return (
    <div className="mx-auto max-w-4xl space-y-5 print:max-w-none">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link to="/reports" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All reports
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <ShareDialog reportId={data.id} />
          <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
        </div>
      </div>

      <div className="glass rounded-3xl p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
              {data.patient_name ?? "Prescription report"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.doctor_name ? `Prescriber: ${data.doctor_name} · ` : ""}
              Analyzed {new Date(data.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={data.risk_level === "high" ? "destructive" : "secondary"} className="capitalize">
              {data.risk_level ?? "unknown"} risk
            </Badge>
            <Badge variant="secondary">{confidence}% confidence</Badge>
          </div>
        </div>
        {data.summary && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{data.summary}</p>}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full gradient-hero" style={{ width: `${confidence}%` }} />
        </div>
      </div>

      {data.imageUrl && (
        <div className="glass overflow-hidden rounded-3xl p-6 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-primary" /> Original prescription</h2>
          {(data.fileType ?? "").startsWith("image/") ? (
            <img src={data.imageUrl} alt="Original prescription document"
              className="max-h-[520px] w-full rounded-2xl border border-border bg-secondary object-contain" />
          ) : (
            <a href={data.imageUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary">
              <FileText className="h-4 w-4" /> Open uploaded PDF
            </a>
          )}
        </div>
      )}

      <div className="glass rounded-3xl p-6 shadow-card">
        <h2 className="mb-4 font-semibold">Medicines ({meds.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {meds.map((m, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 font-medium"><Pill className="h-4 w-4 text-primary" /> {m?.name ?? "Unknown"}</p>
              <dl className="mt-2 space-y-1 text-sm">
                <Row label="Dosage" value={m?.dosage} />
                <Row label="Frequency" value={m?.frequency} />
                <Row label="Duration" value={m?.duration} />
                {m?.instructions && <Row label="Notes" value={m.instructions} />}
              </dl>
              {typeof m?.confidence === "number" && (
                <p className="mt-2 text-xs text-muted-foreground">{Math.round(m.confidence * 100)}% extraction confidence</p>
              )}
            </div>
          ))}
          {meds.length === 0 && <p className="text-sm text-muted-foreground">No medicines were detected.</p>}
        </div>
      </div>

      <Section title="Duplicate medicines" items={duplicates} Icon={Copy} tone="warn" />
      <Section title="Drug interactions" items={interactions} Icon={AlertTriangle} tone="danger" />
      <Section title="Safety warnings" items={warnings} Icon={ShieldAlert} tone="warn" />

      <p className="pb-6 text-center text-xs text-muted-foreground">
        AI-generated analysis for informational purposes only — always confirm with a licensed clinician.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, items, Icon, tone }: {
  title: string; items: string[]; Icon: typeof AlertTriangle; tone: "warn" | "danger";
}) {
  if (items.length === 0) return null;
  return (
    <div className="glass rounded-3xl p-6 shadow-card">
      <h2 className={`mb-3 flex items-center gap-2 font-semibold ${tone === "danger" ? "text-destructive" : ""}`}>
        <Icon className="h-4 w-4" /> {title} ({items.length})
      </h2>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((x, i) => (
          <li key={i} className="rounded-xl border border-border bg-card p-3">{x}</li>
        ))}
      </ul>
    </div>
  );
}

function ShareDialog({ reportId }: { reportId: string }) {
  const share = useServerFn(createShareLink);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mut = useMutation({
    mutationFn: (days: number) => share({ data: { reportId, expiresInDays: days } }),
    onSuccess: (res) => {
      setUrl(`${window.location.origin}/share/${res.token}`);
      toast.success("Secure share link created.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this report</DialogTitle>
          <DialogDescription>
            Creates a secure, expiring link. Anyone with the link can view the report — but not your account.
          </DialogDescription>
        </DialogHeader>
        {!url ? (
          <div className="flex flex-wrap gap-2">
            {[1, 7, 30].map(d => (
              <Button key={d} variant="outline" className="rounded-full" disabled={mut.isPending}
                onClick={() => mut.mutate(d)}>
                {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Expires in {d} day{d > 1 ? "s" : ""}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input readOnly value={url} className="rounded-xl" />
            <Button onClick={copy} className="rounded-xl gradient-hero text-primary-foreground border-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
