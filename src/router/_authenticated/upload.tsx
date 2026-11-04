import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzePrescription } from "@/lib/analyze.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, FileText, X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload prescription — MediScan AI" },
      { name: "description", content: "Upload a prescription image or PDF and let AI extract every medicine and warning." },
      { property: "og:title", content: "Upload prescription — MediScan AI" },
      { property: "og:description", content: "Upload a prescription for AI analysis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UploadPage,
});

const MAX_MB = 20;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

function UploadPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzePrescription);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "analyzing">("idle");
  const [dragging, setDragging] = useState(false);

  const onFile = useCallback((f: File) => {
    if (!ACCEPT.includes(f.type)) { toast.error("Unsupported file type."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`File must be under ${MAX_MB}MB.`); return; }
    setFile(f);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else setPreview(null);
  }, []);

  const run = async () => {
    if (!file) return;
    try {
      setPhase("uploading");
      setProgress(15);
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("prescriptions").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (up.error) throw up.error;
      setProgress(45);

      // Convert to base64 for the AI call
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setProgress(65);
      setPhase("analyzing");

      const result = await analyze({
        data: {
          storagePath: path,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileBase64: base64,
        },
      });
      setProgress(100);
      toast.success("Analysis complete!");
      navigate({ to: "/reports/$id", params: { id: result.reportId } });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Analysis failed. Please try again.";
      toast.error(message);
      setPhase("idle");
      setProgress(0);
    }
  };

  const busy = phase !== "idle";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>Upload prescription</h1>
        <p className="mt-1 text-muted-foreground">Photos, PDFs, or camera. Max {MAX_MB}MB.</p>
      </div>

      {!file && (
        <label
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
          }}
          className={`glass block cursor-pointer rounded-3xl border-2 border-dashed p-14 text-center transition ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        >
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl gradient-hero shadow-glow">
            <UploadCloud className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-lg font-semibold">Drop your prescription here</p>
          <p className="mt-1 text-sm text-muted-foreground">or click to browse — JPG, PNG, HEIC or PDF</p>
          <input type="file" className="hidden" accept={ACCEPT.join(",")} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      )}

      {file && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
              {preview ? <img src={preview} alt="preview" className="h-full w-full object-cover" /> : <FileText className="h-6 w-6 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}</p>
            </div>
            {!busy && (
              <Button variant="ghost" size="icon" onClick={() => { setFile(null); setPreview(null); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {busy && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">
                {phase === "uploading" && "Uploading securely…"}
                {phase === "analyzing" && "Running OCR and analyzing medicines…"}
              </p>
            </div>
          )}
          {preview && !busy && (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <img src={preview} alt="prescription preview" className="max-h-96 w-full object-contain bg-secondary" />
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={run} disabled={busy} className="rounded-full gradient-hero text-primary-foreground border-0 shadow-glow">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {busy ? "Analyzing…" : "Analyze with AI"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
