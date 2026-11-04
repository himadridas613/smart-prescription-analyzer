import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Eye, Gauge, Loader2, ScanLine } from "lucide-react";

import { AdminShell, StatCard } from "@/components/admin/AdminShell";
import { adminGetAiMonitoring, adminGetOcrMonitoring } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/monitoring")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI & OCR monitoring — MediScan AI admin" },
      { name: "description", content: "Track AI reliability, OCR confidence, blur detection and failure causes." },
      { property: "og:title", content: "AI & OCR monitoring — MediScan AI admin" },
      { property: "og:description", content: "AI reliability and OCR quality monitoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminMonitoring,
});

function AdminMonitoring() {
  const fetchAi = useServerFn(adminGetAiMonitoring);
  const fetchOcr = useServerFn(adminGetOcrMonitoring);
  const [days, setDays] = useState(30);

  const ai = useQuery({ queryKey: ["admin-ai", days], queryFn: () => fetchAi({ data: { days } }), staleTime: 30_000 });
  const ocr = useQuery({ queryKey: ["admin-ocr", days], queryFn: () => fetchOcr({ data: { days } }), staleTime: 30_000 });

  const loading = ai.isLoading || ocr.isLoading || !ai.data || !ocr.data;

  return (
    <AdminShell
      title="AI & OCR monitoring"
      description="Model reliability, extraction confidence and image quality."
      actions={
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} className="rounded-full" onClick={() => setDays(d)}>
              {d}d
            </Button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="grid h-60 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Success rate" value={`${ai.data.successRate}%`} hint={`${ai.data.failureRate}% failed`} icon={Gauge} />
            <StatCard label="Gateway errors" value={ai.data.apiErrors} hint={`${ai.data.jsonFailures} invalid JSON`} icon={AlertTriangle} />
            <StatCard label="Retries" value={ai.data.retries} icon={ScanLine} />
            <StatCard label="Avg OCR confidence" value={`${ocr.data.avgOcrConfidence}%`} icon={Eye} />
            <StatCard label="Avg image quality" value={`${ocr.data.avgImageQuality}%`} />
            <StatCard label="Blurry uploads" value={ocr.data.blurryCount} />
            <StatCard label="Low confidence" value={ocr.data.lowConfidenceCount} />
            <StatCard label="Analysed" value={ocr.data.analysed} hint={`${ocr.data.scored} scored`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Confidence distribution</h2>
              <div className="space-y-2">
                {ai.data.confidenceDistribution.map((b) => {
                  const max = Math.max(1, ...ai.data!.confidenceDistribution.map((x) => x.count));
                  return (
                    <div key={b.bucket} className="flex items-center gap-3 text-xs">
                      <span className="w-16 text-muted-foreground">{b.bucket}</span>
                      <div className="h-2 flex-1 rounded-full bg-accent">
                        <div className="h-2 rounded-full gradient-hero" style={{ width: `${(b.count / max) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right">{b.count}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Error breakdown</h2>
              {ai.data.errorBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failures in this period.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {ai.data.errorBreakdown.map((e) => (
                    <li key={e.type} className="flex items-center justify-between">
                      <span className="capitalize">{e.type}</span>
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{e.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Uploads by file type</h2>
              <ul className="space-y-2 text-sm">
                {ocr.data.byFileType.map((t) => (
                  <li key={t.type} className="flex items-center justify-between">
                    <span>{t.type}</span>
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{t.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="glass rounded-3xl p-5 shadow-card">
              <h2 className="mb-3 text-sm font-semibold">Common OCR errors</h2>
              {ocr.data.commonErrors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No OCR errors recorded.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {ocr.data.commonErrors.map((e) => (
                    <li key={e.message} className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">{e.message}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5">{e.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="glass rounded-3xl p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold">Low-quality uploads</h2>
            {ocr.data.lowQuality.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blurry or low-confidence uploads detected.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">File</th>
                      <th className="py-2">OCR confidence</th>
                      <th className="py-2">Image quality</th>
                      <th className="py-2">Blur score</th>
                      <th className="py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocr.data.lowQuality.map((x) => (
                      <tr key={x.id} className="border-t border-border/60">
                        <td className="py-2 max-w-[240px] truncate">{x.file_name}</td>
                        <td className="py-2">{x.ocr_confidence != null ? `${Math.round(Number(x.ocr_confidence) * 100)}%` : "—"}</td>
                        <td className="py-2">{x.image_quality != null ? `${Math.round(Number(x.image_quality) * 100)}%` : "—"}</td>
                        <td className="py-2">{x.blur_score != null ? Number(x.blur_score).toFixed(2) : "—"}</td>
                        <td className="py-2">{new Date(x.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
