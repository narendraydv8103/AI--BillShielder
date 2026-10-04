import logging
import os
from typing import Any, Dict, List, Optional
from backend.app.core.config import settings
from backend.app.schemas.audit import (
    AuditChatRequest,
    AuditChatResponse,
    AuditFinding,
    ChatMessage,
)
from backend.app.schemas.bill import NormalizedBill

logger = logging.getLogger(__name__)


class AIChatService:
    """
    Explainable AI Agent service for patient bill review inquiries.
    Uses Google Gemini when API key is provided, with a comprehensive,
    grounded statutory medical billing reasoning fallback for offline demo mode.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = None
        if self.api_key and not self.api_key.startswith("your_"):
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Initialized Google Gemini client for live Q&A assistant.")
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI client: {e}")

    async def answer_query(self, request: AuditChatRequest) -> AuditChatResponse:
        """Answer patient questions regarding their hospital bill and audit findings."""
        # 1. Try Gemini if configured
        if self.client:
            try:
                return await self._answer_with_gemini(request)
            except Exception as e:
                logger.warning(f"Gemini live call failed, falling back to rule-grounded engine: {e}")

        # 2. Rule-Grounded Medical Billing Reasoning Engine
        return self._answer_with_grounded_engine(request)

    async def _answer_with_gemini(self, request: AuditChatRequest) -> AuditChatResponse:
        """Execute grounded inference with Gemini."""
        import asyncio

        prompt = self._build_gemini_prompt(request)
        model_name = "gemini-2.5-flash"

        def _call_model():
            response = self.client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            return response.text

        response_text = await asyncio.to_thread(_call_model)
        citations = [f.evidence_citation for f in request.findings if f.evidence_citation][:3]

        suggested_actions = [
            "Request itemized nursing chart from the billing desk",
            "Present the dispute letter for unbundled overheads",
            "Ask cashier to recalculate subtotal arithmetic",
        ]

        return AuditChatResponse(
            reply=response_text,
            suggested_actions=suggested_actions,
            rule_citations=citations,
        )

    def _build_gemini_prompt(self, request: AuditChatRequest) -> str:
        bill_summary = ""
        if request.bill:
            bill_summary = (
                f"Hospital: {request.bill.hospital_name}\n"
                f"Bill Number: {request.bill.bill_number}\n"
                f"Total Billed: ₹{request.bill.total_amount:,.2f}\n"
                f"Items Count: {len(request.bill.items)}\n"
            )

        findings_summary = "\n".join(
            f"- {f.item_name}: Billed ₹{f.billed_amount:,.2f}, Permissible ₹{f.permissible_amount:,.2f}, "
            f"Excess ₹{f.excess_amount:,.2f} ({f.violation_type}). Authority: {f.evidence_citation}"
            for f in request.findings
        )

        history_text = "\n".join(
            f"{m.role.capitalize()}: {m.content}" for m in request.history[-4:]
        )

        return (
            "You are an expert, compassionate AI Hospital Bill Auditor and patient advocate for India.\n"
            "You help patients understand overcharges, duplicate charges, arithmetic errors, and statutory healthcare regulations.\n"
            "Ground your answers strictly in Indian regulations (CGHS, PMJAY, NPPA, IRDAI, GST Notification 12/2017).\n"
            "Distinguish verified calculation errors from suspicious items requiring verification.\n"
            "Never label a hospital or doctor as 'fraudulent'—use objective terms like 'discrepancy', 'unbundling', 'exceeds tariff cap'.\n\n"
            f"PATIENT BILL CONTEXT:\n{bill_summary}\n"
            f"AUDIT FINDINGS IDENTIFIED:\n{findings_summary}\n\n"
            f"RECENT CONVERSATION:\n{history_text}\n\n"
            f"PATIENT QUESTION: {request.message}\n\n"
            "Provide a clear, helpful response explaining what the patient should know and how to proceed with the hospital billing desk:"
        )

    def _answer_with_grounded_engine(self, request: AuditChatRequest) -> AuditChatResponse:
        """Deterministic domain-grounded conversational assistant."""
        query = request.message.lower().strip()
        findings = request.findings or []
        bill = request.bill

        # Keyword matching against bill findings
        matched_finding: Optional[AuditFinding] = None
        for f in findings:
            name_words = f.item_name.lower().split()
            if any(w in query for w in name_words if len(w) > 3) or f.violation_type.lower() in query:
                matched_finding = f
                break

        # Scenario 1: User asks about specific item or violation
        if matched_finding:
            reply = (
                f"**Regarding '{matched_finding.item_name}':**\n\n"
                f"• **Amount Billed:** ₹{matched_finding.billed_amount:,.2f}\n"
                f"• **Permissible Benchmark:** ₹{matched_finding.permissible_amount:,.2f}\n"
                f"• **Identified Discrepancy:** ₹{matched_finding.excess_amount:,.2f} ({matched_finding.violation_type.replace('_', ' ')})\n\n"
                f"**Why this is flagged:** {matched_finding.patient_explanation or 'This charge exceeds statutory benchmarks or is prohibited from separate unbundling.'}\n\n"
                f"**Legal Authority:** {matched_finding.evidence_citation}\n\n"
                f"**Recommended Action:** Request the billing officer to provide the specific tariff authorization for this line. "
                f"Under consumer protection guidelines, administrative and overhead charges cannot be billed as separate line items."
            )
            actions = [
                f"Draft formal dispute for {matched_finding.item_name}",
                "Ask billing desk to waive this charge",
                "Review other flagged items",
            ]
            citations = [matched_finding.evidence_citation]

        # Scenario 2: User asks about duplicate billing
        elif any(k in query for k in ["duplicate", "twice", "repeated", "double"]):
            dup_findings = [f for f in findings if f.violation_type == "DUPLICATE_ENTRY"]
            if dup_findings:
                items_str = ", ".join(f"'{f.item_name}' (₹{f.excess_amount:,.2f})" for f in dup_findings)
                reply = (
                    f"**Potential Duplicate Entries Detected:**\n\n"
                    f"Our audit detected {len(dup_findings)} repeated line item(s): {items_str}.\n\n"
                    "In hospital billing, duplicate entries frequently occur when electronic orders are submitted twice "
                    "or when routine investigations are re-keyed. "
                    "We recommend requesting the **nurse administration chart** and **laboratory time stamps** "
                    "to confirm whether each billed procedure was actually conducted twice."
                )
            else:
                reply = (
                    "No definite duplicate entries were identified on this specific bill. However, you should check that "
                    "routine diagnostic tests (like complete blood counts or electrolytes) are not billed multiple times in the same 24-hour cycle "
                    "unless clinically required."
                )
            actions = [
                "Request laboratory time-stamped log",
                "Verify nursing administration record",
                "Ask cashier for itemized schedule",
            ]
            citations = ["Clinical Establishment Guidelines on Diagnostic Repetition"]

        # Scenario 3: User asks about unbundling / overheads (biomedical waste, admission fee, pump)
        elif any(k in query for k in ["unbundle", "waste", "admission", "overhead", "surcharge", "pump"]):
            reply = (
                "**What is 'Unbundling' in Hospital Bills?**\n\n"
                "Unbundling is the practice of billing separately for services or supplies that are legally required to be part "
                "of standard hospital room rent, nursing care, or surgical package tariffs.\n\n"
                "Common prohibited unbundled items include:\n"
                "1. **Biomedical Waste Disposal:** Mandated by pollution control regulations to be absorbed in general overheads.\n"
                "2. **Admission / Medical Record Fees:** Administrative processing cannot be levied as an extra clinical fee.\n"
                "3. **Infusion / Syringe Pump Extra Rent:** When a patient pays for ICU or high-dependency monitoring, equipment rent is already included in the daily bed package."
            )
            actions = [
                "Cite Clinical Establishment Rules to billing manager",
                "Request deduction of unbundled surcharges",
                "Generate Patient Action Letter",
            ]
            citations = ["MoEFCC Bio-Medical Waste Management Rules", "CGHS Circular F.No. S.11011/11/2021-CGHS(P)"]

        # Scenario 4: User asks how to dispute or what to do next
        elif any(k in query for k in ["how", "what to do", "dispute", "next step", "action", "reduce", "talk", "discount"]):
            total_savings = sum(f.excess_amount for f in findings)
            reply = (
                f"**Step-by-Step Patient Negotiation Protocol:**\n\n"
                f"Our audit identified **₹{total_savings:,.2f}** across {len(findings)} line items requiring review.\n\n"
                "1. **Do Not Settle in Full Immediately:** Request an interim bill and state that you are reviewing line items against CGHS/NPPA benchmarks.\n"
                "2. **Obtain the Fully Itemized Bill:** Ensure you have quantities, unit rates, and service dates for each line.\n"
                "3. **Meet the Patient Relations Officer (PRO):** Hand over our generated **Hospital Bill Review Dossier** highlighting specific statutory citations.\n"
                "4. **Target Calculation & Surcharge Errors First:** Hospitals readily correct verified arithmetic errors and unbundled administrative fees.\n"
                "5. **Escalate if Necessary:** If the hospital refuses, you have the right to file a grievance with the State Clinical Establishments Authority or the District Consumer Redressal Commission."
            )
            actions = [
                "Download Patient Dispute Letter",
                "Print Itemized Audit Summary",
                "Schedule meeting with billing in-charge",
            ]
            citations = ["Consumer Protection Act 2019", "State Clinical Establishments Act Rules"]

        # Scenario 5: Default overview of the current bill
        else:
            total_discrepancy = sum(f.excess_amount for f in findings)
            hospital_name = bill.hospital_name if bill else "the hospital"
            reply = (
                f"Hello! I am your **AI Hospital Bill Auditor Assistant**.\n\n"
                f"I have reviewed your bill from **{hospital_name}**:\n"
                f"• **Flagged Items:** {len(findings)} discrepancy items detected\n"
                f"• **Potential Overcharge / Review Amount:** ₹{total_discrepancy:,.2f}\n\n"
                "You can ask me about any specific item (e.g. *'Why is the PPE kit flagged?'*, *'Can they charge for bio-waste?'*), "
                "or click the suggested actions below to prepare your dispute dossier."
            )
            actions = [
                "Why are ICU charges flagged?",
                "Can the hospital charge for biomedical waste?",
                "What questions should I ask the billing desk?",
            ]
            citations = [f.evidence_citation for f in findings[:2]] if findings else []

        return AuditChatResponse(
            reply=reply,
            suggested_actions=actions,
            rule_citations=citations,
        )
