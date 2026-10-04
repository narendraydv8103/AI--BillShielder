from typing import Any, Dict, Optional
from backend.app.providers.base import (
    BaseLLMProvider,
    ClassificationResult,
    ExplanationResult,
    ProviderHealth,
)


class MockLLMProvider(BaseLLMProvider):
    """
    Mock LLM Provider for DEMO MODE.
    Provides deterministic standardizations and legal-audit explanations
    grounded in Indian hospital billing regulations without requiring API keys.
    """

    async def classify_billing_item(
        self,
        raw_item_name: str,
        charge_amount: float,
        context: Optional[Dict[str, Any]] = None,
    ) -> ClassificationResult:
        name_lower = raw_item_name.lower()

        if "icu" in name_lower:
            return ClassificationResult(
                category="Intensive Care",
                sub_category="ICU Charges",
                standardized_code="CGHS-ICU-001",
                confidence=0.95,
                notes="Classified under CGHS Intensive Care unit package",
            )
        elif "room" in name_lower or "bed" in name_lower:
            return ClassificationResult(
                category="Accommodation",
                sub_category="Room Rent",
                standardized_code="CGHS-ROOM-002",
                confidence=0.92,
                notes="Classified as Inpatient Accommodation charge",
            )
        elif any(w in name_lower for w in ["gloves", "ppe", "mask", "syringe", "waste", "sanitizer"]):
            return ClassificationResult(
                category="Consumables & Overheads",
                sub_category="Disposables",
                standardized_code="CGHS-CONS-004",
                confidence=0.96,
                notes="Item represents disposable medical supply/administrative overhead",
            )
        elif "doctor" in name_lower or "visit" in name_lower or "consult" in name_lower:
            return ClassificationResult(
                category="Professional Fees",
                sub_category="Doctor Visit",
                standardized_code="CGHS-DOC-003",
                confidence=0.94,
                notes="In-patient specialist consultation",
            )
        elif "pharmacy" in name_lower or "inj" in name_lower or "tab" in name_lower or "iv" in name_lower:
            return ClassificationResult(
                category="Pharmacy",
                sub_category="Medicines",
                standardized_code="NPPA-DRUG-005",
                confidence=0.90,
                notes="Prescription drug subject to NPPA / DPCO price ceiling checks",
            )
        else:
            return ClassificationResult(
                category="General Healthcare Service",
                sub_category="Miscellaneous",
                standardized_code="GEN-MISC-999",
                confidence=0.80,
                notes="General hospital service item",
            )

    async def generate_finding_explanation(
        self,
        finding_data: Dict[str, Any],
        rule_citation: Dict[str, Any],
    ) -> ExplanationResult:
        item = finding_data.get("item_name", "Item")
        excess = finding_data.get("excess_amount", 0.0)
        rule_title = rule_citation.get("title", "Statutory Billing Guideline")
        order_no = rule_citation.get("order_number", "Govt. Order Reference")

        patient_summary = (
            f"The hospital charged Rs. {excess:,.2f} extra for '{item}'. "
            f"Under {rule_title}, this charge is either capped or should have been bundled inside the bed/nursing package."
        )

        auditor_notes = (
            f"Violation identified by deterministic rule engine: Item '{item}' exceeded permissible tariff. "
            f"Statutory authority: {order_no}. Recommended deduction: Rs. {excess:,.2f}."
        )

        regulation_clarification = (
            f"As per {order_no}, private healthcare establishments cannot unbundle administrative "
            f"overhead charges or bill consumables at arbitrary markups beyond government ceilings."
        )

        dispute_recommendation = (
            f"Submit a formal billing grievance to the hospital billing desk citing order {order_no} "
            f"demanding a refund/waiver of Rs. {excess:,.2f}."
        )

        return ExplanationResult(
            patient_summary=patient_summary,
            auditor_notes=auditor_notes,
            applicable_regulation_clarification=regulation_clarification,
            dispute_recommendation=dispute_recommendation,
        )

    async def health_check(self) -> ProviderHealth:
        return ProviderHealth(
            provider_name="mock_llm",
            provider_type="llm",
            is_ready=True,
            is_demo=True,
            details="Mock LLM Provider ready for classification and explanation generation in Demo Mode",
        )
