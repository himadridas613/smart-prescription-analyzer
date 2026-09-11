import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { ScoreRing } from "@/components/ScoreRing";
import { SkillBadge } from "@/components/SkillBadge";
import { Loader2, ArrowLeft, Briefcase, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

interface AnalysisData {
  id: string;
  ats_score: number;
  job_readiness_score: number;
  skill_match_percentage: number;
  recommended_departments: string[];
  technical_skills: string[];
  soft_skills: string[];
  tools: string[];
  certifications: string[];
  projects: { project_name: string; level: string; impact_score: string; remarks: string }[];
  missing_skills: string[];
  suggested_roles: string[];
  hr_summary: string;
  qualification_status: string;
  created_at: string;
}

export default function AnalysisResult() {
  const { id } = useParams();
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from("analyses")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setAnalysis(data as unknown as AnalysisData);
        setLoading(false);
      });
  }, [user, id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!analysis) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Analysis not found.</p>
          <Link to="/dashboard"><Button variant="outline" className="mt-4">Back to Dashboard</Button></Link>
        </div>
      </DashboardLayout>
    );
  }

  const radarData = [
    { subject: "ATS", value: analysis.ats_score },
    { subject: "Readiness", value: analysis.job_readiness_score },
    { subject: "Skill Match", value: analysis.skill_match_percentage },
    { subject: "Technical", value: Math.min(analysis.technical_skills.length * 10, 100) },
    { subject: "Tools", value: Math.min(analysis.tools.length * 12, 100) },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Link to="/analyses">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Analysis Results</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(analysis.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}
            </p>
          </div>
        </div>

        {/* Scores */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Performance Scores</h2>
          <div className="flex flex-wrap justify-center gap-10">
            <ScoreRing score={analysis.ats_score} label="ATS Score" />
            <ScoreRing score={analysis.job_readiness_score} label="Job Readiness" />
            <ScoreRing score={analysis.skill_match_percentage} label="Skill Match" />
          </div>
        </div>

        {/* Departments & Roles */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Recommended Departments
            </h2>
            <div className="flex flex-wrap gap-2">
              {analysis.recommended_departments.map((d) => (
                <span key={d} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Suggested Roles</h2>
            <div className="flex flex-wrap gap-2">
              {analysis.suggested_roles.map((r) => (
                <span key={r} className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-sm font-medium">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Technical Skills</h2>
            <div className="flex flex-wrap gap-2">
              {analysis.technical_skills.map((s) => <SkillBadge key={s} skill={s} variant="technical" />)}
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Soft Skills</h2>
            <div className="flex flex-wrap gap-2">
              {analysis.soft_skills.map((s) => <SkillBadge key={s} skill={s} variant="soft" />)}
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Tools & Technologies</h2>
            <div className="flex flex-wrap gap-2">
              {analysis.tools.map((t) => <SkillBadge key={t} skill={t} variant="tool" />)}
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Missing Skills</h2>
            <div className="flex flex-wrap gap-2">
              {analysis.missing_skills.map((s) => <SkillBadge key={s} skill={s} variant="missing" />)}
            </div>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Profile Overview</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Projects */}
        {analysis.projects.length > 0 && (
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Projects</h2>
            <div className="space-y-4">
              {analysis.projects.map((p, i) => (
                <div key={i} className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-foreground">{p.project_name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.level}</span>
                      <span className="text-sm font-semibold text-foreground">{p.impact_score}/10</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{p.remarks}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HR Summary */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">HR Summary</h2>
          <p className="text-muted-foreground leading-relaxed">{analysis.hr_summary}</p>
          <div className="mt-4 flex items-center gap-2">
            {analysis.qualification_status === "qualified" ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Qualified Candidate</span>
              </div>
            ) : analysis.qualification_status === "not_qualified" ? (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-semibold">Needs Improvement</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Pending Review</span>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
