/**
 * BillShielder — API Client for FastAPI Backend
 * Connects the frontend directly with the deterministic statutory audit engine,
 * OCR/PDF extraction pipeline, AI Patient Advocate assistant, and Dispute Letter generator.
 */

export interface BillItem {
  item_id: string;
  item_name: string;
  category?: string;
  standard_code?: string;
  quantity: number;
  unit_rate: number;
  total_charge: number;
  service_date?: string;
  is_bundled_suspect?: boolean;
  notes?: string;
  uncertainty_flags?: string[];
}

export interface NormalizedBill {
  hospital_name: string;
  hospital_city?: string;
  bill_number: string;
  bill_date?: string;
  admission_date?: string;
  discharge_date?: string;
  patient_name?: string;
  patient_uhid?: string;
  ward_type?: string;
  items: BillItem[];
  subtotal_amount: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  extraction_status?: string;
  ocr_required?: boolean;
}

export interface AuditFinding {
  finding_id: string;
  rule_id: string;
  item_name: string;
  billed_amount: number;
  permissible_amount: number;
  excess_amount: number;
  violation_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  evidence_citation: string;
  patient_explanation?: string;
  auditor_notes?: string;
  recommended_action?: string;
  confidence_level?: string;
  calculation_basis?: string;
}

export interface AuditReportResponse {
  job_id: string;
  status: string;
  hospital_name: string;
  patient_name?: string;
  bill_number?: string;
  bill_date?: string;
  ward_type?: string;
  total_billed: number;
  total_permissible: number;
  potential_savings: number;
  arithmetic_error_total: number;
  suspicious_charges_total: number;
  disallowed_items_total: number;
  findings_count: number;
  findings: AuditFinding[];
  normalized_bill?: NormalizedBill;
  created_at?: string;
}

export interface SampleBillMeta {
  id: string;
  title?: string;
  hospital_name: string;
  bill_number: string;
  patient_name?: string;
  admission_date?: string;
  discharge_date?: string;
  ward_type?: string;
  total_amount: number;
  discrepancy_types?: string[];
  description: string;
}

export interface StatutoryRule {
  rule_id: string;
  rule_name?: string;
  title?: string;
  category: string;
  description?: string;
  legal_reference?: string;
  statutory_authority?: string;
  penalty_or_consequence?: string;
  rate_ceiling?: number;
  effective_date?: string;
  [key: string]: any;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AuditChatRequest {
  message: string;
  bill?: NormalizedBill | null;
  findings?: AuditFinding[];
  history?: ChatMessage[];
}

export interface AuditChatResponse {
  reply: string;
  suggested_actions: string[];
  rule_citations: string[];
}

export interface DisputeLetterRequest {
  report: AuditReportResponse;
  recipient_title?: string;
  patient_address?: string;
  notes?: string;
}

export interface DisputeLetterResponse {
  html_content: string;
  markdown_content: string;
  summary: Record<string, any>;
}

export interface HealthStatus {
  status: string;
  app_name?: string;
  version?: string;
  environment?: string;
  demo_mode?: boolean;
}

/**
 * Resolves the backend API base URL.
 * Defaults to http://localhost:8000/api/v1 (or proxy /api/v1).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // If running in development with Vite dev server on port 3000
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000/api/v1";
    }
  }
  return "/api/v1";
}

/**
 * Generic fetch wrapper with timeout and JSON parsing.
 */
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMsg = `Server error ${res.status}: ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // use fallback
      }
      throw new Error(errorMsg);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Check health of backend */
export async function fetchHealth(): Promise<HealthStatus> {
  const baseUrl = getApiBaseUrl();
  // Health is available at /api/v1/health or /health
  try {
    return await apiFetch<HealthStatus>("/health");
  } catch {
    const rootUrl = baseUrl.replace(/\/api\/v1\/?$/, "");
    return await apiFetch<HealthStatus>(`${rootUrl}/health`);
  }
}

/** Fetch pre-configured realistic synthetic bills */
export async function fetchSampleBills(): Promise<SampleBillMeta[]> {
  return await apiFetch<SampleBillMeta[]>("/audit/sample-bills");
}

/** Fetch a specific sample bill by ID as NormalizedBill */
export async function fetchSampleBillById(billId: string): Promise<NormalizedBill> {
  return await apiFetch<NormalizedBill>(`/audit/sample-bills/${billId}`);
}

/** Fetch the 37 government statutory rules */
export async function fetchStatutoryRules(): Promise<StatutoryRule[]> {
  return await apiFetch<StatutoryRule[]>("/audit/statutory-rules");
}

/** Execute 1-click deterministic audit demo */
export async function runDemoAudit(): Promise<AuditReportResponse> {
  return await apiFetch<AuditReportResponse>("/audit/demo", {
    method: "POST",
  });
}

/** Run deterministic rule engine on a NormalizedBill */
export async function analyzeBill(bill: NormalizedBill): Promise<AuditReportResponse> {
  return await apiFetch<AuditReportResponse>("/audit/analyze-bill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bill),
  });
}

/** Upload document (PDF or Image) and run extraction */
export async function uploadBill(
  file: File,
  state: string = "Delhi",
  scheme: string = "CGHS",
): Promise<{
  job_id: string;
  status: string;
  extraction_status?: string;
  ocr_required?: boolean;
  normalized_bill?: NormalizedBill;
  message: string;
}> {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("state", state);
  formData.append("scheme", scheme);

  const res = await fetch(`${baseUrl}/audit/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errorMsg = `Upload error (${res.status}): ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) {
        errorMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {}
    throw new Error(errorMsg);
  }

  return await res.json();
}

/**
 * Upload a bill file and automatically analyze it.
 * If PDF contains line items, runs the rule engine on extracted bill.
 * If not, falls back to demo audit.
 */
export async function uploadAndAnalyzeFile(
  file: File,
  state: string = "Delhi",
  scheme: string = "CGHS",
): Promise<AuditReportResponse> {
  const uploadResult = await uploadBill(file, state, scheme);

  if (uploadResult.normalized_bill && uploadResult.normalized_bill.items?.length > 0) {
    return await analyzeBill(uploadResult.normalized_bill);
  }

  // Fallback to demo audit if OCR is pending or not a PDF with tables
  return await runDemoAudit();
}

/** Ask the AI Patient Advocate Assistant */
export async function askAIChat(request: AuditChatRequest): Promise<AuditChatResponse> {
  return await apiFetch<AuditChatResponse>("/audit/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
}

/** Generate formal patient dispute letter and dossier */
export async function generateDisputeLetter(request: DisputeLetterRequest): Promise<DisputeLetterResponse> {
  return await apiFetch<DisputeLetterResponse>("/audit/dispute-letter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
}

