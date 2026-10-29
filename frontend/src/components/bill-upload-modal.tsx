import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Info,
  RefreshCw,
} from "lucide-react";
import {
  fetchSampleBills,
  fetchSampleBillById,
  analyzeBill,
  uploadAndAnalyzeFile,
  runDemoAudit,
  SampleBillMeta,
  AuditReportResponse,
  BackendUnavailableError,
  ExtractionError,
  ValidationError,
} from "@/lib/api";
import { fmtINR } from "@/lib/demo-audit";

interface BillUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuditComplete: (report: AuditReportResponse) => void;
}

const SCAN_STEPS = [
  "Uploading and parsing bill document...",
  "Validating line-item math and table structure...",
  "Cross-referencing reference benchmarks (CGHS/NPPA/IRDAI)...",
  "Checking for unbundled ICU overheads, duplicate services & tax flags...",
  "Compiling evidence-backed itemized audit dossier...",
];

export function BillUploadModal({ isOpen, onClose, onAuditComplete }: BillUploadModalProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "samples">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stateJurisdiction, setStateJurisdiction] = useState<string>("Delhi");
  const [billingScheme, setBillingScheme] = useState<string>("CGHS");
  const [sampleBills, setSampleBills] = useState<SampleBillMeta[]>([]);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);

  // Scanning progress state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditMode, setAuditMode] = useState<"real" | "demo" | "sample">("real");
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<"backend" | "extraction" | "validation" | "general" | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch sample bills catalog
  useEffect(() => {
    if (isOpen) {
      setIsLoadingSamples(true);
      fetchSampleBills()
        .then((bills) => {
          setSampleBills(bills);
        })
        .catch(() => {
          setSampleBills([]);
        })
        .finally(() => {
          setIsLoadingSamples(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancelAudit = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsAuditing(false);
    setErrorMsg("Audit cancelled by user.");
    setErrorCategory("general");
  };

  const runScanning = async (
    mode: "real" | "demo" | "sample",
    auditFn: (signal: AbortSignal) => Promise<AuditReportResponse>
  ) => {
    setIsAuditing(true);
    setAuditMode(mode);
    setErrorMsg(null);
    setErrorCategory(null);
    setScanStepIndex(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const stepInterval = setInterval(() => {
      setScanStepIndex((prev) => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
    }, 600);

    try {
      const report = await auditFn(controller.signal);
      clearInterval(stepInterval);
      setScanStepIndex(SCAN_STEPS.length - 1);
      setTimeout(() => {
        setIsAuditing(false);
        onAuditComplete(report);
        onClose();
      }, 400);
    } catch (err: any) {
      clearInterval(stepInterval);
      setIsAuditing(false);

      if (err instanceof BackendUnavailableError) {
        setErrorCategory("backend");
        setErrorMsg(err.message);
      } else if (err instanceof ExtractionError) {
        setErrorCategory("extraction");
        setErrorMsg(err.message);
      } else if (err instanceof ValidationError) {
        setErrorCategory("validation");
        setErrorMsg(err.message);
      } else {
        setErrorCategory("general");
        setErrorMsg(err.message || "Failed to analyze bill. Please check backend connection.");
      }
    }
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorCategory("validation");
      setErrorMsg("Please select a valid itemized bill PDF or image file first.");
      return;
    }
    runScanning("real", async (signal) => {
      return await uploadAndAnalyzeFile(selectedFile, stateJurisdiction, billingScheme, signal);
    });
  };

  const handleSelectSampleBill = (billId: string) => {
    runScanning("sample", async (signal) => {
      const billData = await fetchSampleBillById(billId, signal);
      const report = await analyzeBill(billData, signal);
      report.is_demo = true;
      report.audit_source = "synthetic_demo";
      report.source_filename = `${billId}.json (Catalog Sample)`;
      return report;
    });
  };

  const handleQuickDemoAudit = () => {
    runScanning("demo", async (signal) => {
      return await runDemoAudit(signal);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl md:p-8">
        {/* Close Button */}
        {!isAuditing && (
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        )}

        {/* Modal Header */}
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Deterministic Rule Engine
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Audit Hospital Bill
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your hospital bill for a genuine automated audit, or explore pre-configured synthetic cases.
          </p>
        </div>

        {/* Audit Progress Screen */}
        {isAuditing ? (
          <div className="my-8 flex flex-col items-center justify-center py-6 text-center">
            <div className="relative flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Loader2 className="size-10 animate-spin" />
            </div>
            <h3 className="mt-6 text-lg font-bold text-foreground">
              {auditMode === "real"
                ? "Auditing Uploaded Bill with Rule Engine"
                : auditMode === "demo"
                ? "Running 1-Click Synthetic ICU Demo"
                : "Auditing Sample Case"}
            </h3>
            <p className="mt-1 text-sm font-medium text-primary">
              {SCAN_STEPS[scanStepIndex]}
            </p>

            <div className="mt-6 w-full max-w-md">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{
                    width: `${((scanStepIndex + 1) / SCAN_STEPS.length) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>Step {scanStepIndex + 1} of {SCAN_STEPS.length}</span>
                <span>10 Checks Active (37 Rules Catalogued)</span>
              </div>
            </div>

            <button
              onClick={handleCancelAudit}
              className="mt-6 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Cancel audit
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="mt-6 flex border-b border-border">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("upload");
                  setErrorMsg(null);
                }}
                className={`flex-1 border-b-2 py-3 text-center text-sm font-semibold transition-colors ${
                  activeTab === "upload"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Upload Real Bill (PDF / Image)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("samples");
                  setErrorMsg(null);
                }}
                className={`flex-1 border-b-2 py-3 text-center text-sm font-semibold transition-colors ${
                  activeTab === "samples"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Explore Synthetic Samples
              </button>
            </div>

            {/* Error Banner with Categorized Guidance */}
            {errorMsg && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {errorCategory === "backend"
                        ? "Backend Connection Error"
                        : errorCategory === "extraction"
                        ? "Document Extraction Failed"
                        : errorCategory === "validation"
                        ? "Validation Error"
                        : "Audit Request Failed"}
                    </p>
                    <p className="leading-relaxed">{errorMsg}</p>
                    {errorCategory === "backend" && (
                      <p className="pt-1 text-muted-foreground">
                        Tip: Make sure the FastAPI backend is running via{" "}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                          python -m uvicorn backend.main:app --port 8000
                        </code>
                        . Alternatively, test the offline workflow with the 1-Click Quick Demo below.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Upload Tab */}
            {activeTab === "upload" && (
              <form onSubmit={handleFileUpload} className="mt-5 space-y-4">
                {/* Drag & Drop Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                    selectedFile
                      ? "border-primary/60 bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/40"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        setErrorMsg(null);
                        setErrorCategory(null);
                      }
                    }}
                  />
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                    {selectedFile ? (
                      <CheckCircle2 className="size-6 text-primary" />
                    ) : (
                      <UploadCloud className="size-6" />
                    )}
                  </div>
                  {selectedFile ? (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-foreground">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Ready for real audit
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-foreground">
                        Click or drag hospital bill here
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Supports PDF (itemized discharge summary), PNG, JPG up to 25 MB
                      </p>
                    </div>
                  )}
                </div>

                {/* State Jurisdiction & Scheme Dropdowns with Honest Transparency */}
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground">
                          State Jurisdiction
                        </label>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Reference Only
                        </span>
                      </div>
                      <select
                        value={stateJurisdiction}
                        onChange={(e) => setStateJurisdiction(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Delhi">Delhi (Delhi Health Dept / CGHS)</option>
                        <option value="Maharashtra">Maharashtra (State Ceilings)</option>
                        <option value="Karnataka">Karnataka (KPME Rules)</option>
                        <option value="Tamil Nadu">Tamil Nadu (TN Govt Orders)</option>
                        <option value="All India">All India / Central Guidelines</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Rate Benchmark / Scheme
                        </label>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          National Caps Active
                        </span>
                      </div>
                      <select
                        value={billingScheme}
                        onChange={(e) => setBillingScheme(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="CGHS">CGHS Reference Rates (Central)</option>
                        <option value="PMJAY">PM-JAY Benefit Packages</option>
                        <option value="GIPSA">GIPSA / Private TPA Tariffs</option>
                        <option value="Statutory">Standard Statutory Caps (NPPA/ICU)</option>
                      </select>
                    </div>
                  </div>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Info className="size-3.5 shrink-0 text-primary" />
                    <span>
                      The active engine evaluates verified national benchmarks (CGHS/NPPA/IRDAI). State-specific clinical tariffs and custom scheme rules are catalogued and scheduled for dynamic filtering in an upcoming update.
                    </span>
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={!selectedFile}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText className="size-4" />
                    Audit Uploaded Bill
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickDemoAudit}
                    className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-card px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
                  >
                    <Sparkles className="size-4" />
                    1-Click Synthetic ICU Audit
                  </button>
                </div>
              </form>
            )}

            {/* Pre-configured Samples Tab */}
            {activeTab === "samples" && (
              <div className="mt-5 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select a realistic pre-configured hospital case to inspect deterministic audit findings:
                </p>
                {isLoadingSamples ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                ) : sampleBills.length > 0 ? (
                  sampleBills.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectSampleBill(b.id)}
                      className="group flex cursor-pointer items-start justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground group-hover:text-primary">
                            {b.hospital_name}
                          </h4>
                          <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {b.ward_type || "ICU / Inpatient"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {b.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {b.discrepancy_types?.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                            >
                              <ShieldAlert className="size-3 text-flagged" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {fmtINR(b.total_amount)}
                        </span>
                        <span className="mt-3 flex items-center text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                          Audit <ArrowRight className="ml-1 size-3.5" />
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <p>No sample bills catalog returned from backend.</p>
                    <button
                      onClick={handleQuickDemoAudit}
                      className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      Run Synthetic Audit
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
