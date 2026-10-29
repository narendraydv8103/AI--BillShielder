import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  uploadAndAnalyzeFile,
  runDemoAudit,
  analyzeBill,
  generateDisputeLetter,
  BackendUnavailableError,
  ExtractionError,
  ValidationError,
  BillShieldApiError,
  NormalizedBill,
  AuditReportResponse,
} from "@/lib/api";

describe("API Integrity & No Fake Fallback Suite", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("File Validation & Real Uploads", () => {
    it("rejects unsupported file formats before network call", async () => {
      const txtFile = new File(["sample text"], "hospital_bill.txt", { type: "text/plain" });

      await expect(uploadAndAnalyzeFile(txtFile)).rejects.toThrow(ValidationError);
      await expect(uploadAndAnalyzeFile(txtFile)).rejects.toThrow(/Unsupported file format/i);
    });

    it("rejects empty 0-byte files with ValidationError", async () => {
      const emptyPdf = new File([], "empty_bill.pdf", { type: "application/pdf" });

      await expect(uploadAndAnalyzeFile(emptyPdf)).rejects.toThrow(ValidationError);
      await expect(uploadAndAnalyzeFile(emptyPdf)).rejects.toThrow(/empty \(0 bytes\)/i);
    });

    it("throws BackendUnavailableError when backend server is offline — NEVER returns Apollo fallback", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const realPdf = new File(["%PDF-1.4 real test data"], "real_patient_bill.pdf", {
        type: "application/pdf",
      });

      // MUST throw BackendUnavailableError and NEVER return synthetic Apollo demo
      await expect(uploadAndAnalyzeFile(realPdf)).rejects.toThrow(BackendUnavailableError);
      await expect(uploadAndAnalyzeFile(realPdf)).rejects.toThrow(/unable to reach backend|offline|unreachable/i);
    });

    it("throws ExtractionError when document has 0 line items — never manufactures fake findings", async () => {
      // Mock upload returning empty items
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          job_id: "job-empty-123",
          status: "COMPLETED",
          extraction_status: "SUCCESS",
          normalized_bill: {
            hospital_name: "City Clinic",
            items: [],
            total_amount: 0,
            subtotal_amount: 0,
          },
          message: "PDF extracted but no tabular line items detected.",
        }),
      });

      const realPdf = new File(["%PDF-1.4 dummy"], "empty_table.pdf", { type: "application/pdf" });

      await expect(uploadAndAnalyzeFile(realPdf)).rejects.toThrow(ExtractionError);
      await expect(uploadAndAnalyzeFile(realPdf)).rejects.toThrow(/No extractable line items/i);
    });

    it("throws ExtractionError when document is encrypted or corrupt", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          job_id: "job-corrupt-123",
          status: "FAILED",
          extraction_status: "ENCRYPTED_DOCUMENT",
          message: "Document is password protected.",
        }),
      });

      const encryptedPdf = new File(["%PDF-1.4 encrypted"], "locked.pdf", { type: "application/pdf" });

      await expect(uploadAndAnalyzeFile(encryptedPdf)).rejects.toThrow(ExtractionError);
      await expect(uploadAndAnalyzeFile(encryptedPdf)).rejects.toThrow(/Document is password protected|Document extraction failed/i);
    });

    it("stamps correct provenance when real upload and analysis succeeds", async () => {
      const mockNormalized: NormalizedBill = {
        hospital_name: "Max Healthcare",
        bill_number: "MAX-9921",
        items: [
          {
            item_id: "item-1",
            item_name: "ICU Bed",
            quantity: 1,
            unit_rate: 15000,
            total_charge: 15000,
          },
        ],
        subtotal_amount: 15000,
        total_amount: 15000,
      };

      const mockReport: AuditReportResponse = {
        job_id: "real-job-001",
        status: "COMPLETED",
        hospital_name: "Max Healthcare",
        total_billed: 15000,
        total_permissible: 8500,
        potential_savings: 6500,
        arithmetic_error_total: 0,
        suspicious_charges_total: 6500,
        disallowed_items_total: 0,
        findings_count: 1,
        findings: [
          {
            finding_id: "fnd-1",
            rule_id: "RULE-IND-ICU-001",
            item_name: "ICU Bed",
            billed_amount: 15000,
            permissible_amount: 8500,
            excess_amount: 6500,
            violation_type: "RATE_CAP_EXCEEDED",
            severity: "CRITICAL",
            evidence_citation: "CGHS Rate Schedule 2021",
          },
        ],
        is_demo: false,
        audit_source: "real_backend",
      };

      globalThis.fetch = vi
        .fn()
        // First call: upload
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            job_id: "real-job-001",
            status: "COMPLETED",
            extraction_status: "SUCCESS",
            normalized_bill: mockNormalized,
            message: "Extracted 1 item",
          }),
        })
        // Second call: analyze-bill
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockReport,
        });

      const realPdf = new File(["%PDF-1.4 test"], "max_bill.pdf", { type: "application/pdf" });
      const result = await uploadAndAnalyzeFile(realPdf);

      expect(result.is_demo).toBe(false);
      expect(result.audit_source).toBe("real_backend");
      expect(result.source_filename).toBe("max_bill.pdf");
      expect(result.hospital_name).toBe("Max Healthcare");
      expect(result.findings_count).toBe(1);
    });
  });

  describe("Explicit Quick Demo", () => {
    it("marks quick demo reports clearly as synthetic data", async () => {
      const demoResult = await runDemoAudit();

      expect(demoResult.is_demo).toBe(true);
      expect(demoResult.audit_source).toBe("synthetic_demo");
      expect(demoResult.findings_count).toBe(7);
      expect(demoResult.potential_savings).toBe(45000);
      expect(demoResult.total_billed).toBe(101540);
    });
  });

  describe("HTTP Error Responses & Retries", () => {
    it("handles HTTP 500 error gracefully with status code in error object", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ detail: "Database connection failed" }),
      });

      const testBill: NormalizedBill = {
        hospital_name: "Test Hospital",
        bill_number: "T-001",
        items: [{ item_id: "1", item_name: "Consult", quantity: 1, unit_rate: 500, total_charge: 500 }],
        subtotal_amount: 500,
        total_amount: 500,
      };

      await expect(analyzeBill(testBill)).rejects.toThrow(BillShieldApiError);
      try {
        await analyzeBill(testBill);
      } catch (err: any) {
        expect(err.statusCode).toBe(500);
        expect(err.message).toContain("Database connection failed");
      }
    });
  });

  describe("Dispute Letter Tone & Evidence Grounding", () => {
    it("generates dispute letters with neutral, consumer-clarification wording", async () => {
      const report: AuditReportResponse = {
        job_id: "test-rep-01",
        status: "COMPLETED",
        is_demo: false,
        audit_source: "real_backend",
        hospital_name: "Fortis Healthcare",
        total_billed: 50000,
        total_permissible: 35000,
        potential_savings: 15000,
        arithmetic_error_total: 0,
        suspicious_charges_total: 15000,
        disallowed_items_total: 0,
        findings_count: 1,
        findings: [
          {
            finding_id: "fnd-1",
            rule_id: "RULE-IND-PPE-004",
            item_name: "PPE Kit",
            billed_amount: 15000,
            permissible_amount: 5000,
            excess_amount: 10000,
            violation_type: "RATE_CAP_EXCEEDED",
            severity: "MEDIUM",
            evidence_citation: "NPPA Order S.O. 1492(E)",
          },
        ],
      };

      const letter = await generateDisputeLetter({ report });

      // Verifies neutral framing
      expect(letter.markdown_content).toContain("REQUEST FOR ITEMIZED BILLING CLARIFICATION & REVIEW");
      expect(letter.markdown_content).toContain("reference benchmarks");
      expect(letter.markdown_content).not.toContain("guaranteed refund");
      expect(letter.markdown_content).not.toContain("illegal 18% GST");
      expect(letter.html_content).toContain("Request for Itemized Billing Clarification");
    });
  });
});
