import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Upload, FileText, BarChart3, TrendingUp } from "lucide-react";

interface Analysis {
  id: string;
  ats_score: number;
  recommended_departments: string[];
  created_at: string;
  resume: { file_name: string };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("analyses")
      .select("id, ats_score, recommended_departments, created_at, resume:resumes(file_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setAnalyses((data as any) || []);
        setLoading(false);
      });
  }, [user]);

  const avgScore = analyses.length
    ? Math.round(analyses.reduce((sum, a) => sum + a.ats_score, 0) / analyses.length)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your resume analysis overview.</p>
        </div>

        {/* Stats cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Analyses</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{analyses.length}</div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-success" />
              </div>
              <span className="text-sm text-muted-foreground">Avg ATS Score</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{avgScore}</div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Top Department</span>
            </div>
            <div className="text-lg font-bold text-foreground truncate">
              {analyses[0]?.recommended_departments?.[0] || "—"}
            </div>
          </div>
        </div>

        {/* Quick action */}
        <div className="glass-card rounded-xl p-8 text-center">
          <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Upload a Resume</h3>
          <p className="text-sm text-muted-foreground mb-4">Get instant AI-powered analysis and scoring</p>
          <Link to="/upload">
            <Button className="gap-2">
              <Upload className="h-4 w-4" /> Upload Resume
            </Button>
          </Link>
        </div>

        {/* Recent analyses */}
        {analyses.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Recent Analyses</h2>
            <div className="space-y-3">
              {analyses.map((a) => (
                <Link
                  key={a.id}
                  to={`/analysis/${a.id}`}
                  className="glass-card rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow block"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-foreground text-sm">{a.resume?.file_name || "Resume"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      {a.recommended_departments?.[0] || "N/A"}
                    </span>
                    <span className="text-lg font-bold text-foreground">{a.ats_score}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
