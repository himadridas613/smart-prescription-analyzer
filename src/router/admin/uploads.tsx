import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { adminListUploads, adminDeleteUpload } from "@/lib/admin.functions";
import { exportCsv } from "@/lib/admin-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/uploads")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Uploads — MediScan AI admin" },
      { name: "description", content: "Monitor every prescription upload, its processing stage and failures." },
      { property: "og:title", content: "Uploads — MediScan AI admin" },
      { property: "og:description", content: "Prescription upload pipeline monitoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUploads,
});

const STATUSES = ["all", "queued", "processing", "completed", "failed"] as const;

function AdminUploads() {
  const qc = useQueryClient();
  const list = useServerFn(adminListUploads);
  const del = useServerFn(adminDeleteUpload);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-uploads"],
    queryFn: () => list(),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return (data ?? []).filter(
      (u) =>
        (status === "all" || u.status === status) &&
        (!q || (u.file_name ?? "").toLowerCase().includes(q) || (u.owner_email ?? "").toLowerCase().includes(q)),
    );
  }, [data, search, status]);

  const remove = async (prescriptionId: string) => {
    if (!confirm("Delete this upload and its report?")) return;
    try {
      await del({ data: { prescriptionId } });
      toast.success("Upload deleted.");
      qc.invalidateQueries({ queryKey: ["admin-uploads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  return (
    <AdminShell
      title="Uploads"
      description="Live view of the prescription processing pipeline."
      actions={
        <Button variant="outline" className="rounded-xl" onClick={() => exportCsv("uploads", rows as unknown as Array<Record<string, unknown>>)}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Uploads" value={data?.length ?? 0} />
        <StatCard label="Processing" value={(data ?? []).filter((u) => u.status === "processing").length} />
        <StatCard label="Completed" value={(data ?? []).filter((u) => u.status === "completed").length} />
        <StatCard label="Failed" value={(data ?? []).filter((u) => u.status === "failed").length} />
      </div>

      <div className="glass rounded-3xl p-4 shadow-card">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search file or owner" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "outline"} className="rounded-full capitalize" onClick={() => setStatus(s)}>
              {s}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No uploads match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">File</th>
                  <th className="py-2">Owner</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Stage</th>
                  <th className="py-2">Duration</th>
                  <th className="py-2">Retries</th>
                  <th className="py-2">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="py-2 max-w-[220px] truncate">{u.file_name}</td>
                    <td className="py-2">{u.owner_email ?? "—"}</td>
                    <td className="py-2 capitalize">{u.status}</td>
                    <td className="py-2 capitalize">{u.stage ?? "—"}</td>
                    <td className="py-2">{u.processing_ms ? `${(Number(u.processing_ms) / 1000).toFixed(1)}s` : "—"}</td>
                    <td className="py-2">{u.retry_count ?? 0}</td>
                    <td className="py-2">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="sm" className="rounded-lg text-destructive" onClick={() => remove(u.id)}>
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
