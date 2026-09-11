import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, BarChart3, Shield, Zap, ArrowRight, CheckCircle } from "lucide-react";

const features = [
  { icon: FileText, title: "Smart Parsing", desc: "Upload PDF or DOCX and we extract every detail automatically." },
  { icon: BarChart3, title: "ATS Scoring", desc: "Get a real ATS compatibility score with actionable feedback." },
  { icon: Shield, title: "Skill Analysis", desc: "Deep evaluation of technical skills, tools, and certifications." },
  { icon: Zap, title: "AI Predictions", desc: "Predict best-fit departments and roles using advanced AI." },
];

const stats = [
  { value: "98%", label: "Accuracy" },
  { value: "50+", label: "Departments" },
  { value: "10s", label: "Analysis Time" },
  { value: "500+", label: "Skills Tracked" },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass-card border-b">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold gradient-text">ResumeAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="container relative text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Resume Intelligence
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-foreground">
            Analyze Resumes with{" "}
            <span className="gradient-text">AI Precision</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Upload any resume and get instant ATS scores, skill analysis, department predictions, and actionable hiring insights.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gap-2 px-8">
                Start Analyzing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="container grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold gradient-text">{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-3">Everything You Need</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Comprehensive resume analysis powered by state-of-the-art AI models.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="glass-card rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/30 border-y border-border">
        <div className="container max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-10">How It Works</h2>
          <div className="space-y-6 text-left">
            {["Upload your resume in PDF or DOCX format", "AI extracts and analyzes every detail", "Get instant scores, predictions, and recommendations"].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary-foreground">{i + 1}</span>
                </div>
                <div>
                  <p className="text-foreground font-medium">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container max-w-xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">Join thousands of professionals using AI to optimize their hiring process.</p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="gap-2 px-8">
              Create Free Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-semibold gradient-text">ResumeAI</span>
          </div>
          <span>© {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
