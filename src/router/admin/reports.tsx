import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { adminListReports, adminDeleteReport } from "@/lib/admin.functions";
import { exportCsv, exportPdf } from "@/lib/admin-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/reports")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reports — MediScan AI admin" },
      { name: "description", content: "Browse every AI prescription report generated across the platform." },
      { property: "og:title", content: "Reports — MediScan AI admin" },
      { property: "og:description", content: "Platform-wide prescription analysis reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReports,
});

function AdminReports() {
  const qc = useQueryClient();
  const list = useServerFn(adminListReports);
  const del = useServerFn(adminDeleteReport);
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<"all" | "low" | "medium" | "high">("all");

  const { data, isLoading } = useQuery({ queryKey: ["admin-reports"], queryFn: () => list(), staleTime: 20_000 });

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return (data ?? []).filter(
      (r) =>
        (risk === "all" || r.risk_level === risk) &&
        (!q ||
          (r.patient_name ?? "").toLowerCase().includes(q) ||
          (r.doctor_name ?? "").toLowerCase().includes(q) ||
          (r.owner_email ?? "").toLowerCase().includes(q)),
    );
  }, [data, search, risk]);

  const remove = async (reportId: string) => {
    if (!confirm("Delete this report permanently?")) return;
    try {
      await del({ data: { reportId } });
      toast.success("Report deleted.");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  return (
    <AdminShell
      title="Reports"
      description="Every AI-generated prescription report across the platform."
      actions={
        <>
          <Button variant="outline" className="rounded-xl" onClick={() => exportCsv("reports", rows as unknown as Array<Record<string, unknown>>)}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => exportPdf("Reports", rows as unknown as Array<Record<string, unknown>>)}>
            PDF
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Reports" value={data?.length ?? 0} />
        <StatCard label="High risk" value={(data ?? []).filter((r) => r.risk_level === "high").length} />
        <StatCard label="Medium risk" value={(data ?? []).filter((r) => r.risk_level === "medium").length} />
        <StatCard label="Low risk" value={(data ?? []).filter((r) => r.risk_level === "low").length} />
      </div>

      <div className="glass rounded-3xl p-4 shadow-card">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search patient, doctor or owner" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {(["all", "low", "medium", "high"] as const).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={risk === r ? "default" : "outline"}
              className="rounded-full capitalize"
              onClick={() => setRisk(r)}
            >
              {r}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No reports match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Patient</th>
                  <th className="py-2">Doctor</th>
                  <th className="py-2">Owner</th>
                  <th className="py-2">Medicines</th>
                  <th className="py-2">Risk</th>
                  <th className="py-2">Confidence</th>
                  <th className="py-2">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="py-2">{r.patient_name ?? "—"}</td>
                    <td className="py-2">{r.doctor_name ?? "—"}</td>
                    <td className="py-2">{r.owner_email ?? "—"}</td>
                    <td className="py-2">{r.medicine_count}</td>
                    <td className="py-2 capitalize">{r.risk_level ?? "—"}</td>
                    <td className="py-2">{r.confidence ? `${Math.round(Number(r.confidence) * 100)}%` : "—"}</td>
                    <td className="py-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="sm" className="rounded-lg text-destructive" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
