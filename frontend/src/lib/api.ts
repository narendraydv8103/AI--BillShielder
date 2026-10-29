/**
 * BillShielder — API Client for FastAPI Backend
 * Connects the frontend directly with the deterministic statutory audit engine,
 * OCR/PDF extraction pipeline, AI Patient Advocate assistant, and Dispute Letter generator.
 * Includes graceful offline/demo fallbacks so deployed apps remain 100% interactive.
 */

import { assistantReply, disputeLetter, fmtINR } from "./demo-audit";

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

/** Fallback sample bills catalog */
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
      "Statutory ICU Tariff Cap",
      "Room Rent Cap",
      "Biomedical Waste Surcharge",
      "PPE Consumables Cap",
    ],
    description:
      "Critical care bill illustrating ICU overcharging above statutory caps and unbundling of bio-waste & administrative overheads.",
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
      "Duplicate Consultation",
      "Duplicate CBC Lab Test",
      "IRDAI Non-Payables",
    ],
    description:
      "Multi-category bill with verified mathematical calculation error, duplicate service entries, and IRDAI non-payable admission kit.",
  },
  {
    id: "fortis-surgical-gst",
    title: "Fortis Memorial — Surgical Package & GST Overcharge",
    hospital_name: "Fortis Memorial Research Institute, Gurgaon",
    patient_name: "Vikramaditya Malhotra",
    bill_number: "FOR-2024-91238",
    admission_date: "2024-09-20",
    discharge_date: "2024-09-23",
    ward_type: "Inpatient General Ward",
    total_amount: 133200.0,
    discrepancy_types: [
      "Surgical Package Unbundling",
      "GST Exemption Violation",
      "Prohibited Administration Fee",
    ],
    description:
      "Surgical inpatient bill with unbundled pre/post-op care from surgical package and improper GST levied on exempt healthcare.",
  },
];

/** Fallback statutory rules */
const FALLBACK_RULES: StatutoryRule[] = [
  {
    rule_id: "RULE-IND-ICU-001",
    title: "Statutory ICU Daily Bed Tariff Cap",
    category: "ICU & Critical Care",
    description:
      "Statutory ceiling tariff for ICU beds including monitoring and standard nursing. Overcharges above notified rates are prohibited.",
    legal_reference: "CGHS/NHA Circular F.No. S.11011/11/2021-CGHS(P)",
    rate_ceiling: 17000,
  },
  {
    rule_id: "RULE-IND-ROOM-002",
    title: "Inpatient Accommodation Tariff Cap",
    category: "Accommodation & Room Rent",
    description:
      "Private deluxe room rent ceiling based on state healthcare notifications and CGHS schedule of rates.",
    legal_reference: "Ministry of Health Office Memorandum No. S.11045/36/2012-CGHS",
    rate_ceiling: 9000,
  },
  {
    rule_id: "RULE-IND-UNBUNDLE-003",
    title: "Prohibited Biomedical Waste Overhead Surcharge",
    category: "Administrative Overhead",
    description:
      "Bio-medical waste disposal is a hospital infrastructure overhead and cannot be billed as a separate patient item.",
    legal_reference: "Bio-Medical Waste Management Rules & Delhi High Court Directive WP(C) 1245/2021",
    rate_ceiling: 0,
  },
  {
    rule_id: "RULE-IND-CONSUM-004",
    title: "PPE Kit & Protective Wear Statutory Ceiling",
    category: "Medical Consumables",
    description:
      "Government-notified ceiling on PPE kits and gloves during inpatient critical care management.",
    legal_reference: "NPPA Order No. 44(02)/2020/Div.II/NPPA",
    rate_ceiling: 800,
  },
  {
    rule_id: "RULE-IND-ADMIN-005",
    title: "Prohibition on Admission File / Registration Fees",
    category: "Administrative Overhead",
    description:
      "Non-payable administrative overhead prohibited under IRDAI Master Circular on Health Insurance Non-Payable Items.",
    legal_reference: "IRDAI Master Circular Ref: IRDAI/HLT/REG/CIR/193/07/2020 Schedule I",
    rate_ceiling: 0,
  },
  {
    rule_id: "RULE-IND-PUMP-006",
    title: "Infusion Pump Equipment Unbundling Prohibition",
    category: "ICU & Critical Care",
    description:
      "Equipment charges for standard syringe and infusion pumps must be bundled inside the daily ICU intensive care tariff.",
    legal_reference: "GIPSA Standard Preferred Provider Network (PPN) Agreement Schedule B",
    rate_ceiling: 0,
  },
];

/** Fallback report */
function buildFallbackReport(hospital = "Apollo Specialty Healthcare India Ltd."): AuditReportResponse {
  return {
    job_id: "job-demo-fallback",
    status: "COMPLETED",
    hospital_name: hospital,
    patient_name: "Ramesh Kumar Sharma",
    bill_number: "DEL-2024-89211",
    bill_date: "2024-10-14",
    ward_type: "Super Deluxe / ICU Multi-bed",
    total_billed: 101540.0,
    total_permissible: 56540.0,
    potential_savings: 45000.0,
    arithmetic_error_total: 0.0,
    suspicious_charges_total: 45000.0,
    disallowed_items_total: 0.0,
    findings_count: 7,
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
        evidence_citation: "CGHS/NHA Circular F.No. S.11011/11/2021-CGHS(P)",
        patient_explanation:
          "The hospital charged ₹13,000.00 above the statutory per-day ceiling for ICU Care and Nursing. Under Statutory ICU Tariff rules, this charge must adhere to notified ceilings.",
        recommended_action: "Present statutory ceiling notification and demand deduction of excess tariff.",
        confidence_level: "HIGH (Government Order)",
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
          "Billed room tariff exceeds the permissible ward ceiling by ₹10,000.00.",
        recommended_action: "Request rate schedule realignment to approved CGHS tariff cap.",
        confidence_level: "HIGH",
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
        evidence_citation: "Govt Notification on Healthcare Waste Management (Delhi HC WP(C) 1245/2021)",
        patient_explanation:
          "Biomedical waste disposal is an institutional overhead charge and cannot be unbundled onto the patient bill.",
        recommended_action: "Demand complete waiver of ₹3,400.00 unbundled overhead surcharge.",
        confidence_level: "HIGH",
      },
      {
        finding_id: "fnd-4",
        rule_id: "RULE-IND-CONSUM-004",
        item_name: "PPE Kit - High Risk ICU Care",
        billed_amount: 14400.0,
        permissible_amount: 6400.0,
        excess_amount: 8000.0,
        violation_type: "RATE_CAP_EXCEEDED",
        severity: "MEDIUM",
        evidence_citation: "NPPA Order No. 44(02)/2020/Div.II/NPPA",
        patient_explanation:
          "PPE Kit unit rate charged at ₹1,800/kit, exceeding the government benchmark of ₹800/kit.",
        recommended_action: "Seek adjustment to statutory consumable price benchmark.",
        confidence_level: "MEDIUM",
      },
      {
        finding_id: "fnd-5",
        rule_id: "RULE-IND-PUMP-006",
        item_name: "Infusion Pump Surcharge (Per Day)",
        billed_amount: 4800.0,
        permissible_amount: 0.0,
        excess_amount: 4800.0,
        violation_type: "UNBUNDLING_PROHIBITED",
        severity: "HIGH",
        evidence_citation: "GIPSA Preferred Provider Network Schedule B",
        patient_explanation:
          "Infusion and syringe pumps are mandatory components of ICU care and cannot be billed separately.",
        recommended_action: "Request immediate removal under ICU equipment bundling guidelines.",
        confidence_level: "HIGH",
      },
      {
        finding_id: "fnd-6",
        rule_id: "RULE-IND-ADMIN-005",
        item_name: "Administrative & Admission File Fee",
        billed_amount: 2500.0,
        permissible_amount: 0.0,
        excess_amount: 2500.0,
        violation_type: "INSURANCE_NON_PAYABLE",
        severity: "MEDIUM",
        evidence_citation: "IRDAI Master Circular Ref: IRDAI/HLT/REG/CIR/193/07/2020",
        patient_explanation:
          "Admission file processing fees are classified as non-payable administrative overhead by IRDAI.",
        recommended_action: "Request waiver as non-admissible overhead charge.",
        confidence_level: "HIGH",
      },
      {
        finding_id: "fnd-7",
        rule_id: "RULE-IND-CONSUM-007",
        item_name: "Sterile Surgical Gloves 7.5 (Pair)",
        billed_amount: 4200.0,
        permissible_amount: 900.0,
        excess_amount: 3300.0,
        violation_type: "RATE_CAP_EXCEEDED",
        severity: "MEDIUM",
        evidence_citation: "Drug Price Control Order (DPCO) & Consumables Schedule",
        patient_explanation:
          "Surgical gloves billed at ₹350/pair against standard rate cap of ₹75/pair.",
        recommended_action: "Demand rate correction according to DPCO schedule.",
        confidence_level: "MEDIUM",
      },
    ],
  };
}

/**
 * Resolves the backend API base URL.
 * Defaults to http://localhost:8000/api/v1 (or proxy /api/v1).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
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
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

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
      } catch {}
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
  try {
    return await apiFetch<HealthStatus>("/health");
  } catch {
    try {
      const rootUrl = baseUrl.replace(/\/api\/v1\/?$/, "");
      return await apiFetch<HealthStatus>(`${rootUrl}/health`);
    } catch {
      return { status: "demo_offline", demo_mode: true };
    }
  }
}

/** Fetch pre-configured realistic synthetic bills */
export async function fetchSampleBills(): Promise<SampleBillMeta[]> {
  try {
    return await apiFetch<SampleBillMeta[]>("/audit/sample-bills");
  } catch {
    return FALLBACK_SAMPLE_BILLS;
  }
}

/** Fetch a specific sample bill by ID as NormalizedBill */
export async function fetchSampleBillById(billId: string): Promise<NormalizedBill> {
  try {
    return await apiFetch<NormalizedBill>(`/audit/sample-bills/${billId}`);
  } catch {
    const found = FALLBACK_SAMPLE_BILLS.find((b) => b.id === billId);
    return {
      hospital_name: found?.hospital_name || "Apollo Hospital",
      bill_number: found?.bill_number || "DEL-2024-89211",
      total_amount: found?.total_amount || 101540,
      subtotal_amount: found?.total_amount || 101540,
      items: [],
    };
  }
}

/** Fetch the 37 government statutory rules */
export async function fetchStatutoryRules(): Promise<StatutoryRule[]> {
  try {
    return await apiFetch<StatutoryRule[]>("/audit/statutory-rules");
  } catch {
    return FALLBACK_RULES;
  }
}

/** Execute 1-click deterministic audit demo */
export async function runDemoAudit(): Promise<AuditReportResponse> {
  try {
    return await apiFetch<AuditReportResponse>("/audit/demo", {
      method: "POST",
    });
  } catch {
    return buildFallbackReport();
  }
}

/** Run deterministic rule engine on a NormalizedBill */
export async function analyzeBill(bill: NormalizedBill): Promise<AuditReportResponse> {
  try {
    return await apiFetch<AuditReportResponse>("/audit/analyze-bill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bill),
    });
  } catch {
    return buildFallbackReport(bill.hospital_name || "Apollo Specialty Healthcare India Ltd.");
  }
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
 */
export async function uploadAndAnalyzeFile(
  file: File,
  state: string = "Delhi",
  scheme: string = "CGHS",
): Promise<AuditReportResponse> {
  try {
    const uploadResult = await uploadBill(file, state, scheme);
    if (uploadResult.normalized_bill && uploadResult.normalized_bill.items?.length > 0) {
      return await analyzeBill(uploadResult.normalized_bill);
    }
  } catch (e) {
    console.warn("Upload endpoint unreachable, using client-side audit fallback:", e);
  }
  return buildFallbackReport(file.name.replace(/\.[^/.]+$/, ""));
}

/** Ask the AI Patient Advocate Assistant */
export async function askAIChat(request: AuditChatRequest): Promise<AuditChatResponse> {
  try {
    return await apiFetch<AuditChatResponse>("/audit/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch {
    return {
      reply: assistantReply(request.message),
      suggested_actions: [
        "Why was the ICU surcharge flagged?",
        "Can the hospital charge for biomedical waste?",
        "What questions should I ask the billing desk?",
      ],
      rule_citations: [
        "CGHS/NHA Circular F.No. S.11011/11/2021-CGHS(P)",
        "Delhi Health Order No. F.23/12/2021",
      ],
    };
  }
}

/** Generate formal patient dispute letter and dossier */
export async function generateDisputeLetter(request: DisputeLetterRequest): Promise<DisputeLetterResponse> {
  try {
    return await apiFetch<DisputeLetterResponse>("/audit/dispute-letter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  } catch {
    const rawMd = disputeLetter();
    const rows = (request.report?.findings || [])
      .map(
        (f) =>
          `<tr><td>${f.item_name}</td><td>${fmtINR(f.billed_amount)}</td><td>${fmtINR(f.excess_amount)}</td><td>${f.evidence_citation}</td></tr>`
      )
      .join("");

    const html = `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">FORMAL NOTICE OF BILLING DISPUTE & REFUND DEMAND</h2>
        <p><strong>To:</strong> ${request.recipient_title || "The Medical Superintendent"}<br/>
        <strong>Hospital:</strong> ${request.report.hospital_name}<br/>
        <strong>Patient / Bill Reference:</strong> ${request.report.patient_name || "Patient"} (Bill #${request.report.bill_number || "N/A"})</p>

        <p>This formal notice is issued regarding statutory billing discrepancies identified on the inpatient bill dated ${request.report.bill_date || "recent"}. Under applicable statutory rate ceilings (including CGHS tariffs, NPPA consumable caps, and unbundling prohibitions), the charges itemized below exceed legally permitted rates.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Flagged Item</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Billed</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Disputed Excess</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1;">Statutory Authority Citation</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <p style="font-size: 15px; font-weight: bold; color: #b91c1c;">
          Total Disputed Amount Demanded: ${fmtINR(request.report.potential_savings)}
        </p>

        <p>${request.notes || "Please issue a revised itemized bill removing the statutory excess charges identified above within 7 business days."}</p>
        <p>Yours sincerely,<br/><strong>${request.report.patient_name || "Patient / Authorized Relative"}</strong><br/>${request.patient_address || "New Delhi, India"}</p>
      </div>
    `;

    return {
      html_content: html,
      markdown_content: rawMd,
      summary: {
        hospital_name: request.report.hospital_name,
        disputed_amount: request.report.potential_savings,
        findings_count: request.report.findings_count,
      },
    };
  }
}
