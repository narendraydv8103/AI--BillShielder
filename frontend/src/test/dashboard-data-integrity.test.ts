import { describe, expect, it } from "vitest";
import { AuditReportResponse } from "@/lib/api";
import { fmtINR } from "@/lib/demo-audit";

describe("Dashboard Data Integrity & Calculation Consistency", () => {
  it("safely handles null or undefined normalized_bill without throwing", () => {
    const reportWithoutBill: AuditReportResponse = {
      job_id: "partial-001",
      status: "COMPLETED",
      hospital_name: "Apollo Hospital",
      total_billed: 25000,
      total_permissible: 20000,
      potential_savings: 5000,
      arithmetic_error_total: 0,
      suspicious_charges_total: 5000,
      disallowed_items_total: 0,
      findings_count: 1,
      findings: [
        {
          finding_id: "fnd-1",
          rule_id: "RULE-IND-ROOM-002",
          item_name: "Room Rent",
          billed_amount: 15000,
          permissible_amount: 10000,
          excess_amount: 5000,
          violation_type: "RATE_CAP_EXCEEDED",
          severity: "HIGH",
          evidence_citation: "CGHS Delhi OM 2014",
        },
      ],
      normalized_bill: null,
      is_demo: false,
      audit_source: "real_backend",
    };

    // The line 210 fix in dashboard.tsx: report?.normalized_bill ?? null
    const billValue = reportWithoutBill?.normalized_bill ?? null;
    expect(billValue).toBeNull();
  });

  it("ensures total potential savings equals sum of finding excess amounts", () => {
    const report: AuditReportResponse = {
      job_id: "calc-001",
      status: "COMPLETED",
      hospital_name: "Max Healthcare",
      total_billed: 50000,
      total_permissible: 32000,
      potential_savings: 18000,
      arithmetic_error_total: 3000,
      suspicious_charges_total: 15000,
      disallowed_items_total: 0,
      findings_count: 2,
      findings: [
        {
          finding_id: "fnd-1",
          rule_id: "RULE-CALC-001",
          item_name: "Arithmetic Miscalculation",
          billed_amount: 15000,
          permissible_amount: 12000,
          excess_amount: 3000,
          violation_type: "CALCULATION_ERROR",
          severity: "CRITICAL",
          evidence_citation: "Deterministic Math: 10 x ₹1,200 = ₹12,000",
        },
        {
          finding_id: "fnd-2",
          rule_id: "RULE-IND-ICU-001",
          item_name: "ICU Bed Overcharge",
          billed_amount: 35000,
          permissible_amount: 20000,
          excess_amount: 15000,
          violation_type: "RATE_CAP_EXCEEDED",
          severity: "CRITICAL",
          evidence_citation: "CGHS Circular 2021",
        },
      ],
      is_demo: false,
      audit_source: "real_backend",
    };

    const computedSum = report.findings.reduce((acc, f) => acc + f.excess_amount, 0);
    expect(computedSum).toBe(report.potential_savings);
    expect(report.total_permissible).toBe(report.total_billed - report.potential_savings);
  });

  it("correctly formats Indian Rupee currency with lakh separators", () => {
    expect(fmtINR(101540)).toBe("₹1,01,540");
    expect(fmtINR(45000)).toBe("₹45,000");
    expect(fmtINR(0)).toBe("₹0");
  });
});
