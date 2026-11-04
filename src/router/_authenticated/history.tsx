import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUploads, retryAnalysis, deleteUpload } from "@/lib/analyze.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText, Search, Loader2, RefreshCw, Trash2, Eye, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Upload history — MediScan AI" },
      { name: "description", content: "Browse every prescription you've uploaded, retry failed analyses, and jump to reports." },
      { property: "og:title", content: "Upload history — MediScan AI" },
      { property: "og:description", content: "All uploaded prescriptions in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HistoryPage,
});

type SortKey = "newest" | "oldest";
type StatusFilter = "all" | "processing" | "completed" | "failed";
const PAGE_SIZE = 10;

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    processing: { label: "Processing", cls: "bg-blue-100 text-blue-700 border-blue-200", Icon: Clock },
    failed: { label: "Failed", cls: "bg-red-100 text-red-700 border-red-200", Icon: XCircle },
  };
  const it = map[status] ?? { label: status, cls: "bg-secondary text-foreground border-border", Icon: Clock };
  const I = it.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${it.cls}`}>
      <I className="h-3 w-3" /> {it.label}
    </span>
  );
}

function HistoryPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listUploads);
  const retry = useServerFn(retryAnalysis);
  const del = useServerFn(deleteUpload);

  const { data, isLoading, error } = useQuery({
    queryKey: ["uploads"],
    queryFn: () => list(),
    refetchInterval: (q) => {
      const rows = q.state.data as Array<{ status: string }> | undefined;
      return rows?.some(r => r.status === "processing") ? 4000 : false;
    },
  });

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = rows.filter(row => {
      if (status !== "all" && row.status !== status) return false;
      if (!term) return true;
      return (row.file_name ?? "").toLowerCase().includes(term)
        || (row.medicines ?? "").toLowerCase().includes(term)
        || (row.patient_name ?? "").toLowerCase().includes(term)
        || new Date(row.created_at).toLocaleDateString().toLowerCase().includes(term);
    });
    r = [...r].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });
    return r;
  }, [rows, q, status, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const retryMut = useMutation({
    mutationFn: (prescriptionId: string) => retry({ data: { prescriptionId } }),
    onMutate: (id) => setBusyId(id),
    onSuccess: async (res) => {
      toast.success("Re-analysis complete");
      await qc.invalidateQueries({ queryKey: ["uploads"] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
      navigate({ to: "/reports/$id", params: { id: res.reportId } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Retry failed"),
    onSettled: () => setBusyId(null),
  });

  const deleteMut = useMutation({
    mutationFn: (prescriptionId: string) => del({ data: { prescriptionId } }),
    onSuccess: async () => {
      toast.success("Upload deleted");
      await qc.invalidateQueries({ queryKey: ["uploads"] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
    onSettled: () => setConfirmDel(null),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Upload history</h1>
          <p className="mt-1 text-muted-foreground">Every prescription you've uploaded and its analysis status.</p>
        </div>
        <Button asChild className="rounded-full gradient-hero text-primary-foreground border-0 shadow-glow">
          <Link to="/upload">New upload</Link>
        </Button>
      </div>

      <div className="glass grid gap-3 rounded-2xl border border-border p-3 md:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search by file, patient, medicine or date…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load uploads"}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No uploads match your filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting search or status.</p>
        </div>
      )}

      {pageRows.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Medicines</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Uploaded</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.file_name ?? "Untitled"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.file_type ?? "—"}{row.file_size ? ` · ${(row.file_size / 1024 / 1024).toFixed(2)} MB` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{row.medicines || "—"}</td>
                    <td className="px-4 py-3">
                      {statusBadge(row.status)}
                      {row.status === "failed" && row.error && (
                        <p className="mt-1 text-xs text-red-600 line-clamp-1">{row.error}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.report_id && (
                          <Button asChild variant="ghost" size="sm" className="gap-1">
                            <Link to="/reports/$id" params={{ id: row.report_id }}>
                              <Eye className="h-4 w-4" /> View
                            </Link>
                          </Button>
                        )}
                        {(row.status === "failed" || row.status === "completed") && (
                          <Button
                            variant="ghost" size="sm" className="gap-1"
                            disabled={busyId === row.id || retryMut.isPending}
                            onClick={() => retryMut.mutate(row.id)}
                          >
                            {busyId === row.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <RefreshCw className="h-4 w-4" />}
                            Retry
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmDel(row.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {pageRows.map(row => (
              <div key={row.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate font-medium">{row.file_name ?? "Untitled"}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
                  </div>
                  {statusBadge(row.status)}
                </div>
                {row.medicines && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.medicines}</p>}
                {row.status === "failed" && row.error && (
                  <p className="mt-2 text-xs text-red-600 line-clamp-2">{row.error}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.report_id && (
                    <Button asChild variant="secondary" size="sm" className="gap-1">
                      <Link to="/reports/$id" params={{ id: row.report_id }}>
                        <Eye className="h-4 w-4" /> View
                      </Link>
                    </Button>
                  )}
                  {(row.status === "failed" || row.status === "completed") && (
                    <Button
                      variant="secondary" size="sm" className="gap-1"
                      disabled={busyId === row.id || retryMut.isPending}
                      onClick={() => retryMut.mutate(row.id)}
                    >
                      {busyId === row.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <RefreshCw className="h-4 w-4" />}
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="sm"
                    className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setConfirmDel(row.id)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {filtered.length} upload{filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the file, its analysis report, and any shared links. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMut.isPending}
              onClick={() => confirmDel && deleteMut.mutate(confirmDel)}
            >
              {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
