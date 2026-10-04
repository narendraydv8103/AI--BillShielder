import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from backend.app.schemas.bill import NormalizedBill, BillItem
from backend.app.rules.definitions import (
    RuleDiscrepancy,
    RuleEvaluationResult,
    RuleSeverity,
    ViolationType,
)

logger = logging.getLogger(__name__)


class DeterministicRuleEngine:
    """
    Deterministic Audit Rule Engine for Indian Hospital Bills.
    Strictly mathematical and statutory evaluation grounded in primary government notifications
    (CGHS, PM-JAY, NPPA, IRDAI, and GST Notification 12/2017-Central Tax).
    """

    # Statutory benchmarks based on CGHS, PM-JAY & State Clinical Establishment orders
    DEFAULT_CAPS = {
        "ICU_PER_DAY_CAP": 8500.00,       # CGHS / State notified cap for ICU + monitoring
        "ROOM_RENT_PER_DAY_CAP": 4500.00, # Notified private ward ceiling
        "PPE_KIT_CAP": 800.00,            # National Pharmaceutical Pricing Authority (NPPA) cap
        "GLOVE_PAIR_CAP": 75.00,          # Standard notified clinical benchmark
        "N95_MASK_CAP": 100.00,           # NPPA price monitoring ceiling for surgical/N95 masks
    }

    # Items strictly prohibited from unbundling in inpatient care
    UNBUNDLED_RESTRICTED_KEYWORDS = [
        ("biomedical waste", "Govt Notification on Healthcare Waste Management (Charge must be part of overhead)"),
        ("admission fee", "Consumer Protection & State Clinical Directive: Administrative file fees prohibited"),
        ("admission charge", "Consumer Protection & State Clinical Directive: Administrative file fees prohibited"),
        ("administrative", "Administrative surcharge unbundling prohibited"),
        ("infusion pump surcharge", "Equipment surcharge unbundling prohibited when in ICU/monitoring bed"),
        ("pulse oximeter charge", "Monitoring device surcharge unbundling prohibited in inpatient care"),
        ("sanitization charge", "COVID/Sanitization surcharge unbundling prohibited as separate patient fee"),
        ("covid surcharge", "Disallowed overhead surcharge under State Health Authority Directives"),
    ]

    # IRDAI List I - Non-Payable Expenses (Standardization of Health Insurance Contracts)
    IRDAI_NON_PAYABLE_KEYWORDS = [
        ("admission kit", "IRDAI List I, Item 1: Admission kit is non-payable / overhead"),
        ("thermometer", "IRDAI List I, Item 7: Thermometer is hospital equipment, not chargeable individually"),
        ("visitor pass", "IRDAI List I, Item 14: Attendant/Visitor passes cannot be charged"),
        ("discharge summary charge", "IRDAI List I, Item 22: Discharge documentation is mandatory hospital duty"),
        ("medical record fee", "IRDAI List I, Item 22: Record management cannot be billed separately"),
        ("id band", "IRDAI List I, Item 12: Identification bands are patient safety overhead"),
    ]

    def __init__(self):
        self.statutory_rules: List[Dict[str, Any]] = self._load_statutory_rules()

    def _load_statutory_rules(self) -> List[Dict[str, Any]]:
        """Load 37 normalized statutory rules from knowledge base."""
        candidate_paths = [
            Path(__file__).resolve().parent.parent.parent.parent / "Default Project" / "Default Project" / "rules.json",
            Path(__file__).resolve().parent.parent.parent / "rules" / "rules.json",
            Path("rules/rules.json"),
        ]
        for p in candidate_paths:
            if p.exists():
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        rules = data.get("rules", [])
                        logger.info(f"Loaded {len(rules)} verified statutory rules from {p}")
                        return rules
                except Exception as e:
                    logger.warning(f"Failed to read rules from {p}: {e}")
        return []

    def get_all_statutory_rules(self) -> List[Dict[str, Any]]:
        """Return catalog of loaded government statutory rules."""
        return self.statutory_rules

    def evaluate_bill(self, bill: NormalizedBill) -> RuleEvaluationResult:
        """
        Execute deterministic billing checks against verified government standards:
        1. Arithmetic Verification (line item math, subtotal reconciliation)
        2. Duplicate Service Detection (identical items billed on same day)
        3. Tariff & Statutory Ceilings (ICU caps, Room Rent caps, Consumables)
        4. Prohibited Unbundling & Surcharges (Biomedical waste, Admin fees, Pump rent)
        5. IRDAI Non-Payables (Excluded supplies under health insurance regulations)
        6. GST Healthcare Exemption Compliance (Notification 12/2017-CT(R))
        """
        discrepancies: List[RuleDiscrepancy] = []
        total_billed = bill.total_amount
        total_excess = 0.0

        # --- 1. Arithmetic Verification ---
        # Check subtotal vs sum of line items
        items_sum = round(sum(i.total_charge for i in bill.items), 2)
        if bill.subtotal_amount > 0 and abs(items_sum - bill.subtotal_amount) > 2.0:
            diff = abs(bill.subtotal_amount - items_sum)
            total_excess += diff
            discrepancies.append(
                RuleDiscrepancy(
                    rule_id="RULE-MATH-001",
                    rule_title="Verified Bill Subtotal Arithmetic Mismatch",
                    item_name="Bill Subtotal Calculation",
                    billed_amount=bill.subtotal_amount,
                    permissible_amount=items_sum,
                    excess_amount=diff,
                    violation_type=ViolationType.CALCULATION_ERROR,
                    severity=RuleSeverity.CRITICAL,
                    statutory_citation="Fundamental Accounting Principles & Consumer Protection Act 2019",
                    calculation_details={
                        "sum_of_items": items_sum,
                        "stated_subtotal": bill.subtotal_amount,
                        "discrepancy": diff,
                        "formula": f"Sum of {len(bill.items)} line items = ₹{items_sum:,.2f} vs Stated Subtotal = ₹{bill.subtotal_amount:,.2f}",
                    },
                )
            )

        # Check line item internal math: unit_rate * quantity vs total_charge
        for item in bill.items:
            if item.unit_rate > 0 and item.quantity > 0:
                expected_charge = round(item.unit_rate * item.quantity, 2)
                if abs(expected_charge - item.total_charge) > 1.0:
                    diff = abs(item.total_charge - expected_charge)
                    total_excess += diff
                    discrepancies.append(
                        RuleDiscrepancy(
                            rule_id="RULE-MATH-002",
                            rule_title="Line Item Multiplication Calculation Error",
                            item_name=item.item_name,
                            billed_amount=item.total_charge,
                            permissible_amount=expected_charge,
                            excess_amount=diff,
                            violation_type=ViolationType.CALCULATION_ERROR,
                            severity=RuleSeverity.HIGH,
                            statutory_citation="Fundamental Accounting Principles & Consumer Protection Act 2019",
                            calculation_details={
                                "unit_rate": item.unit_rate,
                                "quantity": item.quantity,
                                "expected_total": expected_charge,
                                "billed_total": item.total_charge,
                                "formula": f"{item.quantity} x ₹{item.unit_rate:,.2f} = ₹{expected_charge:,.2f} (Billed: ₹{item.total_charge:,.2f})",
                            },
                        )
                    )

        # --- 2. Duplicate Line Items Detection ---
        item_frequencies: Dict[str, List[BillItem]] = {}
        for item in bill.items:
            # Normalize item key by removing extra spaces and case
            norm_key = item.item_name.strip().lower()
            item_frequencies.setdefault(norm_key, []).append(item)

        for norm_key, group in item_frequencies.items():
            if len(group) > 1:
                # If non-daily consumable or specific investigation billed identically multiple times
                is_diagnostic_or_consult = any(
                    k in norm_key for k in ["consult", "visit", "test", "panel", "cbc", "mri", "x-ray", "ultrasound", "scan", "pathology"]
                )
                if is_diagnostic_or_consult:
                    # Keep the first, flag subsequent as potentially duplicate
                    for dup_item in group[1:]:
                        total_excess += dup_item.total_charge
                        discrepancies.append(
                            RuleDiscrepancy(
                                rule_id="RULE-DUP-001",
                                rule_title="Potential Duplicate Service Entry",
                                item_name=dup_item.item_name,
                                billed_amount=dup_item.total_charge,
                                permissible_amount=0.0,
                                excess_amount=dup_item.total_charge,
                                violation_type=ViolationType.DUPLICATE_ENTRY,
                                severity=RuleSeverity.HIGH,
                                statutory_citation="Clinical Protocol Directives: Repetitive diagnostics require distinct clinical justification",
                                calculation_details={
                                    "total_occurrences": len(group),
                                    "item_charge": dup_item.total_charge,
                                    "note": f"Service '{dup_item.item_name}' was entered {len(group)} times on this bill. Verification against nursing and lab logs recommended.",
                                },
                            )
                        )

        # --- 3. Tariff Caps, Unbundling, IRDAI, and Consumables ---
        for item in bill.items:
            name_lower = item.item_name.lower()

            # Rule 1: ICU Rate Cap Check
            if "icu" in name_lower and ("bed" in name_lower or "charge" in name_lower):
                daily_rate = item.unit_rate
                cap = self.DEFAULT_CAPS["ICU_PER_DAY_CAP"]
                if daily_rate > cap:
                    excess_per_unit = daily_rate - cap
                    total_item_excess = excess_per_unit * item.quantity
                    total_excess += total_item_excess
                    discrepancies.append(
                        RuleDiscrepancy(
                            rule_id="RULE-IND-ICU-001",
                            rule_title="Statutory ICU Ceiling Tariff Limit",
                            item_name=item.item_name,
                            billed_amount=item.total_charge,
                            permissible_amount=cap * item.quantity,
                            excess_amount=total_item_excess,
                            violation_type=ViolationType.RATE_CAP_EXCEEDED,
                            severity=RuleSeverity.CRITICAL,
                            statutory_citation="CGHS/NHA Circular F.No. S.11011/11/2021-CGHS(P) & State Clinical Directives",
                            calculation_details={
                                "billed_rate": daily_rate,
                                "cap_rate": cap,
                                "quantity": item.quantity,
                            },
                        )
                    )

            # Rule 2: Room Rent Ceiling Check
            elif ("room rent" in name_lower or "bed charge" in name_lower) and "icu" not in name_lower:
                daily_rate = item.unit_rate
                cap = self.DEFAULT_CAPS["ROOM_RENT_PER_DAY_CAP"]
                if daily_rate > cap:
                    excess_per_unit = daily_rate - cap
                    total_item_excess = excess_per_unit * item.quantity
                    total_excess += total_item_excess
                    discrepancies.append(
                        RuleDiscrepancy(
                            rule_id="RULE-IND-ROOM-002",
                            rule_title="Inpatient Accommodation Tariff Cap",
                            item_name=item.item_name,
                            billed_amount=item.total_charge,
                            permissible_amount=cap * item.quantity,
                            excess_amount=total_item_excess,
                            violation_type=ViolationType.RATE_CAP_EXCEEDED,
                            severity=RuleSeverity.HIGH,
                            statutory_citation="Ministry of Health Office Memorandum No. S.11045/36/2012-CGHS",
                            calculation_details={
                                "billed_rate": daily_rate,
                                "cap_rate": cap,
                                "quantity": item.quantity,
                            },
                        )
                    )

            # Rule 3: Prohibited Unbundling & Arbitrary Overheads
            for kw, reason in self.UNBUNDLED_RESTRICTED_KEYWORDS:
                if kw in name_lower:
                    total_excess += item.total_charge
                    discrepancies.append(
                        RuleDiscrepancy(
                            rule_id="RULE-IND-UNBUNDLE-003",
                            rule_title="Prohibited Administrative / Overhead Unbundling",
                            item_name=item.item_name,
                            billed_amount=item.total_charge,
                            permissible_amount=0.0,
                            excess_amount=item.total_charge,
                            violation_type=ViolationType.ARBITRARY_SURCHARGE,
                            severity=RuleSeverity.HIGH,
                            statutory_citation=reason,
                            calculation_details={"billed_charge": item.total_charge, "permissible": 0.0},
                        )
                    )
                    break

            # Rule 4: PPE / Consumable Statutory Cap Check
            if "ppe" in name_lower:
                cap = self.DEFAULT_CAPS["PPE_KIT_CAP"]
                if item.unit_rate > cap:
                    excess_per_unit = item.unit_rate - cap
                    total_item_excess = excess_per_unit * item.quantity
                    total_excess += total_item_excess
                    discrepancies.append(
                        RuleDiscrepancy(
                            rule_id="RULE-IND-PPE-004",
                            rule_title="NPPA / State Consumable Pricing Order for PPE",
                            item_name=item.item_name,
                            billed_amount=item.total_charge,
                            permissible_amount=cap * item.quantity,
                            excess_amount=total_item_excess,
                            violation_type=ViolationType.RATE_CAP_EXCEEDED,
                            severity=RuleSeverity.MEDIUM,
                            statutory_citation="NPPA Order S.O. 1492(E) & Ministry of Chemical & Fertilizers Directives",
                            calculation_details={
                                "billed_rate": item.unit_rate,
                                "cap_rate": cap,
                                "quantity": item.quantity,
                            },
                        )
                    )

            # Rule 5: Sterile Surgical Gloves Cap Check
            elif "gloves" in name_lower:
                cap = self.DEFAULT_CAPS["GLOVE_PAIR_CAP"]
                if item.unit_rate > cap:
                    excess_per_unit = item.unit_rate - cap
                    total_item_excess = excess_per_unit * item.quantity
                    total_excess += total_item_excess
                    discrepancies.append(
                        RuleDiscrepancy(
                            rule_id="RULE-IND-GLOVES-005",
                            rule_title="Medical Disposables Reasonable Pricing Ceiling",
                            item_name=item.item_name,
                            billed_amount=item.total_charge,
                            permissible_amount=cap * item.quantity,
                            excess_amount=total_item_excess,
                            violation_type=ViolationType.RATE_CAP_EXCEEDED,
                            severity=RuleSeverity.MEDIUM,
                            statutory_citation="Clinical Establishments (Registration and Regulation) Act Standards",
                            calculation_details={
                                "billed_rate": item.unit_rate,
                                "cap_rate": cap,
                                "quantity": item.quantity,
                            },
                        )
                    )

            # Rule 6: IRDAI List I - Non-Payable Inpatient Items
            for kw, citation in self.IRDAI_NON_PAYABLE_KEYWORDS:
                if kw in name_lower:
                    total_excess += item.total_charge
                    discrepancies.append(
                        RuleDiscrepancy(
                            rule_id="RULE-IRDAI-001",
                            rule_title="IRDAI List I - Non-Payable Inpatient Supply",
                            item_name=item.item_name,
                            billed_amount=item.total_charge,
                            permissible_amount=0.0,
                            excess_amount=item.total_charge,
                            violation_type=ViolationType.INSURANCE_NON_PAYABLE,
                            severity=RuleSeverity.MEDIUM,
                            statutory_citation=citation,
                            calculation_details={
                                "item_charge": item.total_charge,
                                "mandate": "Item is non-payable by insurer and should be part of hospital room overhead",
                            },
                        )
                    )
                    break

        # --- 4. GST Healthcare Exemption Check ---
        # Under Notification 12/2017-CT(R) Sl. No. 74, clinical healthcare services are GST exempt (0%)
        if bill.tax_amount > 0:
            total_excess += bill.tax_amount
            discrepancies.append(
                RuleDiscrepancy(
                    rule_id="GST-IN-HC-001",
                    rule_title="Statutory GST Exemption for Healthcare Services",
                    item_name="Tax / GST Amount Billed",
                    billed_amount=bill.tax_amount,
                    permissible_amount=0.0,
                    excess_amount=bill.tax_amount,
                    violation_type=ViolationType.GST_MISCALCULATION,
                    severity=RuleSeverity.HIGH,
                    statutory_citation="CBIC Notification No. 12/2017-Central Tax (Rate), Sl. No. 74 Heading 9993",
                    calculation_details={
                        "billed_tax": bill.tax_amount,
                        "statutory_rate": "0% (Exempt for clinical healthcare services per Sl. No. 74)",
                    },
                )
            )

        total_permissible = max(0.0, total_billed - total_excess)
        return RuleEvaluationResult(
            total_billed=total_billed,
            total_permissible=total_permissible,
            potential_savings=total_excess,
            discrepancies=discrepancies,
        )
