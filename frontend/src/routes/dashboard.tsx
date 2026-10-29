import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  UploadCloud,
  FileText,
  Printer,
  Copy,
  Check,
  Send,
  Loader2,
  AlertTriangle,
  Scale,
  Bot,
  ExternalLink,
  Search,
  Filter,
  Sparkles,
  Info,
  ChevronRight,
  BookOpen,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import { BillUploadModal } from "@/components/bill-upload-modal";
import {
  AuditReportResponse,
  AuditFinding,
  StatutoryRule,
  ChatMessage,
  runDemoAudit,
  askAIChat,
  generateDisputeLetter,
  fetchStatutoryRules,
  fetchHealth,
} from "@/lib/api";
import { fmtINR } from "@/lib/demo-audit";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Hospital Bill Audit Dashboard — BillShielder" },
      {
        name: "description",
        content:
          "Real-time itemized audit dashboard: statutory rate caps, unbundled charges, AI patient advocate and printable dispute letters.",
      },
    ],
  }),
  component: Dashboard,
});

const navItems = [
  "Dashboard",
  "Findings",
  "Assistant",
  "Action center",
  "Regulations",
] as const;

type NavItem = (typeof navItems)[number];

const QUICK_PROMPTS = [
  "Why was the ICU surcharge flagged?",
  "Can the hospital charge for biomedical waste disposal?",
  "What questions should I ask the billing desk?",
  "How do I file a dispute under CGHS rate ceilings?",
];

function Dashboard() {
  const [activeNav, setActiveNav] = useState<NavItem>("Dashboard");

  // Audit Report State
  const [report, setReport] = useState<AuditReportResponse | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  // Selected Finding for detailed modal inspection
  const [selectedFinding, setSelectedFinding] = useState<AuditFinding | null>(null);

  // Findings Filter & Search
  const [findingSeverityFilter, setFindingSeverityFilter] = useState<string>("ALL");
  const [findingSearchQuery, setFindingSearchQuery] = useState<string>("");

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your AI Patient Advocate. I can explain any flagged charge, verify statutory rate ceilings, and guide you on disputing hospital overcharges. Ask me anything about this bill.",
    },
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Dispute Letter State
  const [recipientTitle, setRecipientTitle] = useState<string>(
    "The Medical Superintendent / Patient Grievance Officer"
  );
  const [patientAddress, setPatientAddress] = useState<string>("New Delhi, India");
  const [disputeNotes, setDisputeNotes] = useState<string>(
    "Please issue a revised itemized bill removing the statutory excess charges identified above."
  );
  const [generatedLetterHtml, setGeneratedLetterHtml] = useState<string>("");
  const [generatedLetterMd, setGeneratedLetterMd] = useState<string>("");
  const [isGeneratingLetter, setIsGeneratingLetter] = useState<boolean>(false);
  const [copiedLetter, setCopiedLetter] = useState<boolean>(false);

  // Regulations Knowledge Base State
  const [regulations, setRegulations] = useState<StatutoryRule[]>([]);
  const [isLoadingRegulations, setIsLoadingRegulations] = useState<boolean>(false);
  const [regCategoryFilter, setRegCategoryFilter] = useState<string>("ALL");
  const [regSearchQuery, setRegSearchQuery] = useState<string>("");

  // System Health
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);

  // 1. Initial Load: Retrieve report from sessionStorage or execute initial demo audit
  useEffect(() => {
    fetchHealth()
      .then((h) => setIsBackendHealthy(h.status === "healthy"))
      .catch(() => setIsBackendHealthy(false));

    const cached = typeof window !== "undefined" ? sessionStorage.getItem("billshield_active_report") : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as AuditReportResponse;
        setReport(parsed);
        setIsLoadingReport(false);
        return;
      } catch {
        // invalid cache, fallback to demo audit
      }
    }

    // Fetch live demo audit from backend
    runDemoAudit()
      .then((rep) => {
        setReport(rep);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("billshield_active_report", JSON.stringify(rep));
        }
      })
      .catch((err) => {
        console.error("Failed to load initial audit report:", err);
      })
      .finally(() => {
        setIsLoadingReport(false);
      });
  }, []);

  // Update session storage whenever a new report is loaded
  const handleAuditComplete = (newReport: AuditReportResponse) => {
    setReport(newReport);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("billshield_active_report", JSON.stringify(newReport));
    }
    // Reset chat with report context
    setChatMessages([
      {
        role: "assistant",
        content: `I have analyzed the bill from **${newReport.hospital_name}**. We flagged **${newReport.findings_count} statutory discrepancies** totaling **${fmtINR(newReport.potential_savings)}** in potential savings. How would you like me to help you dispute these?`,
      },
    ]);
    // Reset dispute letter so it regenerates on demand
    setGeneratedLetterHtml("");
    setGeneratedLetterMd("");
  };

  // 2. Fetch Regulations when Regulations tab is opened
  useEffect(() => {
    if (activeNav === "Regulations" && regulations.length === 0) {
      setIsLoadingRegulations(true);
      fetchStatutoryRules()
        .then((rules) => {
          setRegulations(rules);
        })
        .catch((err) => {
          console.error("Error fetching statutory rules:", err);
        })
        .finally(() => {
          setIsLoadingRegulations(false);
        });
    }
  }, [activeNav, regulations.length]);

  // 3. Auto-generate Dispute Letter when Action Center tab is opened
  useEffect(() => {
    if (activeNav === "Action center" && report && !generatedLetterHtml) {
      handleGenerateDisputeLetter();
    }
  }, [activeNav, report]);

  // Send AI chat message
  const handleSendChat = async (userText?: string) => {
    const text = userText || chatInput.trim();
    if (!text || isChatLoading) return;

    const newHistory: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];
    setChatMessages(newHistory);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await askAIChat({
        message: text,
        bill: report?.normalized_bill ?? null,
        findings: report?.findings || [],
        history: newHistory,
      });

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Unable to consult AI backend: ${err.message || "Network error"}. Please ensure the backend is running.`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
      requestAnimationFrame(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  };

  // Generate Dispute Letter
  const handleGenerateDisputeLetter = async () => {
    if (!report) return;
    setIsGeneratingLetter(true);
    try {
      const res = await generateDisputeLetter({
        report,
        recipient_title: recipientTitle,
        patient_address: patientAddress,
        notes: disputeNotes,
      });
      setGeneratedLetterHtml(res.html_content);
      setGeneratedLetterMd(res.markdown_content);
    } catch (err: any) {
      console.error("Dispute letter generation failed:", err);
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  // Print Dispute Letter
  const printLetter = () => {
    if (!generatedLetterHtml && !report) return;
    const content = generatedLetterHtml || `<pre style="font-family: ui-monospace, monospace; white-space: pre-wrap; font-size: 13px; padding: 24px;">${generatedLetterMd}</pre>`;
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (doc) {
      doc.write(content);
      doc.close();
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    }
    window.setTimeout(() => frame.remove(), 2500);
  };

  // Copy Letter Text
  const copyLetterText = () => {
    if (!generatedLetterMd) return;
    navigator.clipboard.writeText(generatedLetterMd).then(() => {
      setCopiedLetter(true);
      setTimeout(() => setCopiedLetter(false), 2000);
    });
  };

  // Filtered findings for table
  const filteredFindings = (report?.findings || []).filter((f) => {
    const matchesSeverity =
      findingSeverityFilter === "ALL" ||
      f.severity.toUpperCase() === findingSeverityFilter.toUpperCase();
    const matchesSearch =
      !findingSearchQuery ||
      f.item_name.toLowerCase().includes(findingSearchQuery.toLowerCase()) ||
      f.rule_id.toLowerCase().includes(findingSearchQuery.toLowerCase()) ||
      (f.patient_explanation || "").toLowerCase().includes(findingSearchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  // Filtered regulations for knowledge base
  const filteredRegulations = regulations.filter((r) => {
    const matchesCategory =
      regCategoryFilter === "ALL" ||
      (r.category || "").toLowerCase() === regCategoryFilter.toLowerCase();
    const query = regSearchQuery.toLowerCase();
    const matchesSearch =
      !regSearchQuery ||
      (r.title || r.rule_name || "").toLowerCase().includes(query) ||
      (r.description || "").toLowerCase().includes(query) ||
      (r.legal_reference || "").toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const sharePercent = report && report.total_billed > 0
    ? ((report.potential_savings / report.total_billed) * 100).toFixed(1) + "%"
    : "0.0%";

  const stats = [
    {
      label: "Total Billed",
      value: report ? fmtINR(report.total_billed) : "₹0",
      tone: "text-primary",
      sub: "Gross hospital charge",
    },
    {
      label: "Review Discrepancies",
      value: report ? fmtINR(report.potential_savings) : "₹0",
      tone: "text-flagged",
      sub: `${sharePercent} of total bill under review`,
    },
    {
      label: "Benchmark Reference",
      value: report ? fmtINR(report.total_permissible) : "₹0",
      tone: "text-emerald-600",
      sub: "Reference benchmark total",
    },
    {
      label: "Flagged Line Items",
      value: report ? String(report.findings_count) : "0",
      tone: "text-primary",
      sub: "Discrepancies identified",
    },
  ];

  return (
    <div className="flex min-h-screen bg-hero">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col bg-navy-deep px-6 py-8 md:flex">
        <Link to="/" className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary-foreground" />
          <span className="text-lg font-bold text-primary-foreground">
            BillShielder
          </span>
        </Link>

        <div className="mt-6 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-3 text-xs text-primary-foreground/80">
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                isBackendHealthy ? "bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span className="font-semibold text-primary-foreground">
              {isBackendHealthy ? "Rule Engine Active" : "Offline Fallback"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-primary-foreground/60">
            10 checks active (37 rules catalogued)
          </p>
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-primary-foreground/50">
          Navigation
        </p>
        <nav className="mt-3 flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveNav(item)}
              className={`rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                activeNav === item
                  ? "bg-primary-foreground text-primary shadow-sm"
                  : "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Quick Upload Button in Sidebar */}
        <div className="mt-auto pt-6">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <UploadCloud className="size-4" />
            Audit Another Bill
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
                {activeNav === "Dashboard"
                  ? "Hospital Bill Audit"
                  : activeNav === "Findings"
                  ? "Itemized Statutory Findings"
                  : activeNav === "Assistant"
                  ? "AI Patient Advocate"
                  : activeNav === "Action center"
                  ? "Formal Dispute Center"
                  : "Healthcare Billing Regulations"}
              </h1>
              {isLoadingReport && (
                <Loader2 className="size-5 animate-spin text-primary" />
              )}
            </div>
            {report && (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {report.hospital_name}
                </span>{" "}
                {report.bill_number && `• Bill #${report.bill_number}`}{" "}
                {report.patient_name && `• Patient: ${report.patient_name}`}{" "}
                {report.ward_type && `• ${report.ward_type}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-navy-deep"
            >
              <UploadCloud className="size-4" />
              Upload Real Bill
            </button>
            <button
              onClick={() => {
                setActiveNav("Action center");
                if (generatedLetterHtml) printLetter();
              }}
              className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
            >
              <Printer className="size-4" />
              Dispute Letter
            </button>
          </div>
        </div>

        {/* Audit Provenance Banner */}
        {report && (
          <div
            className={`mt-4 rounded-xl border p-4 text-xs ${
              report.is_demo
                ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    report.is_demo
                      ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {report.is_demo
                    ? "DEMO DATA — NOT A REAL BILL AUDIT"
                    : "VERIFIED BACKEND AUDIT"}
                </span>
                <span className="font-semibold text-foreground">
                  Source: {report.source_filename || (report.is_demo ? "Synthetic Hospital Fixture" : "Uploaded Inpatient Document")}
                </span>
              </div>
              <span className="text-muted-foreground text-[11px]">
                {report.is_demo
                  ? "Synthetic test case for educational demonstration"
                  : "Deterministic Rule Engine evaluation complete"}
              </span>
            </div>
            {report.is_demo && (
              <p className="mt-2 text-muted-foreground leading-relaxed">
                This report was loaded from synthetic test fixtures to demonstrate the 10 automated audit checks. It does not represent an actual patient bill or verified financial liability.
              </p>
            )}
          </div>
        )}

        {/* 1. DASHBOARD VIEW */}
        {activeNav === "Dashboard" && (
          <div className="mt-6 space-y-8 animate-in fade-in duration-200">
            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                  <p className={`mt-2 text-3xl font-extrabold tracking-tight ${s.tone}`}>
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Findings Table + Side Assistant */}
            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              {/* Itemized Findings Overview */}
              <section className="min-w-0 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      Discrepancies Detected
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Click any row to inspect legal rule citations and calculations
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveNav("Findings")}
                    className="flex items-center text-xs font-semibold text-primary hover:underline"
                  >
                    View all {report?.findings_count || 0} findings{" "}
                    <ChevronRight className="size-3.5 ml-0.5" />
                  </button>
                </div>

                {/* Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                        <th className="px-3 py-2.5 font-semibold">Flagged Item</th>
                        <th className="px-3 py-2.5 font-semibold">Billed</th>
                        <th className="px-3 py-2.5 font-semibold">Review Discrepancy</th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          Severity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFindings.slice(0, 8).map((f) => (
                        <tr
                          key={f.finding_id}
                          onClick={() => setSelectedFinding(f)}
                          className="cursor-pointer border-b border-border transition-colors hover:bg-muted/40 last:border-0"
                        >
                          <td className="px-3 py-3">
                            <p className="font-semibold text-foreground">{f.item_name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {f.evidence_citation}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {fmtINR(f.billed_amount)}
                          </td>
                          <td className="px-3 py-3 font-bold text-flagged">
                            {fmtINR(f.excess_amount)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <SeverityBadge severity={f.severity} />
                          </td>
                        </tr>
                      ))}
                      {filteredFindings.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-muted-foreground">
                            No discrepancies found matching criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Live Side Assistant */}
              <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="size-5 text-primary" />
                    <h2 className="text-lg font-bold text-foreground">
                      Patient Advocate AI
                    </h2>
                  </div>
                  <button
                    onClick={() => setActiveNav("Assistant")}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open Full Chat
                  </button>
                </div>

                {/* Messages scroll */}
                <div
                  ref={chatScrollRef}
                  className="mt-3 flex max-h-[380px] flex-1 flex-col gap-3 overflow-y-auto pr-1"
                >
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={
                        m.role === "assistant"
                          ? "max-w-[92%] self-start rounded-2xl rounded-tl-md bg-secondary p-3.5 text-xs sm:text-sm leading-relaxed text-secondary-foreground"
                          : "max-w-[92%] self-end rounded-2xl rounded-tr-md bg-primary p-3.5 text-xs sm:text-sm leading-relaxed text-primary-foreground"
                      }
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-center gap-2 self-start rounded-xl bg-secondary px-3.5 py-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Consulting regulatory rule base...
                    </div>
                  )}
                </div>

                {/* Quick Prompts */}
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {QUICK_PROMPTS.slice(0, 2).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSendChat(q)}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="mt-3 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    placeholder="Ask about a charge..."
                    disabled={isChatLoading}
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3.5 py-2 text-xs sm:text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => handleSendChat()}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-navy-deep disabled:opacity-50"
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* 2. FINDINGS TAB VIEW */}
        {activeNav === "Findings" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-200">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-1 items-center gap-2 min-w-[240px]">
                <Search className="size-4 text-muted-foreground" />
                <input
                  value={findingSearchQuery}
                  onChange={(e) => setFindingSearchQuery(e.target.value)}
                  placeholder="Search finding name, citation, or rule ID..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Severity:
                </span>
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFindingSeverityFilter(sev)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      findingSeverityFilter === sev
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Findings Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              {filteredFindings.map((f) => (
                <div
                  key={f.finding_id}
                  onClick={() => setSelectedFinding(f)}
                  className="group cursor-pointer rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-mono font-semibold text-primary">
                        {f.rule_id}
                      </span>
                      <h3 className="mt-0.5 text-base font-bold text-foreground group-hover:text-primary">
                        {f.item_name}
                      </h3>
                    </div>
                    <SeverityBadge severity={f.severity} />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {f.patient_explanation || f.auditor_notes}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center text-xs">
                    <div>
                      <p className="text-muted-foreground">Billed</p>
                      <p className="font-semibold text-foreground">
                        {fmtINR(f.billed_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Permissible</p>
                      <p className="font-semibold text-emerald-600">
                        {fmtINR(f.permissible_amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Discrepancy</p>
                      <p className="font-bold text-flagged">
                        {fmtINR(f.excess_amount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-1 text-xs">
                    <span className="text-muted-foreground truncate max-w-[260px]">
                      {f.evidence_citation}
                    </span>
                    <span className="flex items-center font-semibold text-primary">
                      Inspect <ArrowRight className="size-3.5 ml-1" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. ASSISTANT TAB VIEW (FULL CHAT) */}
        {activeNav === "Assistant" && (
          <div className="mt-6 flex flex-col rounded-2xl border border-border bg-card shadow-sm h-[calc(100vh-220px)] animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bot className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    AI Patient Advocate & Billing Consultant
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Grounded in India healthcare statutes (CGHS, NPPA, Clinical Establishments Act)
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setChatMessages([
                    {
                      role: "assistant",
                      content:
                        "Conversation reset. What questions do you have about this hospital bill?",
                    },
                  ])
                }
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RefreshCw className="size-3.5" />
                Clear Chat
              </button>
            </div>

            {/* Chat Body */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${
                    m.role === "assistant" ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                      m.role === "assistant"
                        ? "rounded-tl-md bg-secondary text-secondary-foreground"
                        : "rounded-tr-md bg-primary text-primary-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground w-fit">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Reviewing statutory regulations & case precedents...
                </div>
              )}
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-2 border-t border-border px-6 py-3 bg-muted/20">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSendChat(q)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="border-t border-border p-4">
              <div className="flex gap-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Ask a question about any charge, ceiling rate, or dispute strategy..."
                  disabled={isChatLoading}
                  className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={() => handleSendChat()}
                  disabled={isChatLoading || !chatInput.trim()}
                  className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-navy-deep disabled:opacity-50"
                >
                  <Send className="size-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. ACTION CENTER TAB VIEW (DISPUTE LETTER) */}
        {activeNav === "Action center" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-200">
            {/* Header / Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Patient Dispute Dossier & Formal Demand Letter
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Statutory notice citing healthcare orders with demand for ₹
                  {report ? report.potential_savings.toLocaleString("en-IN") : "0"} refund within 7 working days.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyLetterText}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  {copiedLetter ? (
                    <>
                      <Check className="size-4 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copy Letter
                    </>
                  )}
                </button>
                <button
                  onClick={printLetter}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-navy-deep"
                >
                  <Printer className="size-4" />
                  Print / Save PDF
                </button>
              </div>
            </div>

            {/* Customization Options */}
            <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Recipient Authority Title
                </label>
                <input
                  value={recipientTitle}
                  onChange={(e) => setRecipientTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Patient Address / City
                </label>
                <input
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Letter Preview Screen */}
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-sm">
              {isGeneratingLetter ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="size-8 animate-spin text-primary" />
                </div>
              ) : generatedLetterHtml ? (
                <div
                  className="prose max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: generatedLetterHtml }}
                />
              ) : (
                <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground bg-muted/30 p-6 rounded-xl border border-border">
                  {generatedLetterMd || "Click generate to create formal dispute letter."}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. REGULATIONS TAB VIEW (STATUTORY RULES) */}
        {activeNav === "Regulations" && (
          <div className="mt-6 space-y-6 animate-in fade-in duration-200">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-1 items-center gap-2 min-w-[240px]">
                <Search className="size-4 text-muted-foreground" />
                <input
                  value={regSearchQuery}
                  onChange={(e) => setRegSearchQuery(e.target.value)}
                  placeholder="Search government regulation by title, order number, or keyword..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Category:
                </span>
                <select
                  value={regCategoryFilter}
                  onChange={(e) => setRegCategoryFilter(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">All Categories</option>
                  <option value="icu">ICU & Critical Care</option>
                  <option value="accommodation">Accommodation & Room Rent</option>
                  <option value="consumables">Medical Consumables & PPE</option>
                  <option value="overhead">Administrative Overhead</option>
                  <option value="implants">Implants & Devices (NPPA)</option>
                  <option value="pharmacy">Pharmacy & Drugs</option>
                </select>
              </div>
            </div>

            {/* Rules Cards */}
            {isLoadingRegulations ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredRegulations.map((rule) => (
                  <div
                    key={rule.rule_id}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-primary">
                          {rule.rule_id}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {rule.category}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-bold text-foreground">
                        {rule.title || rule.rule_name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {rule.description}
                      </p>
                    </div>

                    <div className="mt-4 border-t border-border pt-3 space-y-1 text-xs">
                      {rule.legal_reference && (
                        <p className="text-muted-foreground">
                          <strong className="text-foreground">Authority:</strong>{" "}
                          {rule.legal_reference}
                        </p>
                      )}
                      {rule.rate_ceiling != null && (
                        <p className="text-emerald-600 font-semibold">
                          Reference Benchmark Ceiling: {fmtINR(rule.rate_ceiling)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Itemized Finding Detailed Inspection Modal */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setSelectedFinding(null)}
              className="absolute right-5 top-5 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ✕
            </button>
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                {selectedFinding.rule_id}
              </span>
              <SeverityBadge severity={selectedFinding.severity} />
            </div>

            <h3 className="mt-3 text-xl font-bold text-foreground">
              {selectedFinding.item_name}
            </h3>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center text-xs">
              <div>
                <p className="text-muted-foreground">Billed Amount</p>
                <p className="mt-1 font-bold text-foreground">
                  {fmtINR(selectedFinding.billed_amount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Benchmark Ceiling</p>
                <p className="mt-1 font-bold text-emerald-600">
                  {fmtINR(selectedFinding.permissible_amount)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Review Discrepancy</p>
                <p className="mt-1 font-bold text-flagged">
                  {fmtINR(selectedFinding.excess_amount)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed">
              <div>
                <strong className="text-foreground">Regulatory Authority Reference:</strong>
                <p className="mt-0.5 text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                  {selectedFinding.evidence_citation}
                </p>
              </div>
              <div>
                <strong className="text-foreground">Patient Explanation:</strong>
                <p className="mt-0.5 text-muted-foreground">
                  {selectedFinding.patient_explanation}
                </p>
              </div>
              {selectedFinding.recommended_action && (
                <div>
                  <strong className="text-foreground">Recommended Action:</strong>
                  <p className="mt-0.5 text-emerald-600 font-semibold">
                    {selectedFinding.recommended_action}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedFinding(null);
                  setActiveNav("Assistant");
                  handleSendChat(`Why was '${selectedFinding.item_name}' flagged as an overcharge?`);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-navy-deep"
              >
                <Bot className="size-3.5" />
                Ask AI About This
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Upload / Scan Modal */}
      <BillUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAuditComplete={handleAuditComplete}
      />
    </div>
  );
}
