"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  fetchHealth,
  fetchSampleBills,
  fetchSampleBillById,
  analyzeBillData,
  uploadAndAnalyzeFile,
  triggerDemoAudit,
  askAIAssistant,
  generateDisputeLetter,
  fetchStatutoryRules,
  HealthStatus,
  SampleBillMeta,
  NormalizedBill,
  AuditReport,
  AuditFinding,
  ChatMessage,
  AuditChatResponse,
  DisputeLetterResponse,
  StatutoryRule,
} from "@/lib/api";

type ActiveTab = "upload" | "dashboard" | "findings" | "assistant" | "action-center" | "regulations";

const SCAN_STEPS = [
  "Reading your document...",
  "Finding charges and totals...",
  "Checking the calculations...",
  "Comparing items with the selected rules...",
  "Preparing your review...",
];

export default function Home() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>("upload");

  // Health & System state
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);

  // Sample Bills & Rules
  const [sampleBills, setSampleBills] = useState<SampleBillMeta[]>([]);
  const [rules, setRules] = useState<StatutoryRule[]>([]);
  const [selectedRuleCategory, setSelectedRuleCategory] = useState<string>("ALL");
  const [ruleSearchQuery, setRuleSearchQuery] = useState<string>("");

  // Audit Execution State
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [currentBill, setCurrentBill] = useState<NormalizedBill | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [scanStepIndex, setScanStepIndex] = useState<number>(0);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stateJurisdiction, setStateJurisdiction] = useState<string>("Delhi");
  const [billingScheme, setBillingScheme] = useState<string>("CGHS");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Itemized Findings Filter
  const [findingFilter, setFindingFilter] = useState<string>("ALL");

  // AI Assistant Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! Upload a bill, try a demo, or ask about a charge. I can explain the calculation and the rule behind each flagged item.",
    },
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Dispute Letter State
  const [disputeLetter, setDisputeLetter] = useState<DisputeLetterResponse | null>(null);
  const recipientTitle = "The Medical Superintendent / TPA Grievance Desk";
  const disputeNotes = "";
  const [isGeneratingLetter, setIsGeneratingLetter] = useState<boolean>(false);
  const [letterCopied, setLetterCopied] = useState<boolean>(false);

  // 1. Initial Load: Health, Sample Bills, Rules
  useEffect(() => {
    async function initData() {
      setHealthLoading(true);
      try {
        const h = await fetchHealth();
        setHealth(h);
      } catch {
        setHealth(null);
      } finally {
        setHealthLoading(false);
      }

      try {
        const sBills = await fetchSampleBills();
        setSampleBills(sBills);
      } catch {
        // Fallback default sample bill names if offline
      }

      try {
        const rList = await fetchStatutoryRules();
        setRules(rList);
      } catch {
        // Keep empty if failed
      }
    }
    initData();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Scan simulation helper
  const runScanProgress = async (auditFn: () => Promise<AuditReport>) => {
    setIsAuditing(true);
    setAuditError(null);
    setScanStepIndex(0);

    const stepInterval = setInterval(() => {
      setScanStepIndex((prev) => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
    }, 450);

    try {
      const report = await auditFn();
      clearInterval(stepInterval);
      setScanStepIndex(SCAN_STEPS.length - 1);
      setTimeout(() => {
        setAuditReport(report);
        if (report.normalized_bill) {
          setCurrentBill(report.normalized_bill);
        }
        setIsAuditing(false);
        setActiveTab("dashboard");
      }, 500);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setIsAuditing(false);
      setAuditError(err instanceof Error ? err.message : "Audit processing failed");
    }
  };

  // Load a Pre-configured Sample Bill
  const handleSelectSampleBill = async (billId: string) => {
    runScanProgress(async () => {
      const billData = await fetchSampleBillById(billId);
      setCurrentBill(billData);
      return await analyzeBillData(billData);
    });
  };

  // Run File Upload & Analysis
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    runScanProgress(async () => {
      return await uploadAndAnalyzeFile(selectedFile, stateJurisdiction, billingScheme);
    });
  };

  // Quick Demo Audit Button
  const handleRunDemoAudit = async () => {
    runScanProgress(async () => {
      return await triggerDemoAudit();
    });
  };

  // Handle Chat Query
  const handleSendChat = async (userText?: string) => {
    const text = userText || chatInput.trim();
    if (!text || isChatLoading) return;

    const newHistory: ChatMessage[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(newHistory);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response: AuditChatResponse = await askAIAssistant(
        text,
        currentBill || auditReport?.normalized_bill,
        auditReport?.findings || [],
        newHistory
      );

      setChatMessages([
        ...newHistory,
        {
          role: "assistant",
          content: response.reply,
        },
      ]);
    } catch {
      setChatMessages([
        ...newHistory,
        {
          role: "assistant",
          content:
            "I could not complete your request at this moment. Note: Medical billing audits strictly evaluate items against codified circulars without making defamatory claims against practitioners.",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Ask AI about a specific finding
  const handleAskAIAboutFinding = (finding: AuditFinding) => {
    setActiveTab("assistant");
    const query = `Why was "${finding.item_name}" flagged under ${finding.rule_id} for ₹${finding.excess_amount.toLocaleString("en-IN")}? Please explain the rule, the mathematical calculation, and what I should ask the billing desk.`;
    handleSendChat(query);
  };

  // Generate Formal Dispute Letter
  const handleGenerateLetter = async () => {
    if (!auditReport) return;
    setIsGeneratingLetter(true);
    try {
      const res = await generateDisputeLetter(auditReport, recipientTitle, disputeNotes);
      setDisputeLetter(res);
      setActiveTab("action-center");
    } catch (err: unknown) {
      alert("Failed to generate dispute letter: " + (err instanceof Error ? err.message : "Error"));
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  // Copy dispute letter markdown
  const handleCopyLetter = () => {
    if (!disputeLetter) return;
    navigator.clipboard.writeText(disputeLetter.markdown_content);
    setLetterCopied(true);
    setTimeout(() => setLetterCopied(false), 2500);
  };

  // Filtered findings
  const filteredFindings = auditReport?.findings.filter((f) => {
    if (findingFilter === "ALL") return true;
    if (findingFilter === "CALCULATION_ERROR") return f.violation_type === "CALCULATION_ERROR";
    if (findingFilter === "DUPLICATE_ENTRY") return f.violation_type === "DUPLICATE_ENTRY";
    if (findingFilter === "PROHIBITED_UNBUNDLING") return f.violation_type === "PROHIBITED_UNBUNDLING";
    if (findingFilter === "INSURANCE_NON_PAYABLE") return f.violation_type === "INSURANCE_NON_PAYABLE";
    if (findingFilter === "GST_MISCALCULATION") return f.violation_type === "GST_MISCALCULATION";
    if (findingFilter === "RATE_CAP_EXCEEDED") return f.violation_type === "RATE_CAP_EXCEEDED";
    if (findingFilter === "CRITICAL") return f.severity === "CRITICAL";
    if (findingFilter === "HIGH") return f.severity === "HIGH";
    return true;
  }) || [];

  // Filtered statutory rules
  const filteredRules = rules.filter((r) => {
    const matchesCat =
      selectedRuleCategory === "ALL" ||
      r.category.toUpperCase().includes(selectedRuleCategory.toUpperCase());
    const matchesSearch =
      !ruleSearchQuery ||
      r.subject.toLowerCase().includes(ruleSearchQuery.toLowerCase()) ||
      r.operational_rule.toLowerCase().includes(ruleSearchQuery.toLowerCase()) ||
      r.authority.toLowerCase().includes(ruleSearchQuery.toLowerCase()) ||
      r.rule_id.toLowerCase().includes(ruleSearchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="app-shell min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Navigation */}
      <header className="app-header no-print border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 via-emerald-400 to-cyan-400 flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-teal-500/20 ring-1 ring-white/20">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  BillShield
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 font-mono">
                  India
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Clear, rule-based hospital bill reviews
              </p>
            </div>
          </div>

          {/* Quick System Status & Health */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300">Rules</span>
              <span className="font-mono font-bold text-emerald-400">{rules.length || 37}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
              {healthLoading ? (
                <span className="text-slate-400">Checking status</span>
              ) : health?.status === "healthy" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                  <span className="text-teal-300 font-medium">
                    {health.providers?.llm?.is_demo ? "Demo mode" : "Ready"}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-amber-300 font-medium">Offline</span>
                </>
              )}
            </div>

            <button
              onClick={handleRunDemoAudit}
              disabled={isAuditing}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition shadow-md shadow-teal-700/20 disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Demo
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-3.5 pt-2 border-t border-slate-800/80 flex items-center gap-1 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "upload"
                ? "bg-slate-800 text-teal-400 font-semibold border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Analyze
          </button>

          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "dashboard"
                ? "bg-slate-800 text-teal-400 font-semibold border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Summary
            {auditReport && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500/20 text-red-300 font-mono">
                {auditReport.findings_count}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("findings")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "findings"
                ? "bg-slate-800 text-teal-400 font-semibold border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Findings
          </button>

          <button
            onClick={() => setActiveTab("assistant")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "assistant"
                ? "bg-slate-800 text-teal-400 font-semibold border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Ask AI
          </button>

          <button
            onClick={() => setActiveTab("action-center")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "action-center"
                ? "bg-slate-800 text-teal-400 font-semibold border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Actions
          </button>

          <button
            onClick={() => setActiveTab("regulations")}
            className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === "regulations"
                ? "bg-slate-800 text-teal-400 font-semibold border border-teal-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Rules ({rules.length || 37})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Processing / Scanning Overlay */}
        {isAuditing && (
          <div className="p-8 rounded-2xl bg-slate-900 border border-teal-500/40 shadow-2xl relative overflow-hidden text-center space-y-4">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-cyan-500/10 to-teal-500/5 animate-pulse"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin mb-4 flex items-center justify-center">
                <span className="font-mono text-sm font-bold text-teal-400">
                  {Math.round(((scanStepIndex + 1) / SCAN_STEPS.length) * 100)}%
                </span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Reviewing your bill</h3>
              <p className="text-sm text-teal-300 font-mono mt-1">
                {SCAN_STEPS[scanStepIndex]}
              </p>

              {/* Progress bars */}
              <div className="w-full max-w-md bg-slate-800 rounded-full h-2 mt-4 overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-2 transition-all duration-300 ease-out"
                  style={{ width: `${((scanStepIndex + 1) / SCAN_STEPS.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {auditError && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-semibold text-red-300">Audit Discrepancy Error</p>
              <p className="text-xs text-red-300/80 mt-0.5">{auditError}</p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: BILL ANALYZER & UPLOAD                                            */}
        {/* ========================================================================= */}
        {activeTab === "upload" && (
          <div className="space-y-8">
            {/* Hero / Value Proposition Banner */}
            <div className="app-hero relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-6 lg:p-9 border border-slate-800 shadow-xl overflow-hidden">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                  Rule-based bill review
                </div>
                <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
                  Understand your hospital bill before you pay.
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Upload a bill or try a sample. We check calculations, duplicate charges, and selected pricing rules so you know what to ask about.
                </p>
              </div>
            </div>

            {/* Quick-Select Synthetic Demo Cases */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400">⚡</span>
                    Try a sample bill
                  </h3>
                  <p className="text-xs text-slate-400">
                    Explore the review with safe demo data.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                  Demo data
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sampleBills.map((sb) => (
                  <button
                    type="button"
                    key={sb.id}
                    onClick={() => handleSelectSampleBill(sb.id)}
                    disabled={isAuditing}
                    className="group w-full cursor-pointer rounded-xl border border-slate-800 bg-slate-900/90 p-5 text-left shadow-md transition-all hover:border-teal-500/50 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-60 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {sb.bill_number}
                      </span>
                      <span className="text-xs font-bold font-mono text-emerald-400">
                        ₹{sb.total_amount.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white mt-3 group-hover:text-teal-300 transition">
                      {sb.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {sb.description}
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-1.5">
                      {sb.discrepancy_types.map((dt, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        >
                          {dt.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-teal-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>Review sample</span>
                      <span>→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Document Upload Card */}
            <div className="p-6 lg:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload a bill
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose an itemized bill or interim invoice to begin your review.
                </p>
              </div>

              <form onSubmit={handleFileUpload} className="space-y-6">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-teal-500/60 rounded-xl p-8 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition-all flex flex-col items-center justify-center gap-3"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-teal-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-bold text-teal-300">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB — Ready for regulatory audit
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Drop a bill here or <span className="text-teal-400 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">PDF, JPG, or PNG · up to 25 MB</p>
                    </div>
                  )}
                </div>

                {/* Audit Context Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Your state
                    </label>
                    <select
                      value={stateJurisdiction}
                      onChange={(e) => setStateJurisdiction(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="Delhi">Delhi (Delhi Nursing Homes Registration Act)</option>
                      <option value="Maharashtra">Maharashtra (Bombay Nursing Home Registration Act)</option>
                      <option value="Karnataka">Karnataka (KPME Act Regulations)</option>
                      <option value="Haryana">Haryana (Clinical Establishments Act)</option>
                      <option value="Other">National Standard (IRDAI / NPPA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Review scheme
                    </label>
                    <select
                      value={billingScheme}
                      onChange={(e) => setBillingScheme(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="CGHS">CGHS / Private Insurance (Standard Tariff & IRDAI Non-Payables)</option>
                      <option value="PM-JAY">AB PM-JAY (Government Bundled Package Benchmarks)</option>
                      <option value="CASH_PATIENT">Direct Out-of-Pocket / Cash Patient (Consumer Protection)</option>
                    </select>
                  </div>
                </div>

                <div className="upload-actions flex items-center justify-between gap-4 pt-2">
                  <span className="text-xs text-slate-500">Your results will include the rules used for review.</span>
                  <button
                    type="submit"
                    disabled={!selectedFile || isAuditing}
                    className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-teal-500/20 disabled:opacity-40"
                  >
                    Review bill
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: AUDIT DASHBOARD                                                   */}
        {/* ========================================================================= */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {!auditReport ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white">No Audit Report Generated Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Upload a bill or choose a sample to see the review summary.
                </p>
                <button
                  onClick={handleRunDemoAudit}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition"
                >
                  Try a sample
                </button>
              </div>
            ) : (
              <>
                {/* Hospital & Patient Meta Strip */}
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                        {auditReport.bill_number || "INV-SAMPLE"}
                      </span>
                      <h3 className="text-lg font-black text-white">
                        {auditReport.hospital_name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-3">
                      <span>Patient: <strong className="text-slate-200">{auditReport.patient_name || "Confidential"}</strong></span>
                      <span>•</span>
                      <span>Ward: <strong className="text-slate-200">{auditReport.ward_type || "ICU / General"}</strong></span>
                      <span>•</span>
                      <span>Audit Job ID: <span className="font-mono text-slate-400">{auditReport.job_id.slice(0, 8)}</span></span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGenerateLetter}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-teal-700/20"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Create letter
                    </button>
                    <button
                      onClick={() => setActiveTab("assistant")}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Ask AI
                    </button>
                  </div>
                </div>

                {/* 4 Core Financial Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Total Billed */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-400">Total billed</span>
                    <div className="text-2xl font-black text-white font-mono">
                      ₹{auditReport.total_billed.toLocaleString("en-IN")}
                    </div>
                    <p className="text-[11px] text-slate-500">Invoice total, including taxes</p>
                  </div>

                  {/* 2. Verified Arithmetic Discrepancies */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300">Calculation differences</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold">
                        Calculated
                      </span>
                    </div>
                    <div className="text-2xl font-black text-amber-400 font-mono">
                      ₹{auditReport.arithmetic_error_total.toLocaleString("en-IN")}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Math discrepancies (Qty × Rate != Amount, or Subtotal mismatch)
                    </p>
                  </div>

                  {/* 3. Suspicious / Unbundled Charges */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-red-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-red-300">Charges to review</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-mono font-bold">
                        Unbundled
                      </span>
                    </div>
                    <div className="text-2xl font-black text-red-400 font-mono">
                      ₹{auditReport.suspicious_charges_total.toLocaleString("en-IN")}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Duplicate, bundled, or rate-related items
                    </p>
                  </div>

                  {/* 4. Total Potential Review Amount */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/40 space-y-2 shadow-lg shadow-teal-950/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-teal-300">Amount to review</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold font-mono">
                        {auditReport.findings_count} Items
                      </span>
                    </div>
                    <div className="text-2xl font-black text-teal-300 font-mono">
                      ₹{auditReport.potential_savings.toLocaleString("en-IN")}
                    </div>
                    <p className="text-[11px] text-teal-200/70">
                      Items worth clarifying with the billing desk
                    </p>
                  </div>
                </div>

                {/* Calculation Transparency & Clarification Disclaimer */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
                  <svg className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <span className="font-semibold text-slate-200">About this total: </span>
                    Potential Review Amount (₹{auditReport.potential_savings.toLocaleString("en-IN")}) = Verified Arithmetic Errors (₹{auditReport.arithmetic_error_total.toLocaleString("en-IN")}) + Suspicious Surcharges & Unbundled Items (₹{auditReport.suspicious_charges_total.toLocaleString("en-IN")}) + Disallowed Items (₹{auditReport.disallowed_items_total.toLocaleString("en-IN")}).
                    <p className="text-[11px] text-slate-500 mt-1">
                      Results highlight items to clarify; they are not legal conclusions.
                    </p>
                  </div>
                </div>

                {/* Severity Breakdown & Quick Summary Visualizer */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Findings Table Preview */}
                  <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-white">Items to review</h4>
                      <button
                        onClick={() => setActiveTab("findings")}
                        className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
                      >
                        View All Details →
                      </button>
                    </div>

                    <div className="space-y-3">
                      {auditReport.findings.slice(0, 4).map((f) => (
                        <div
                          key={f.finding_id}
                          className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                                  f.severity === "CRITICAL"
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : f.severity === "HIGH"
                                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                    : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                }`}
                              >
                                {f.severity}
                              </span>
                              <span className="font-bold text-xs text-white">{f.item_name}</span>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-1">{f.patient_explanation}</p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-sm text-red-400">
                              +₹{f.excess_amount.toLocaleString("en-IN")}
                            </div>
                            <button
                              onClick={() => handleAskAIAboutFinding(f)}
                              className="text-[11px] text-teal-400 hover:underline"
                            >
                              Ask AI
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Col: Statutory Severity Distribution */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <h4 className="font-bold text-sm text-white">Review priority</h4>

                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span> Critical Severity
                          </span>
                          <span className="font-mono font-bold text-red-400">
                            {auditReport.findings.filter((f) => f.severity === "CRITICAL").length} items
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div
                            className="bg-red-500 h-1.5 rounded-full"
                            style={{
                              width: `${
                                (auditReport.findings.filter((f) => f.severity === "CRITICAL").length /
                                  (auditReport.findings_count || 1)) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span> High Severity
                          </span>
                          <span className="font-mono font-bold text-amber-400">
                            {auditReport.findings.filter((f) => f.severity === "HIGH").length} items
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div
                            className="bg-amber-400 h-1.5 rounded-full"
                            style={{
                              width: `${
                                (auditReport.findings.filter((f) => f.severity === "HIGH").length /
                                  (auditReport.findings_count || 1)) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300 mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span> Medium / Low
                          </span>
                          <span className="font-mono font-bold text-blue-400">
                            {auditReport.findings.filter((f) => f.severity === "MEDIUM" || f.severity === "LOW").length} items
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div
                            className="bg-blue-400 h-1.5 rounded-full"
                            style={{
                              width: `${
                                (auditReport.findings.filter((f) => f.severity === "MEDIUM" || f.severity === "LOW").length /
                                  (auditReport.findings_count || 1)) *
                                100
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1 mt-4">
                      <div className="font-semibold text-slate-300">Suggested next step</div>
                      <p>
                        Ask the billing desk for an itemized ledger and a clear explanation of the highlighted items.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ITEMIZED FINDINGS & AUDIT TRAIL                                    */}
        {/* ========================================================================= */}
        {activeTab === "findings" && (
          <div className="space-y-6">
            {!auditReport ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-sm text-slate-400">Please run an audit first to inspect itemized findings.</p>
                <button
                  onClick={handleRunDemoAudit}
                  className="mt-3 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold"
                >
                  Load Demo Audit
                </button>
              </div>
            ) : (
              <>
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                    {[
                      { key: "ALL", label: `All Findings (${auditReport.findings_count})` },
                      { key: "CALCULATION_ERROR", label: "Arithmetic Math Errors" },
                      { key: "DUPLICATE_ENTRY", label: "Duplicate Charges" },
                      { key: "PROHIBITED_UNBUNDLING", label: "Unbundling / Surcharges" },
                      { key: "INSURANCE_NON_PAYABLE", label: "IRDAI Non-Payables" },
                      { key: "GST_MISCALCULATION", label: "GST Exemptions" },
                      { key: "CRITICAL", label: "Critical Severity" },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setFindingFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                          findingFilter === tab.key
                            ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold"
                            : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    Showing {filteredFindings.length} of {auditReport.findings_count} items
                  </span>
                </div>

                {/* Findings Table / Card Stream */}
                <div className="space-y-4">
                  {filteredFindings.map((finding) => (
                    <div
                      key={finding.finding_id}
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-sm space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                finding.severity === "CRITICAL"
                                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                  : finding.severity === "HIGH"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              {finding.severity}
                            </span>

                            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {finding.rule_id}
                            </span>

                            <h4 className="text-sm font-bold text-white">
                              {finding.item_name}
                            </h4>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            {finding.patient_explanation}
                          </p>
                        </div>

                        {/* Financial Comparison */}
                        <div className="text-right shrink-0 bg-slate-950/60 p-3 rounded-xl border border-slate-800 min-w-[160px]">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            Disputed Excess
                          </div>
                          <div className="text-lg font-black text-red-400 font-mono">
                            ₹{finding.excess_amount.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Billed: ₹{finding.billed_amount.toLocaleString("en-IN")} | Permissible: ₹{finding.permissible_amount.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>

                      {/* Evidence & Action Box */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                          <span className="font-semibold text-slate-400 block mb-1">
                            Statutory Legal Authority & Evidence:
                          </span>
                          <p className="text-teal-300 font-mono text-[11px]">
                            {finding.evidence_citation}
                          </p>
                          {finding.calculation_basis && (
                            <p className="text-[11px] text-slate-400 mt-1 font-mono">
                              Basis: {finding.calculation_basis}
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 flex flex-col justify-between">
                          <div>
                            <span className="font-semibold text-slate-400 block mb-1">
                              Recommended Patient Action:
                            </span>
                            <p className="text-slate-300 text-[11px]">
                              {finding.recommended_action || "Request removal of this item or justification from the TPA billing department."}
                            </p>
                          </div>
                          <div className="mt-2 text-right">
                            <button
                              onClick={() => handleAskAIAboutFinding(finding)}
                              className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300 text-[11px] font-semibold"
                            >
                              Consult AI Agent on this finding →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: EXPLAINABLE AI AGENT (CHAT)                                        */}
        {/* ========================================================================= */}
        {activeTab === "assistant" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
                  Bill review assistant
                </h3>
                <p className="text-xs text-slate-400">
                  Ask about a charge, a rule, or what to ask the billing desk.
                </p>
              </div>

              {auditReport && (
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
                  Grounded in: {auditReport.hospital_name}
                </span>
              )}
            </div>

            {/* Quick Prompt Suggestion Chips */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="text-slate-500 self-center text-[11px]">Try asking:</span>
              {[
                "Why was this charge flagged?",
                "Can you explain the GST check?",
                "What should I ask the billing desk?",
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChat(suggestion)}
                  className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-teal-500/40 text-slate-300 text-[11px] transition"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Chat Box */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-[520px] overflow-hidden">
              {/* Message List */}
              <div className="flex-1 p-4 lg:p-6 overflow-y-auto space-y-4">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-teal-600 text-white font-medium"
                          : "bg-slate-950/80 text-slate-200 border border-slate-800 shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-1.5">
                          <span>AI Auditor</span>
                          <span>•</span>
                          <span>Bill review</span>
                        </div>
                      )}
                      <div className="whitespace-pre-line">{msg.content}</div>
                    </div>
                  </div>
                ))}

                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></div>
                      <span>Reviewing your question...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about a charge or rule..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: PATIENT ACTION CENTER & DISPUTE DOSSIER                             */}
        {/* ========================================================================= */}
        {activeTab === "action-center" && (
          <div className="space-y-6">
            {!auditReport ? (
              <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-sm text-slate-400">Run a review first to create a clarification letter.</p>
                <button
                  onClick={handleRunDemoAudit}
                  className="mt-3 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold"
                >
                  Try a sample
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: Dispute Options & Questions Checklist */}
                <div className="space-y-6">
                  {/* Action Checklist */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span className="text-teal-400">📋</span>
                      Questions to ask
                    </h3>
                    <div className="space-y-3 text-xs text-slate-300">
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-teal-500" />
                        <span>Request a complete <strong>Daily Itemized Ledger</strong> with unit rates and quantities.</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-teal-500" />
                        <span>Demand reconciliation of verified arithmetic errors (₹{auditReport.arithmetic_error_total.toLocaleString("en-IN")}).</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-teal-500" />
                        <span>Ask billing manager to quote statutory authority for charging ICU Nursing separately.</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" defaultChecked className="mt-0.5 rounded accent-teal-500" />
                        <span>Verify whether hospital room rent exceeded ₹5,000 before agreeing to GST charges.</span>
                      </div>
                    </div>
                  </div>

                  {/* Grievance Escalation Steps */}
                  <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <h3 className="font-bold text-sm text-white">If you need more help</h3>
                    <ol className="list-decimal list-inside text-xs text-slate-400 space-y-2 leading-relaxed">
                      <li>
                        <strong className="text-slate-200">Hospital Grievance Cell:</strong> Submit formal written dispute letter.
                      </li>
                      <li>
                        <strong className="text-slate-200">TPA / Insurance Desk:</strong> Report unbundled items to insurer claims manager.
                      </li>
                      <li>
                        <strong className="text-slate-200">State Clinical Establishments Council:</strong> Lodge complaint for tariff violation.
                      </li>
                      <li>
                        <strong className="text-slate-200">National Consumer Helpline (NCH):</strong> Dial 1915 or file on edaakhil.nic.in.
                      </li>
                    </ol>
                  </div>
                </div>

                {/* Right 2 Cols: Printable Dispute Letter Preview */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span className="text-teal-400">📄</span>
                      Clarification letter
                    </h3>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyLetter}
                        disabled={!disputeLetter}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition"
                      >
                        {letterCopied ? "✓ Copied!" : "Copy Text"}
                      </button>

                      <button
                        onClick={() => window.print()}
                        disabled={!disputeLetter}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-teal-700/20"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print / Save PDF
                      </button>
                    </div>
                  </div>

                  {!disputeLetter ? (
                    <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        Create a concise letter with your bill details and highlighted items.
                      </p>
                      <button
                        onClick={handleGenerateLetter}
                        disabled={isGeneratingLetter}
                        className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition"
                      >
                        {isGeneratingLetter ? "Creating letter..." : "Create letter"}
                      </button>
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-white text-slate-900 font-sans text-xs shadow-2xl leading-relaxed max-h-[700px] overflow-y-auto border border-slate-300">
                      <div
                        dangerouslySetInnerHTML={{ __html: disputeLetter.html_content }}
                        className="prose prose-sm max-w-none text-slate-800"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: STATUTORY RULES CATALOG                                           */}
        {/* ========================================================================= */}
        {activeTab === "regulations" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-teal-400">🏛️</span>
                    Billing rules
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    The rules used to guide this review.
                  </p>
                </div>

                <div className="w-full sm:w-72">
                  <input
                    type="text"
                    value={ruleSearchQuery}
                    onChange={(e) => setRuleSearchQuery(e.target.value)}
                    placeholder="Search rules..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 text-xs pt-2 border-t border-slate-800">
                {[
                  { key: "ALL", label: `All (${rules.length})` },
                  { key: "ICU", label: "ICU / Bed Bundling" },
                  { key: "IRDAI", label: "IRDAI Non-Payables" },
                  { key: "GST", label: "GST Healthcare Exemption" },
                  { key: "NPPA", label: "NPPA Price Ceilings" },
                  { key: "SURGERY", label: "Surgery / OT Packages" },
                  { key: "STATE", label: "State Clinical Rules" },
                ].map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedRuleCategory(c.key)}
                    className={`px-3 py-1 rounded-lg transition ${
                      selectedRuleCategory === c.key
                        ? "bg-teal-500 text-slate-950 font-bold"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRules.map((rule) => (
                <div
                  key={rule.rule_id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        {rule.rule_id}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {rule.authority}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-white">{rule.subject}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{rule.operational_rule}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                    <span className="truncate max-w-[240px]">
                      {rule.document_title || "Official Gazette Notification"}
                    </span>
                    {rule.source?.official_url && (
                      <a
                        href={rule.source.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-400 hover:underline shrink-0"
                      >
                        Official Source ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="no-print mt-auto border-t border-slate-800/80 bg-slate-900/60 py-6 px-4 text-center text-xs text-slate-500 space-y-1">
        <p>
          BillShield helps you review hospital bills with clearer calculations and rule references.
        </p>
        <p className="text-[11px] text-slate-600">
          Results are informational and do not replace legal or medical advice.
        </p>
      </footer>
    </div>
  );
}
