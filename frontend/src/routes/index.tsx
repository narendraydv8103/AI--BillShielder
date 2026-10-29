import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  AlignLeft,
  FileSearch,
  FileText,
  MessageSquareText,
  Scale,
  ShieldCheck,
  UploadCloud,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import { BillUploadModal } from "@/components/bill-upload-modal";
import {
  fmtINR,
  heroFindings,
  sampleAuditRows,
  statsBand,
  steps,
  features,
} from "@/lib/demo-audit";
import { fetchHealth, runDemoAudit, AuditReportResponse } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BillShielder — Hospital Bill Audit for India" },
      {
        name: "description",
        content:
          "Upload an itemized hospital bill. BillShielder checks the arithmetic, repeated charges and tariff ceilings, then shows each finding with the rule behind it.",
      },
      {
        property: "og:title",
        content: "BillShielder — Hospital Bill Audit for India",
      },
      {
        property: "og:description",
        content:
          "Know what every rupee on your hospital bill is for. Upload a bill and get plain-language findings with citations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "BillShielder — Hospital Bill Audit for India",
      },
      {
        name: "twitter:description",
        content:
          "Know what every rupee on your hospital bill is for. Upload a bill and get plain-language findings with citations.",
      },
    ],
  }),
  component: Index,
});

const featureIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "align-left": AlignLeft,
  scale: Scale,
  "file-search": FileSearch,
  message: MessageSquareText,
  "file-text": FileText,
  activity: Activity,
};

function Index() {
  const navigate = useNavigate();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean | null>(null);
  const [isQuickDemoRunning, setIsQuickDemoRunning] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((h) => setIsBackendConnected(h.status === "healthy"))
      .catch(() => setIsBackendConnected(false));
  }, []);

  const handleAuditComplete = (report: AuditReportResponse) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("billshield_active_report", JSON.stringify(report));
    }
    navigate({ to: "/dashboard" });
  };

  const handleLaunchSampleAudit = async () => {
    setIsQuickDemoRunning(true);
    try {
      const report = await runDemoAudit();
      handleAuditComplete(report);
    } catch {
      // If error, open dashboard directly
      navigate({ to: "/dashboard" });
    } finally {
      setIsQuickDemoRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <span className="text-xl font-bold tracking-tight text-primary">
              BillShielder
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Rules &amp; checks
            </a>
            <a
              href="#sample-audit"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sample audit
            </a>
            <a
              href="#responsible-ai"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Responsible AI
            </a>
          </nav>
          <div className="flex items-center gap-3">
            {isBackendConnected !== null && (
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 sm:inline-flex">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                Rule Engine Online
              </span>
            )}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-navy-deep"
            >
              <UploadCloud className="size-4" />
              Audit my bill
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold tracking-widest text-primary uppercase">
              <Sparkles className="size-3.5" />
              Healthcare Bill Audit & Discrepancy Detection
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight text-primary lg:text-6xl">
              Know what every rupee on your hospital bill is for.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              Upload an itemized bill. BillShielder evaluates 10 executable audit checks grounded in 37 catalogued regulatory benchmarks (CGHS, NPPA, IRDAI) to flag arithmetic errors, unbundled charges, and rate variances.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-navy-deep hover:shadow-lg"
              >
                <UploadCloud className="size-4" />
                Upload a bill (PDF / Photo)
              </button>
              <button
                onClick={handleLaunchSampleAudit}
                disabled={isQuickDemoRunning}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-6 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <Sparkles className="size-4" />
                {isQuickDemoRunning ? "Analyzing..." : "1-Click Synthetic ICU Audit"}
              </button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Zero sign-up required • 100% private &amp; deterministic
            </p>
          </div>

          {/* Flagged summary card */}
          <div
            onClick={handleLaunchSampleAudit}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/5 transition-all hover:border-primary/50 hover:shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Flagged for review (Live Demo Case)
                </span>
                <p className="text-xs text-muted-foreground">Apollo Hospital • ICU Stay</p>
              </div>
              <span className="rounded-full bg-flagged-soft px-3 py-1 text-xs font-bold text-flagged">
                44.3% of ₹1,01,540
              </span>
            </div>
            <p className="mt-2 text-5xl font-extrabold tracking-tight text-flagged">
              ₹45,000
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Calculated discrepancies identified against published reference benchmarks
            </p>
            <ul className="mt-6 divide-y divide-border">
              {heroFindings.map((f) => (
                <li
                  key={f.item}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {f.item}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-foreground">
                      {fmtINR(f.excess)}
                    </span>
                    <SeverityBadge severity={f.severity} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
              <span>Inspect full audit report &amp; dispute letter</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="bg-navy-deep">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {statsBand.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl font-extrabold text-primary-foreground">
                {s.value}
              </p>
              <p className="mt-2 text-sm text-primary-foreground/80">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-background">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-4xl font-extrabold tracking-tight text-primary">
            From PDF to plain-language findings
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Four steps, each one traceable back to statutory orders and the original bill pages.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-xl font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-hero">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="text-4xl font-extrabold tracking-tight text-primary">
            Built so every flag can be checked
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Numbers and citations come from deterministic code and official government gazette rules. The
            language model only explains.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = featureIcons[f.icon] || FileText;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-icon-tile text-icon-tile-foreground">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sample audit */}
      <section id="sample-audit" className="bg-hero">
        <div className="mx-auto max-w-7xl px-6 pb-20">
          <h2 className="text-4xl font-extrabold tracking-tight text-primary">
            A sample audit
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            ICU bill from the built-in demo set. Amounts above reference benchmarks are shown as the review excess.
          </p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-muted-foreground">
                  <th className="px-6 py-3.5 font-semibold">Item</th>
                  <th className="px-4 py-3.5 font-semibold">Billed</th>
                  <th className="px-4 py-3.5 font-semibold">Benchmark</th>
                  <th className="px-4 py-3.5 font-semibold">Excess</th>
                  <th className="px-4 py-3.5 font-semibold">Rule</th>
                  <th className="px-6 py-3.5 text-right font-semibold">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody>
                {sampleAuditRows.map((row) => (
                  <tr key={row.item} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 text-foreground">{row.item}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {fmtINR(row.billed)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {fmtINR(row.benchmark)}
                    </td>
                    <td className="px-4 py-4 font-bold text-foreground">
                      {fmtINR(row.excess)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{row.rule}</td>
                    <td className="px-6 py-4 text-right">
                      <SeverityBadge severity={row.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Responsible by design */}
      <section id="responsible-ai" className="bg-hero">
        <div className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm lg:p-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-primary">
              Responsible by design
            </h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
              BillShielder is a consumer-awareness tool. It flags discrepancies
              for you to raise with the hospital or insurer. It does not give
              legal advice, and it never accuses a hospital or doctor of
              wrongdoing. Benchmarks are review thresholds, not claimed legal
              limits.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-hero">
        <div className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-3xl bg-navy-deep px-6 py-16 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight text-primary-foreground">
              Check your bill before you pay it
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              Upload your bill or test pre-configured hospital cases in 1 click.
            </p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary-foreground px-6 py-3 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
            >
              <UploadCloud className="size-4" />
              Upload a bill now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-6 py-8 text-center text-sm text-muted-foreground">
          BillShielder · IPS Academy, Institute of Engineering &amp; Science,
          Indore · SNGCCSD 2026
        </div>
      </footer>

      {/* Bill Upload Modal */}
      <BillUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAuditComplete={handleAuditComplete}
      />
    </div>
  );
}
