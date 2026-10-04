from datetime import datetime, timezone
from typing import Dict, Any
from backend.app.schemas.audit import AuditReportResponse, DisputeLetterRequest, DisputeLetterResponse


class ReportGeneratorService:
    """
    Generates formal, printable Patient Dispute Letters and Dossiers
    with statutory grounding for hospital billing departments.
    """

    @classmethod
    def generate_dispute_letter(cls, request: DisputeLetterRequest) -> DisputeLetterResponse:
        report = request.report
        now_str = datetime.now(timezone.utc).strftime("%d %B %Y")
        patient_name = report.patient_name or "Valued Patient"
        bill_no = report.bill_number or report.job_id
        hospital_name = report.hospital_name or "The Hospital Authority"

        # Itemized rows for Markdown and HTML
        rows_md = []
        rows_html = []
        for idx, f in enumerate(report.findings, start=1):
            category_badge = f.violation_type.replace("_", " ").title()
            rows_md.append(
                f"| {idx} | {f.item_name} | ₹{f.billed_amount:,.2f} | ₹{f.permissible_amount:,.2f} | **₹{f.excess_amount:,.2f}** | {category_badge} | {f.evidence_citation} |"
            )
            rows_html.append(
                f"""<tr>
                    <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">{idx}</td>
                    <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 600;">{f.item_name}</td>
                    <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">₹{f.billed_amount:,.2f}</td>
                    <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right;">₹{f.permissible_amount:,.2f}</td>
                    <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: right; color: #dc2626; font-weight: 700;">₹{f.excess_amount:,.2f}</td>
                    <td style="padding: 10px; border: 1px solid #cbd5e1;"><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 11px;">{category_badge}</span></td>
                    <td style="padding: 10px; border: 1px solid #cbd5e1; font-size: 12px; color: #475569;">{f.evidence_citation}</td>
                </tr>"""
            )

        table_md = "\n".join(rows_md)
        table_html = "\n".join(rows_html)

        markdown_content = f"""# FORMAL NOTICE FOR ITEM-WISE BILL AUDIT & RECTIFICATION

**Date:** {now_str}  
**To:** {request.recipient_title}  
**Hospital:** {hospital_name}  

**Subject:** Request for formal review, recalculation, and deduction of unbundled charges, tariff ceiling overages, and arithmetic discrepancies in Invoice #{bill_no} for Patient **{patient_name}**.

---

Dear Sir/Madam,

I am writing to formally request an itemized review and rectification of charges on Invoice **#{bill_no}** issued to **{patient_name}**.

Following an objective regulatory review against standards established by the **Ministry of Health & Family Welfare (MoHFW)**, the **National Pharmaceutical Pricing Authority (NPPA)**, the **Insurance Regulatory and Development Authority of India (IRDAI)**, and the **Central Goods & Services Tax Act 2017**, we have identified **{report.findings_count} discrepancies** totaling **₹{report.potential_savings:,.2f}** requiring immediate resolution.

### Audit Summary
- **Total Billed Amount:** ₹{report.total_billed:,.2f}
- **Permissible Benchmark Total:** ₹{report.total_permissible:,.2f}
- **Potential Overcharge / Clarification Amount:** ₹{report.potential_savings:,.2f}

### Schedule of Discrepancies
| S.No | Item Description | Billed Amount | Permissible Rate | Excess / Disputed | Category | Legal / Statutory Authority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{table_md}

### Inquiries & Specific Clarifications Requested:
1. **Unbundled Administrative Surcharges:** Charges for biomedical waste management, admission file creation, and equipment rent in intensive care beds are mandated to be included in general institutional overheads. Please rectify or credit these line items.
2. **Statutory Tariff Ceilings:** Certain consumables (PPE kits, surgical gloves) and critical care bed charges exceed notified ceiling limits. Kindly align billing rates to notified rates under the Clinical Establishments Act and NPPA notifications.
3. **Duplicate & Arithmetic Verification:** Please provide the corresponding time-stamped clinical notes, nursing administration records, and diagnostic requisition logs for repeated entries.

We request your prompt rectification of the aforementioned amounts before final settlement. In the event of non-resolution, we reserve the right to seek formal redressal before the State Clinical Establishments Authority and the Consumer Redressal Forum.

Sincerely,  
**{patient_name}** / Patient Representative  
Contact: {request.patient_address or "As per Hospital Registration Records"}
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Formal Notice for Bill Audit & Rectification - {bill_no}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 40px; background: #fff; }}
  .header {{ border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }}
  .header h1 {{ font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin: 0 0 8px 0; }}
  .meta-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-size: 13px; }}
  .summary-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 25px; display: flex; justify-content: space-around; text-align: center; }}
  .summary-stat {{ font-size: 20px; font-weight: 700; color: #0f172a; }}
  .stat-label {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }}
  th {{ background: #0f172a; color: #fff; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }}
  .footer {{ margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; }}
  @media print {{ body {{ padding: 0; }} button {{ display: none; }} }}
</style>
</head>
<body>
  <div class="header">
    <h1>Formal Notice for Item-Wise Bill Audit & Rectification</h1>
    <p style="margin: 0; font-size: 13px; color: #475569;">Grounded in Statutory Health Regulations (CGHS, NPPA, IRDAI & Consumer Protection Act 2019)</p>
  </div>

  <div class="meta-grid">
    <div>
      <strong>Date:</strong> {now_str}<br>
      <strong>To:</strong> {request.recipient_title}<br>
      <strong>Hospital:</strong> {hospital_name}
    </div>
    <div>
      <strong>Patient Name:</strong> {patient_name}<br>
      <strong>Invoice / Bill Number:</strong> {bill_no}<br>
      <strong>Audit Reference:</strong> HBA-IN-{report.job_id}
    </div>
  </div>

  <div class="summary-card">
    <div>
      <div class="stat-label">Total Billed</div>
      <div class="summary-stat">₹{report.total_billed:,.2f}</div>
    </div>
    <div>
      <div class="stat-label">Permissible Benchmark</div>
      <div class="summary-stat" style="color: #059669;">₹{report.total_permissible:,.2f}</div>
    </div>
    <div>
      <div class="stat-label">Disputed / Excess Total</div>
      <div class="summary-stat" style="color: #dc2626;">₹{report.potential_savings:,.2f}</div>
    </div>
    <div>
      <div class="stat-label">Items Under Review</div>
      <div class="summary-stat">{report.findings_count}</div>
    </div>
  </div>

  <p><strong>Subject:</strong> Formal request for itemized clarification, correction of calculation discrepancies, and waiver of unbundled administrative fees on Invoice #{bill_no}.</p>

  <p>Dear Sir/Madam,</p>
  <p>We have performed an itemized audit of the medical charges on the aforementioned invoice. The following {report.findings_count} item(s) exhibit arithmetic inconsistencies, statutory ceiling exceedances, or prohibited unbundling under applicable regulatory directives:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 25%;">Item Description</th>
        <th style="width: 12%; text-align: right;">Billed</th>
        <th style="width: 12%; text-align: right;">Permissible</th>
        <th style="width: 12%; text-align: right;">Discrepancy</th>
        <th style="width: 14%;">Classification</th>
        <th style="width: 20%;">Statutory Authority</th>
      </tr>
    </thead>
    <tbody>
      {table_html}
    </tbody>
  </table>

  <h3>Resolution Protocol Requested:</h3>
  <ol style="font-size: 13px; line-height: 1.6;">
    <li><strong>Credit of Unbundled Overheads:</strong> Direct hospital overheads such as bio-medical waste, administration file surcharges, and infusion device rental in intensive care beds should be absorbed or waived.</li>
    <li><strong>Tariff Alignment:</strong> Recalculate consumable pricing and bed rent in accordance with notified clinical ceiling orders.</li>
    <li><strong>Verification of Repeated Services:</strong> Provide nursing administration time stamps and physician notes validating multiple identical diagnostic investigations.</li>
  </ol>

  <div class="footer">
    <p>Submitted respectfully by <strong>{patient_name}</strong> / Patient Representative.<br>
    <em>Generated by AI Hospital Bill Auditor (India) — Auditable Regulatory Evidence Platform.</em></p>
  </div>
</body>
</html>"""

        return DisputeLetterResponse(
            html_content=html_content,
            markdown_content=markdown_content,
            summary={
                "bill_number": bill_no,
                "hospital_name": hospital_name,
                "patient_name": patient_name,
                "total_billed": report.total_billed,
                "disputed_amount": report.potential_savings,
                "findings_count": report.findings_count,
            },
        )
