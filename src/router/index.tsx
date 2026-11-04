import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ScanLine, ShieldCheck, Sparkles, Activity, FileText, Users, Zap, Lock,
  Stethoscope, Pill, AlertTriangle, ArrowRight, Check, Brain, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediScan AI — Smart Prescription Analyzer for Doctors, Pharmacists & Patients" },
      { name: "description", content: "Upload handwritten prescriptions and get AI-extracted medicines, dosage, warnings, and drug interaction reports in seconds. HIPAA-mindful, secure, fast." },
      { property: "og:title", content: "MediScan AI — Smart Prescription Analyzer" },
      { property: "og:description", content: "AI-powered OCR + drug interaction checks for handwritten prescriptions. Built for doctors, pharmacists, and patients." },
    ],
  }),
  component: Landing,
});

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-hero shadow-glow">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            MediScan<span className="gradient-text">AI</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" search={{ mode: "login" as const }}>
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" as const }}>
            <Button size="sm" className="rounded-full gradient-hero text-primary-foreground shadow-glow border-0">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32">
      <div className="absolute inset-0 mesh-bg" />
      <div className="relative mx-auto max-w-6xl px-4 text-center md:px-8">
        <motion.div {...fade}>
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by Gemini Vision AI
          </span>
        </motion.div>
        <motion.h1
          {...fade}
          transition={{ ...fade.transition, delay: 0.1 }}
          className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"
          style={{ fontFamily: "Space Grotesk, sans-serif" }}
        >
          Turn any prescription into a <span className="gradient-text">safe, structured report</span>
        </motion.h1>
        <motion.p
          {...fade}
          transition={{ ...fade.transition, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl"
        >
          Upload a handwritten prescription. Our AI extracts medicines, detects dosage risks, duplicates, and dangerous drug interactions — in seconds.
        </motion.p>
        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link to="/auth" search={{ mode: "signup" as const }}>
            <Button size="lg" className="rounded-full gradient-hero text-primary-foreground shadow-glow border-0 h-12 px-7">
              Analyze a prescription <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#how">
            <Button size="lg" variant="outline" className="rounded-full h-12 px-7">
              See how it works
            </Button>
          </a>
        </motion.div>
        <motion.div
          {...fade}
          transition={{ ...fade.transition, delay: 0.4 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
        >
          {["HIPAA-mindful", "End-to-end encrypted", "SOC2 patterns", "Owned by you"].map(t => (
            <span key={t} className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> {t}
            </span>
          ))}
        </motion.div>

        {/* Preview card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mx-auto mt-16 max-w-4xl"
        >
          <div className="glass rounded-3xl p-2 shadow-glow">
            <div className="rounded-2xl bg-card p-6 text-left md:p-8">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl gradient-hero">
                  <FileText className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Prescription — Dr. A. Patel</p>
                  <p className="text-xs text-muted-foreground">Analyzed in 3.2s · 98% confidence</p>
                </div>
                <span className="ml-auto rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">Low risk</span>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  { name: "Amoxicillin 500mg", dose: "1 cap · 3× daily · 7 days", tag: "Antibiotic" },
                  { name: "Paracetamol 650mg", dose: "1 tab · as needed", tag: "Analgesic" },
                  { name: "Pantoprazole 40mg", dose: "1 tab · morning · 14 days", tag: "PPI" },
                  { name: "Cetirizine 10mg", dose: "1 tab · night", tag: "Antihistamine" },
                ].map(m => (
                  <div key={m.name} className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                    <Pill className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.dose}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{m.tag}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground/70" />
                <p className="text-warning-foreground/80"><b>AI note:</b> Take Pantoprazole 30 min before food. No dangerous interactions detected.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: ScanLine, title: "AI OCR", body: "Read even messy handwriting with Gemini Vision — deskewing, denoising, and sharpening built-in." },
  { icon: Brain, title: "Smart extraction", body: "Structured medicines, dosage, frequency, duration, and patient/doctor metadata." },
  { icon: AlertTriangle, title: "Interaction detection", body: "Flag dangerous drug-drug combinations and duplicated therapy across the prescription." },
  { icon: ClipboardCheck, title: "Confidence scoring", body: "Every field carries a confidence value so clinicians know exactly what to double-check." },
  { icon: Lock, title: "Private by design", body: "Row-level security, encrypted storage, and role-based access for users, doctors, pharmacists." },
  { icon: Zap, title: "Sub-5s reports", body: "From upload to full analysis in under 5 seconds on average." },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-24 md:px-8">
      <motion.div {...fade} className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Everything you need for <span className="gradient-text">safer prescriptions</span>
        </h2>
        <p className="mt-4 text-muted-foreground">A clinical-grade toolkit that fits inside a beautiful modern SaaS.</p>
      </motion.div>
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            {...fade}
            transition={{ ...fade.transition, delay: i * 0.05 }}
            className="group rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:shadow-glow"
          >
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl gradient-hero shadow-glow">
              <f.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: FileText, title: "Upload", body: "Drag a photo, PDF or use your camera." },
    { icon: ScanLine, title: "Preprocess", body: "We deskew, denoise and sharpen automatically." },
    { icon: Brain, title: "Analyze", body: "Gemini Vision extracts medicines and checks safety." },
    { icon: ClipboardCheck, title: "Report", body: "Get a shareable, printable structured report." },
  ];
  return (
    <section id="how" className="relative py-24">
      <div className="absolute inset-0 mesh-bg opacity-70" />
      <div className="relative mx-auto max-w-6xl px-4 md:px-8">
        <motion.div {...fade} className="text-center">
          <h2 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            From paper to precision — in <span className="gradient-text">4 steps</span>
          </h2>
        </motion.div>
        <div className="mt-14 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div key={s.title} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }}
              className="glass rounded-3xl p-6 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl gradient-hero shadow-glow">
                <s.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-primary">Step {i + 1}</div>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    { name: "Dr. Meera Iyer", role: "General Physician", quote: "It reads my worst handwriting better than my interns do." },
    { name: "Rahul K.", role: "Pharmacist", quote: "The interaction flags saved a customer from a serious mistake last week." },
    { name: "Priya S.", role: "Patient", quote: "I finally understand what's on my mom's prescriptions." },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 md:px-8">
      <motion.div {...fade} className="text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Trusted by <span className="gradient-text">clinicians & patients</span>
        </h2>
      </motion.div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {items.map((t, i) => (
          <motion.div key={t.name} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }}
            className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <p className="text-base leading-relaxed">"{t.quote}"</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full gradient-hero text-sm font-semibold text-primary-foreground">
                {t.name.split(" ").map(x => x[0]).join("")}
              </div>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    { name: "Free", price: "$0", desc: "For patients & personal use", features: ["10 analyses / month", "Basic warnings", "Secure history"] },
    { name: "Pro", price: "$19", desc: "For doctors & pharmacists", features: ["Unlimited analyses", "Interaction database", "PDF export & share links", "Priority support"], featured: true },
    { name: "Clinic", price: "Custom", desc: "For hospitals & networks", features: ["Team accounts", "Admin dashboard", "Audit logs", "SLA + SSO"] },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-24 md:px-8">
      <motion.div {...fade} className="text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Simple, <span className="gradient-text">honest pricing</span>
        </h2>
      </motion.div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <motion.div key={t.name} {...fade}
            className={`rounded-3xl border p-8 ${t.featured ? "gradient-hero text-primary-foreground shadow-glow border-transparent" : "bg-card border-border shadow-soft"}`}>
            <p className={`text-sm font-semibold ${t.featured ? "opacity-90" : "text-primary"}`}>{t.name}</p>
            <p className="mt-2 text-4xl font-bold" style={{ fontFamily: "Space Grotesk, sans-serif" }}>{t.price}<span className="text-base font-normal opacity-70">{t.price === "Custom" ? "" : "/mo"}</span></p>
            <p className={`mt-2 text-sm ${t.featured ? "opacity-90" : "text-muted-foreground"}`}>{t.desc}</p>
            <ul className="mt-6 space-y-2 text-sm">
              {t.features.map(f => (
                <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4" /> {f}</li>
              ))}
            </ul>
            <Link to="/auth" search={{ mode: "signup" as const }}>
              <Button className={`mt-8 w-full rounded-full ${t.featured ? "bg-background text-foreground hover:bg-background/90" : "gradient-hero text-primary-foreground border-0"}`}>Get started</Button>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    { q: "Is my medical data private?", a: "Yes. All uploads are stored in an encrypted private bucket with row-level security. Only you (and clinicians you share with) can access them." },
    { q: "How accurate is the OCR?", a: "Gemini Vision achieves 95%+ accuracy on legible prescriptions and around 85–90% on difficult handwriting. Every field carries a confidence score." },
    { q: "Which file types are supported?", a: "Photos (JPG, PNG, HEIC), PDFs, and direct camera capture. Files up to 20 MB." },
    { q: "Can I share reports with my doctor?", a: "Yes — generate a secure, expiring link. The recipient never needs an account." },
    { q: "Is this a medical device?", a: "No. MediScan AI is an assistive tool. Always consult a licensed clinician before making treatment decisions." },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-24 md:px-8">
      <motion.div {...fade} className="text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Frequently asked <span className="gradient-text">questions</span>
        </h2>
      </motion.div>
      <Accordion type="single" collapsible className="mt-12 space-y-3">
        {items.map((i) => (
          <AccordionItem key={i.q} value={i.q} className="rounded-2xl border border-border bg-card px-5 shadow-soft">
            <AccordionTrigger className="text-left text-base font-semibold">{i.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{i.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-24 md:px-8">
      <motion.div {...fade} className="relative overflow-hidden rounded-3xl gradient-hero p-10 text-center text-primary-foreground shadow-glow md:p-16">
        <Activity className="absolute -right-8 -top-8 h-40 w-40 opacity-20" />
        <h2 className="text-3xl font-bold md:text-5xl" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
          Ready for safer prescriptions?
        </h2>
        <p className="mx-auto mt-4 max-w-xl opacity-90">Create your free account and analyze your first prescription in under a minute.</p>
        <Link to="/auth" search={{ mode: "signup" as const }}>
          <Button size="lg" className="mt-8 rounded-full bg-background text-foreground hover:bg-background/90 h-12 px-8">
            Get started free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row md:px-8">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg gradient-hero">
            <Stethoscope className="h-4 w-4 text-primary-foreground" />
          </div>
          <span>© {new Date().getFullYear()} MediScan AI. All rights reserved.</span>
        </div>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
