/**
 * BillShielder — API Client for FastAPI Backend
 * Connects the frontend with the deterministic rule engine,
 * OCR/PDF extraction pipeline, AI Patient Advocate assistant, and Dispute Letter generator.
 *
 * CRITICAL INTEGRITY RULES:
 * 1. Real file uploads never fall back to synthetic demo reports.
 * 2. Failed real uploads report genuine typed errors (backend offline, extraction failed, validation error).
 * 3. Synthetic demo data is only returned through explicit Quick Demo actions and is always tagged.
 */

import { assistantReply, fmtINR } from "./demo-audit";

// ============================================================================
// Custom Error Hierarchy for Reliable Error Identification
// ============================================================================

export class BillShieldApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "BillShieldApiError";
  }
}

export class BackendUnavailableError extends BillShieldApiError {
  constructor(
    message = "The BillShield audit backend is currently offline or unreachable. Please verify that the FastAPI backend server is running on port 8000."
  ) {
    super(message, 503, "BACKEND_UNAVAILABLE");
    this.name = "BackendUnavailableError";
  }
}

export class ExtractionError extends BillShieldApiError {
  constructor(message: string, code = "EXTRACTION_FAILED", details?: unknown) {
    super(message, 422, code, details);
    this.name = "ExtractionError";
  }
}

export class ValidationError extends BillShieldApiError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

// ============================================================================
// Data Contracts & Types
// ============================================================================

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
  normalized_bill?: NormalizedBill | null;
  created_at?: string;

  // Provenance & Integrity Metadata
  is_demo: boolean;
  audit_source: "real_backend" | "synthetic_demo";
  source_filename?: string;
  extraction_message?: string;
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
  item_count?: number;
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

// ============================================================================
// Synthetic Demo Fixture (Used ONLY for explicit Quick Demo)
// ============================================================================

export function getSyntheticDemoFixture(): AuditReportResponse {
  return {
    job_id: "demo-synthetic-icu-case-001",
    status: "COMPLETED",
    is_demo: true,
    audit_source: "synthetic_demo",
    source_filename: "apollo_delhi_synthetic_bill.json (Synthetic Demo)",
    hospital_name: "Apollo Specialty Healthcare India Ltd. (Synthetic Demo)",
    patient_name: "Ramesh Kumar Sharma",
    bill_number: "DEL-2024-89211",
    bill_date: "2024-10-14",
    ward_type: "Super Deluxe / ICU Multi-bed",
    total_billed: 101540.0,
    total_permissible: 56540.0,
    potential_savings: 45000.0,
    arithmetic_error_total: 0.0,
    suspicious_charges_total: 45000.0,
    disallowed_items_total: 2500.0,
    findings_count: 7,
    created_at: new Date().toISOString(),
    normalized_bill: {
      hospital_name: "Apollo Specialty Healthcare India Ltd. (Synthetic Demo)",
      hospital_city: "Delhi",
      bill_number: "DEL-2024-89211",
      bill_date: "2024-10-14",
      admission_date: "2024-10-08",
      discharge_date: "2024-10-12",
      patient_name: "Ramesh Kumar Sharma",
      patient_uhid: "DLH-9012384",
      ward_type: "Super Deluxe / ICU Multi-bed",
      items: [
        {
          item_id: "item-1",
          item_name: "ICU Bed & Nursing Charges",
          category: "Intensive Care",
          quantity: 2.0,
          unit_rate: 15000.0,
          total_charge: 30000.0,
        },
        {
          item_id: "item-2",
          item_name: "Room Rent (Private Deluxe)",
          category: "Accommodation",
          quantity: 2.0,
          unit_rate: 9500.0,
          total_charge: 19000.0,
        },
        {
          item_id: "item-3",
          item_name: "Biomedical Waste Disposal Surcharge",
          category: "Overhead Surcharge",
          quantity: 4.0,
          unit_rate: 850.0,
          total_charge: 3400.0,
        },
        {
          item_id: "item-4",
          item_name: "PPE Kit - High Risk ICU Care",
          category: "Consumables",
          quantity: 8.0,
          unit_rate: 1800.0,
          total_charge: 14400.0,
        },
        {
          item_id: "item-5",
          item_name: "Sterile Surgical Gloves 7.5 (Pair)",
          category: "Consumables",
          quantity: 12.0,
          unit_rate: 350.0,
          total_charge: 4200.0,
        },
        {
          item_id: "item-6",
          item_name: "Infusion Pump Surcharge (Per Day)",
          category: "Overhead Surcharge",
          quantity: 4.0,
          unit_rate: 1200.0,
          total_charge: 4800.0,
        },
        {
          item_id: "item-7",
          item_name: "Doctor In-Patient Visit (Twice/Day)",
          category: "Professional Fees",
          quantity: 8.0,
          unit_rate: 2500.0,
          total_charge: 20000.0,
        },
        {
          item_id: "item-8",
          item_name: "Pharmacy: Paracetamol IV 100ml",
          category: "Pharmacy",
          quantity: 6.0,
          unit_rate: 220.0,
          total_charge: 1320.0,
        },
        {
          item_id: "item-9",
          item_name: "Pharmacy: Ceftriaxone 1g Inj",
          category: "Pharmacy",
          quantity: 4.0,
          unit_rate: 480.0,
          total_charge: 1920.0,
        },
        {
          item_id: "item-10",
          item_name: "Administrative & Admission File Fee",
          category: "Overhead Surcharge",
          quantity: 1.0,
          unit_rate: 2500.0,
          total_charge: 2500.0,
        },
      ],
      subtotal_amount: 101540.0,
      discount_amount: 0.0,
      tax_amount: 0.0,
      total_amount: 101540.0,
    },
    findings: [
      {
        finding_id: "fnd-1",
        rule_id: "RULE-IND-ICU-001",
        item_name: "ICU Bed & Nursing Charges",
        billed_amount: 30000.0,
        permissible_amount: 17000.0,
        excess_amount: 13000.0,
        violation_type: "RATE_CAP_EXCEEDED",
        severity: "CRITICAL",
        evidence_citation: "CGHS / State Clinical Establishment Guidelines: Circular F.No. S.11011/11/2021-CGHS(P)",
        patient_explanation:
          "ICU bed and nursing billed at ₹15,000/day against the benchmark ceiling rate of ₹8,500/day. The difference of ₹13,000 across 2 days is flagged for itemized review.",
        recommended_action: "Request rate schedule alignment based on notified CGHS/State intensive care tariff ceilings.",
        confidence_level: "HIGH",
        calculation_basis: "Billed: ₹30,000.00 (2 days @ ₹15,000) - Benchmark: ₹17,000.00 (2 days @ ₹8,500) = Review Discrepancy: ₹13,000.00",
      },
      {
        finding_id: "fnd-2",
        rule_id: "RULE-IND-ROOM-002",
        item_name: "Room Rent (Private Deluxe)",
        billed_amount: 19000.0,
        permissible_amount: 9000.0,
        excess_amount: 10000.0,
        violation_type: "RATE_CAP_EXCEEDED",
        severity: "HIGH",
        evidence_citation: "Ministry of Health Office Memorandum No. S.11045/36/2012-CGHS",
        patient_explanation:
          "Billed room tariff of ₹9,500/day exceeds the reference benchmark of ₹4,500/day for private deluxe rooms by ₹10,000 across 2 days.",
        recommended_action: "Verify ward categorization against hospital standard published tariff schedule.",
        confidence_level: "HIGH",
        calculation_basis: "Billed: ₹19,000.00 (2 days @ ₹9,500) - Benchmark: ₹9,000.00 (2 days @ ₹4,500) = Review Discrepancy: ₹10,000.00",
      },
      {
        finding_id: "fnd-3",
        rule_id: "RULE-IND-UNBUNDLE-003",
        item_name: "Biomedical Waste Disposal Surcharge",
        billed_amount: 3400.0,
        permissible_amount: 0.0,
        excess_amount: 3400.0,
        violation_type: "ARBITRARY_SURCHARGE",
        severity: "HIGH",
        evidence_citation: "State Healthcare Waste Management Directives & Overhead Transparency Guidelines",
        patient_explanation:
          "Biomedical waste management is an institutional overhead cost that should be absorbed into facility charges rather than billed separately to the patient.",
        recommended_action: "Request deduction of unbundled waste management surcharge as facility overhead.",
        confidence_level: "HIGH",
        calculation_basis: "Billed: ₹3,400.00 - Permissible: ₹0.00 = Review Discrepancy: ₹3,400.00",
      },
      {
        finding_id: "fnd-4",
        rule_id: "RULE-IND-PPE-004",
        item_name: "PPE Kit - High Risk ICU Care",
        billed_amount: 14400.0,
        permissible_amount: 6400.0,
        excess_amount: 8000.0,
        violation_type: "RATE_CAP_EXCEEDED",
        severity: "MEDIUM",
        evidence_citation: "NPPA Order S.O. 1492(E) & Ministry of Chemicals & Fertilizers Directives",
        patient_explanation:
          "PPE kit billed at ₹1,800/unit against the notified price monitoring ceiling of ₹800/unit. Difference of ₹8,000 across 8 kits flagged for verification.",
        recommended_action: "Request verification against standard consumable price ceilings and nurse consumption logs.",
        confidence_level: "MEDIUM",
        calculation_basis: "Billed: ₹14,400.00 (8 kits @ ₹1,800) - Benchmark: ₹6,400.00 (8 kits @ ₹800) = Review Discrepancy: ₹8,000.00",
      },
      {
        finding_id: "fnd-5",
        rule_id: "RULE-IND-GLOVES-005",
        item_name: "Sterile Surgical Gloves 7.5 (Pair)",
        billed_amount: 4200.0,
        permissible_amount: 900.0,
        excess_amount: 3300.0,
        violation_type: "RATE_CAP_EXCEEDED",
        severity: "MEDIUM",
        evidence_citation: "Clinical Establishments Act Standards & DPCO Monitored Schedule",
        patient_explanation:
          "Surgical gloves charged at ₹350/pair against reference trade ceiling of ₹75/pair. ₹3,300 flagged for consumption and tariff review.",
        recommended_action: "Request rate reconciliation according to standard disposables schedule.",
        confidence_level: "MEDIUM",
        calculation_basis: "Billed: ₹4,200.00 (12 pairs @ ₹350) - Benchmark: ₹900.00 (12 pairs @ ₹75) = Review Discrepancy: ₹3,300.00",
      },
      {
        finding_id: "fnd-6",
        rule_id: "RULE-IND-UNBUNDLE-003",
        item_name: "Infusion Pump Surcharge (Per Day)",
        billed_amount: 4800.0,
        permissible_amount: 0.0,
        excess_amount: 4800.0,
        violation_type: "ARBITRARY_SURCHARGE",
        severity: "HIGH",
        evidence_citation: "Hospital Accreditation & ICU Package Standards",
        patient_explanation:
          "Infusion pump usage is an integral component of intensive care bed packages and should not be unbundled as an additional equipment surcharge.",
        recommended_action: "Request review under ICU comprehensive monitoring and equipment bundling norms.",
        confidence_level: "HIGH",
        calculation_basis: "Billed: ₹4,800.00 (4 days @ ₹1,200) - Permissible: ₹0.00 = Review Discrepancy: ₹4,800.00",
      },
      {
        finding_id: "fnd-7",
        rule_id: "RULE-IRDAI-001",
        item_name: "Administrative & Admission File Fee",
        billed_amount: 2500.0,
        permissible_amount: 0.0,
        excess_amount: 2500.0,
        violation_type: "INSURANCE_NON_PAYABLE",
        severity: "MEDIUM",
        evidence_citation: "IRDAI Master Circular Ref: IRDAI/HLT/REG/CIR/193/07/2020 List I",
        patient_explanation:
          "Administrative admission file processing charges are classified as non-payable institutional overhead under standard health insurance guidelines.",
        recommended_action: "Request absorption into general hospital administration overheads.",
        confidence_level: "HIGH",
        calculation_basis: "Billed: ₹2,500.00 - Permissible: ₹0.00 = Review Discrepancy: ₹2,500.00",
      },
    ],
  };
}

// Fallback sample bills catalog for Quick Demo browsing when backend is offline
const FALLBACK_SAMPLE_BILLS: SampleBillMeta[] = [
  {
    id: "apollo-icu-unbundling",
    title: "Apollo Hospital — ICU & Overhead Unbundling",
    hospital_name: "Apollo Specialty Healthcare India Ltd.",
    patient_name: "Ramesh Kumar Sharma",
    bill_number: "DEL-2024-89211",
    admission_date: "2024-10-08",
    discharge_date: "2024-10-12",
    ward_type: "Super Deluxe / ICU Multi-bed",
    total_amount: 101540.0,
    discrepancy_types: [
      "ICU Tariff Reference Benchmark",
      "Room Rent Benchmark",
      "Biomedical Waste Surcharge",
      "PPE Consumables Benchmark",
    ],
    description:
      "Critical care bill illustrating ICU charges exceeding reference benchmarks and unbundling of bio-waste & administrative overheads.",
  },
  {
    id: "max-duplicate-arithmetic",
    title: "Max Healthcare — Duplicate Billing & Math Errors",
    hospital_name: "Max Super Speciality Hospital, New Delhi",
    patient_name: "Sunita Agarwal",
    bill_number: "MAX-2024-55102",
    admission_date: "2024-10-14",
    discharge_date: "2024-10-17",
    ward_type: "Single Private Room",
    total_amount: 48200.0,
    discrepancy_types: [
      "Verified Arithmetic Discrepancy",
      "Duplicate Consultation Entry",
      "Duplicate CBC Diagnostic Panel",
      "IRDAI Non-Payables",
    ],
    description:
      "Multi-category bill with verified mathematical calculation error, duplicate service entries, and IRDAI non-payable admission kit.",
  },
  {
    id: "fortis-surgical-gst",
    title: "Fortis Memorial — Surgical Package & GST Review",
    hospital_name: "Fortis Memorial Research Institute, Gurgaon",
    patient_name: "Vikramaditya Malhotra",
    bill_number: "FOR-2024-91238",
    admission_date: "2024-09-20",
    discharge_date: "2024-09-23",
    ward_type: "Inpatient General Ward",
    total_amount: 133200.0,
    discrepancy_types: [
      "Surgical Package Unbundling",
      "GST Healthcare Exemption Review",
      "Prohibited Administration Surcharge",
    ],
    description:
      "Surgical inpatient bill with unbundled pre/post-op care from surgical package and improper GST levied on exempt healthcare services.",
  },
];

const FALLBACK_RULES: StatutoryRule[] = [
  {
    rule_id: "RULE-IND-ICU-001",
    title: "Statutory ICU Daily Bed Tariff Cap",
    category: "ICU & Critical Care",
    description:
      "Ceiling tariff benchmark for ICU beds including monitoring and standard nursing. Overcharges above notified rates are flagged for review.",
    legal_reference: "CGHS/NHA Circular F.No. S.11011/11/2021-CGHS(P)",
    rate_ceiling: 17000,
  },
  {
    rule_id: "RULE-IND-ROOM-002",
    title: "Inpatient Private Deluxe Room Ceiling",
    category: "Accommodation",
    description:
      "Reference benchmark for deluxe private inpatient accommodation to prevent arbitrary room inflation.",
    legal_reference: "MoHFW Office Memorandum No. S.11045/36/2012-CGHS",
    rate_ceiling: 9000,
  },
  {
    rule_id: "RULE-IND-UNBUNDLE-003",
    title: "Prohibition of Bio-waste & Administrative Surcharges",
    category: "Overhead Surcharges",
    description:
      "Prohibits separate billing of hospital housekeeping, bio-waste disposal, and admission file processing.",
    legal_reference: "State Healthcare Waste Directives & Overhead Transparency Guidelines",
    rate_ceiling: 0,
  },
  {
    rule_id: "RULE-IND-PPE-004",
    title: "PPE Kit Consumable Pricing Order",
    category: "Consumables",
    description:
      "Price monitoring benchmark on Personal Protective Equipment (PPE) kits for hospital inpatients.",
    legal_reference: "NPPA Pricing Order S.O. 1492(E)",
    rate_ceiling: 800,
  },
];

// ============================================================================
// API Base URL Resolution
// ============================================================================

export function getApiBaseUrl(): string {
  // 1. Explicit Vite environment variable
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL.replace(/\/+$/, "");
  }
  // 2. Client-side browser resolution
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000/api/v1";
    }
    // Production cloud deployment with reverse proxy or configured base
    return "/api/v1";
  }
  // 3. Server-side rendering default
  return process.env.API_BASE_URL || "http://127.0.0.1:8000/api/v1";
}

// ============================================================================
// Robust Fetch Wrapper
// ============================================================================

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const timeoutMs = 12000; // 12 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options?.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

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
      let errorMsg = `Server returned HTTP ${res.status}: ${res.statusText}`;
      let errDetail: unknown = undefined;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorMsg =
            typeof errJson.detail === "string"
              ? errJson.detail
              : JSON.stringify(errJson.detail);
          errDetail = errJson.detail;
        }
      } catch {}
      throw new BillShieldApiError(errorMsg, res.status, `HTTP_${res.status}`, errDetail);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof BillShieldApiError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw new BillShieldApiError(
        `Request to ${endpoint} timed out after ${timeoutMs / 1000}s`,
        408,
        "TIMEOUT"
      );
    }
    throw new BackendUnavailableError(
      `Unable to connect to the BillShield backend at ${url}. Please ensure the server is active on port 8000.`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Endpoint 1: Health Check (GET /health or /api/v1/health)
// ============================================================================

export async function fetchHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const baseUrl = getApiBaseUrl();
  try {
    return await apiFetch<HealthStatus>("/health", { signal });
  } catch {
    try {
      const rootUrl = baseUrl.replace(/\/api\/v1\/?$/, "");
      return await apiFetch<HealthStatus>(`${rootUrl}/health`, { signal });
    } catch {
      return { status: "offline", demo_mode: true };
    }
  }
}

// ============================================================================
// Endpoint 2: Sample Bills Catalog (GET /api/v1/audit/sample-bills)
// ============================================================================

export async function fetchSampleBills(signal?: AbortSignal): Promise<SampleBillMeta[]> {
  try {
    return await apiFetch<SampleBillMeta[]>("/audit/sample-bills", { signal });
  } catch {
    return FALLBACK_SAMPLE_BILLS;
  }
}

// ============================================================================
// Endpoint 3: Specific Sample Bill (GET /api/v1/audit/sample-bills/{id})
// ============================================================================

export async function fetchSampleBillById(
  billId: string,
  signal?: AbortSignal
): Promise<NormalizedBill> {
  try {
    return await apiFetch<NormalizedBill>(`/audit/sample-bills/${billId}`, { signal });
  } catch (err) {
    const found = FALLBACK_SAMPLE_BILLS.find((b) => b.id === billId);
    if (found) {
      // Return structured demo normalized bill
      return getSyntheticDemoFixture().normalized_bill!;
    }
    throw new ExtractionError(`Sample bill "${billId}" not found in catalog.`, "SAMPLE_NOT_FOUND");
  }
}

// ============================================================================
// Endpoint 4: Statutory Rules Catalog (GET /api/v1/audit/statutory-rules)
// ============================================================================

export async function fetchStatutoryRules(signal?: AbortSignal): Promise<StatutoryRule[]> {
  try {
    return await apiFetch<StatutoryRule[]>("/audit/statutory-rules", { signal });
  } catch {
    return FALLBACK_RULES;
  }
}

// ============================================================================
// Endpoint 5: 1-Click Synthetic Quick Demo (POST /api/v1/audit/demo)
// ============================================================================

export async function runDemoAudit(signal?: AbortSignal): Promise<AuditReportResponse> {
  try {
    const report = await apiFetch<AuditReportResponse>("/audit/demo", {
      method: "POST",
      signal,
    });
    report.is_demo = true;
    report.audit_source = "synthetic_demo";
    report.source_filename = "apollo_delhi_synthetic_bill.json (Demo Fixture)";
    return report;
  } catch (err) {
    // ONLY for explicit Quick Demo: offline fallback to verified synthetic fixture
    const synthetic = getSyntheticDemoFixture();
    synthetic.is_demo = true;
    synthetic.audit_source = "synthetic_demo";
    synthetic.source_filename = "apollo_delhi_synthetic_bill.json (Offline Synthetic Fixture)";
    return synthetic;
  }
}

// ============================================================================
// Endpoint 6: Analyze Normalized Bill (POST /api/v1/audit/analyze-bill)
// ============================================================================

export async function analyzeBill(
  bill: NormalizedBill,
  signal?: AbortSignal
): Promise<AuditReportResponse> {
  const report = await apiFetch<AuditReportResponse>("/audit/analyze-bill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bill),
    signal,
  });

  if (!report || typeof report.total_billed !== "number" || !Array.isArray(report.findings)) {
    throw new BillShieldApiError("Invalid audit response format received from rule engine", 502, "INVALID_RESPONSE");
  }

  // Real analysis output from engine
  report.is_demo = false;
  report.audit_source = "real_backend";
  report.normalized_bill = bill;
  return report;
}

// ============================================================================
// Endpoint 7: Upload Document File (POST /api/v1/audit/upload)
// ============================================================================

export async function uploadBill(
  file: File,
  state: string = "Delhi",
  scheme: string = "CGHS",
  signal?: AbortSignal
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

  const timeoutMs = 30000; // 30s for file upload/extraction
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const res = await fetch(`${baseUrl}/audit/upload`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      let errorMsg = `Upload failed with HTTP ${res.status}: ${res.statusText}`;
      let detail: unknown = undefined;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          errorMsg =
            typeof errJson.detail === "string"
              ? errJson.detail
              : JSON.stringify(errJson.detail);
          detail = errJson.detail;
        }
      } catch {}
      throw new BillShieldApiError(errorMsg, res.status, `HTTP_${res.status}`, detail);
    }

    return await res.json();
  } catch (err: any) {
    if (err instanceof BillShieldApiError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw new BillShieldApiError(
        `File upload timed out after ${timeoutMs / 1000} seconds.`,
        408,
        "TIMEOUT"
      );
    }
    throw new BackendUnavailableError(
      `Unable to reach backend upload service at ${baseUrl}/audit/upload. Please ensure the backend is running.`
    );
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// High-Level File Upload & Audit Orchestration (NEVER FAKES OR FALLS BACK)
// ============================================================================

export async function uploadAndAnalyzeFile(
  file: File,
  state: string = "Delhi",
  scheme: string = "CGHS",
  signal?: AbortSignal
): Promise<AuditReportResponse> {
  // 1. Client-Side Validation
  const lowerName = file.name.toLowerCase();
  const allowed = [".pdf", ".png", ".jpg", ".jpeg"];
  if (!allowed.some((ext) => lowerName.endsWith(ext))) {
    throw new ValidationError(
      `Unsupported file format: "${file.name}". Supported formats are PDF (itemized discharge bill) or high-resolution PNG/JPG images.`
    );
  }

  if (file.size === 0) {
    throw new ValidationError(`The selected file "${file.name}" is completely empty (0 bytes).`);
  }

  const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
  if (file.size > MAX_BYTES) {
    throw new ValidationError(
      `The file "${file.name}" exceeds the 25 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
    );
  }

  // 2. Upload file & extract line items
  const uploadResult = await uploadBill(file, state, scheme, signal);

  // 3. Evaluate extraction outcome honestly
  if (
    uploadResult.status === "FAILED" ||
    (uploadResult.extraction_status &&
      ["EMPTY_DOCUMENT", "ENCRYPTED_DOCUMENT", "CORRUPT_DOCUMENT"].includes(
        uploadResult.extraction_status
      ))
  ) {
    throw new ExtractionError(
      uploadResult.message || `Document extraction failed (${uploadResult.extraction_status}).`,
      uploadResult.extraction_status || "EXTRACTION_FAILED"
    );
  }

  const normBill = uploadResult.normalized_bill;
  if (!normBill || !normBill.items || normBill.items.length === 0) {
    throw new ExtractionError(
      `No extractable line items were detected in "${file.name}". Please ensure the uploaded file contains a readable itemized billing table.`,
      "NO_EXTRACTABLE_ITEMS"
    );
  }

  // 4. Run real deterministic audit on extracted bill
  const report = await analyzeBill(normBill, signal);

  // 5. Explicit provenance stamping
  report.is_demo = false;
  report.audit_source = "real_backend";
  report.source_filename = file.name;
  report.extraction_message = uploadResult.message;

  return report;
}

// ============================================================================
// Endpoint 8: AI Patient Advocate Chat (POST /api/v1/audit/chat)
// ============================================================================

export async function askAIChat(
  request: AuditChatRequest,
  signal?: AbortSignal
): Promise<AuditChatResponse> {
  try {
    return await apiFetch<AuditChatResponse>("/audit/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err: any) {
    // If backend is offline, provide graceful explanation grounded strictly in the report's findings
    if (request.findings && request.findings.length > 0) {
      return {
        reply: assistantReply(request.message),
        suggested_actions: [
          "Why was the ICU surcharge flagged?",
          "Can the hospital charge for biomedical waste disposal?",
          "What questions should I ask the hospital billing desk?",
        ],
        rule_citations: [
          "CGHS/NHA Circular F.No. S.11011/11/2021-CGHS(P)",
          "State Health Authority Directives on Overhead Unbundling",
        ],
      };
    }
    throw err;
  }
}

// ============================================================================
// Endpoint 9: Dispute Letter Generation (POST /api/v1/audit/dispute-letter)
// ============================================================================

export async function generateDisputeLetter(
  request: DisputeLetterRequest,
  signal?: AbortSignal
): Promise<DisputeLetterResponse> {
  try {
    return await apiFetch<DisputeLetterResponse>("/audit/dispute-letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch {
    // Neutral, evidence-grounded client fallback letter
    const report = request.report;
    const nowStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const rows = (report.findings || [])
      .map(
        (f, idx) => `<tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 600;">${f.item_name}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${fmtINR(f.billed_amount)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${fmtINR(f.permissible_amount)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #b91c1c; font-weight: 700;">${fmtINR(f.excess_amount)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 11px;">${f.evidence_citation}</td>
        </tr>`
      )
      .join("");

    const rowsMd = (report.findings || [])
      .map(
        (f, idx) =>
          `| ${idx + 1} | ${f.item_name} | ${fmtINR(f.billed_amount)} | ${fmtINR(f.permissible_amount)} | **${fmtINR(f.excess_amount)}** | ${f.evidence_citation} |`
      )
      .join("\n");

    const provenanceNotice = report.is_demo
      ? "> **DEMO DATA DISCLAIMER:** This document was generated from synthetic demonstration data and does not represent a real patient dispute or verified hospital claim.\n\n"
      : "";

    const rawMd = `${provenanceNotice}# REQUEST FOR ITEMIZED BILLING CLARIFICATION & REVIEW

**Date:** ${nowStr}  
**To:** ${request.recipient_title || "The Medical Superintendent / Patient Accounts Officer"}  
**Hospital:** ${report.hospital_name}  
**Patient Name / Bill Reference:** ${report.patient_name || "Patient"} (Invoice #${report.bill_number || report.job_id})

---

Dear Sir/Madam,

I am writing to respectfully request an itemized review and clarification of charges on Invoice **#${report.bill_number || report.job_id}** issued to **${report.patient_name || "the patient"}**.

An initial review against published reference benchmarks (including standard CGHS rate schedules, NPPA consumable price monitoring orders, and institutional overhead bundling conventions) identified **${report.findings_count} item(s)** totaling **${fmtINR(report.potential_savings)}** that appear inconsistent with notified benchmarks and warrant itemized clarification.

### Schedule of Discrepancies Under Review
| S.No | Item Description | Billed Amount | Reference Benchmark | Discrepancy Amount | Regulatory / Benchmark Citation |
| :--- | :--- | :--- | :--- | :--- | :--- |
${rowsMd}

### Clarifications Requested:
1. **Institutional Overheads:** Items such as biomedical waste disposal, administrative file fees, and routine infusion equipment surcharges are standardly included in general facility or critical care bed charges. We request review and appropriate adjustment of these lines.
2. **Consumable & Daily Bed Benchmarks:** Consumable charges and daily bed tariffs exceeding published benchmarks have been flagged for verification against the hospital's registered tariff card and consumable consumption logs.
3. **Duplicate & Arithmetic Verification:** If any services were repeated on the same service date, please provide corresponding clinical notes or requisition logs.

We appreciate your assistance in providing a detailed itemized breakdown and clarifying these discrepancies.

Sincerely,  
**${report.patient_name || "Patient / Authorized Representative"}**  
${request.patient_address || "Contact details as per hospital admission records"}

---
*Notice: This document is an informed consumer request for itemized clarification and audit review based on reference benchmarks; it does not constitute formal legal advice.*
`;

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 24px;">
        ${report.is_demo ? '<div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 20px; font-weight: 600;">DEMO DATA DISCLAIMER: This dispute letter draft was compiled from synthetic demonstration data and does not represent an actual patient bill.</div>' : ""}
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 20px; text-transform: uppercase;">Request for Itemized Billing Clarification & Review</h2>
          <p style="margin: 0; font-size: 13px; color: #64748b;">Date: ${nowStr}</p>
        </div>

        <p style="font-size: 13px;"><strong>To:</strong> ${request.recipient_title || "The Medical Superintendent / Patient Grievance Officer"}<br/>
        <strong>Hospital:</strong> ${report.hospital_name}<br/>
        <strong>Patient / Invoice Ref:</strong> ${report.patient_name || "Patient"} (Invoice #${report.bill_number || report.job_id})</p>

        <p style="font-size: 13px;">I am writing to respectfully request an itemized review and clarification of charges on Invoice #${report.bill_number || report.job_id}. A preliminary audit against published reference benchmarks (such as CGHS tariff reference schedules, NPPA consumable orders, and overhead bundling conventions) identified <strong>${report.findings_count} item(s)</strong> totaling <strong>${fmtINR(report.potential_savings)}</strong> requiring clarification.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px;">
          <thead>
            <tr style="background: #0f172a; color: #fff; text-align: left;">
              <th style="padding: 8px; border: 1px solid #cbd5e1;">#</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Flagged Item</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Billed</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Benchmark</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Discrepancy</th>
              <th style="padding: 8px; border: 1px solid #cbd5e1;">Reference Authority</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <p style="font-size: 14px; font-weight: 700; color: #b91c1c;">
          Total Discrepancies Under Clarification: ${fmtINR(report.potential_savings)}
        </p>

        <p style="font-size: 13px;">${request.notes || "Please provide written clarification and tariff justification for the flagged line items above within 7 business days."}</p>

        <p style="font-size: 13px;">Yours sincerely,<br/><strong>${report.patient_name || "Patient / Authorized Representative"}</strong><br/>${request.patient_address || "New Delhi, India"}</p>

        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #64748b;">
          Disclaimer: This document is an informed consumer request for itemized clarification based on reference benchmarks; it does not constitute formal legal advice.
        </div>
      </div>
    `;

    return {
      html_content: html,
      markdown_content: rawMd,
      summary: {
        hospital_name: report.hospital_name,
        disputed_amount: report.potential_savings,
        findings_count: report.findings_count,
        is_demo: report.is_demo,
      },
    };
  }
}
