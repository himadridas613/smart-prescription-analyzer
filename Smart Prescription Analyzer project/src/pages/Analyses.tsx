import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { FileText, Loader2 } from "lucide-react";

interface AnalysisItem {
  id: string;
  ats_score: number;
  job_readiness_score: number;
  recommended_departments: string[];
  qualification_status: string;
  created_at: string;
  resume: { file_name: string };
}

export default function Analyses() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("analyses")
      .select("id, ats_score, job_readiness_score, recommended_departments, qualification_status, created_at, resume:resumes(file_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAnalyses((data as any) || []);
        setLoading(false);
      });
  }, [user]);

  const statusColor = (s: string) => {
    if (s === "qualified") return "text-success bg-success/10";
    if (s === "not_qualified") return "text-destructive bg-destructive/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Analyses</h1>
          <p className="text-muted-foreground mt-1">All your resume analysis results.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No analyses yet. Upload a resume to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {analyses.map((a) => (
              <Link
                key={a.id}
                to={`/analysis/${a.id}`}
                className="glass-card rounded-xl p-5 flex items-center justify-between hover:shadow-md transition-shadow block"
              >
                <div className="flex items-center gap-4">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">{a.resume?.file_name || "Resume"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {a.recommended_departments?.[0] || "—"}
                  </span>
                  <div className="text-right">
                    <div className="text-lg font-bold text-foreground">{a.ats_score}</div>
                    <div className="text-xs text-muted-foreground">ATS</div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColor(a.qualification_status)}`}>
                    {a.qualification_status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
