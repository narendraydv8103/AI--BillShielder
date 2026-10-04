import logging
import uuid
from typing import Optional, Tuple, Union
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import Settings, settings
from backend.app.models.audit import AuditJobModel, FindingModel, BillDocumentModel
from backend.app.schemas.bill import NormalizedBill, BillItem
from backend.app.schemas.audit import AuditReportResponse, AuditFinding
from backend.app.providers.factory import get_ocr_provider, get_llm_provider, get_storage_provider
from backend.app.rules.engine import DeterministicRuleEngine
from backend.app.evidence.validator import EvidenceValidator
from backend.app.documents.pdf_parser import PDFParser, PDFParsedDocument
from backend.app.documents.table_extractor import TableExtractor, RawTableExtraction
from backend.app.documents.normalizer import BillNormalizer

logger = logging.getLogger(__name__)


class AuditOrchestrationService:
    """
    Business Logic Service orchestrating the audit pipeline:
    Document -> OCR -> Normalization -> Deterministic Rules -> Evidence -> LLM Explanation -> Report
    """

    def __init__(self, cfg: Settings = settings):
        self.cfg = cfg
        self.ocr_provider = get_ocr_provider(cfg)
        self.llm_provider = get_llm_provider(cfg)
        self.storage_provider = get_storage_provider(cfg)
        self.rule_engine = DeterministicRuleEngine()
        self.evidence_validator = EvidenceValidator()

    def get_demo_normalized_bill(self) -> NormalizedBill:
        """Construct standard normalized bill for Demo Mode."""
        items = [
            BillItem(
                item_id="item-1",
                item_name="ICU Bed & Nursing Charges",
                category="Intensive Care",
                quantity=2.0,
                unit_rate=15000.0,
                total_charge=30000.0,
            ),
            BillItem(
                item_id="item-2",
                item_name="Room Rent (Private Deluxe)",
                category="Accommodation",
                quantity=2.0,
                unit_rate=9500.0,
                total_charge=19000.0,
            ),
            BillItem(
                item_id="item-3",
                item_name="Biomedical Waste Disposal Surcharge",
                category="Overhead Surcharge",
                quantity=4.0,
                unit_rate=850.0,
                total_charge=3400.0,
            ),
            BillItem(
                item_id="item-4",
                item_name="PPE Kit - High Risk ICU Care",
                category="Consumables",
                quantity=8.0,
                unit_rate=1800.0,
                total_charge=14400.0,
            ),
            BillItem(
                item_id="item-5",
                item_name="Sterile Surgical Gloves 7.5 (Pair)",
                category="Consumables",
                quantity=12.0,
                unit_rate=350.0,
                total_charge=4200.0,
            ),
            BillItem(
                item_id="item-6",
                item_name="Infusion Pump Surcharge (Per Day)",
                category="Overhead Surcharge",
                quantity=4.0,
                unit_rate=1200.0,
                total_charge=4800.0,
            ),
            BillItem(
                item_id="item-7",
                item_name="Doctor In-Patient Visit (Twice/Day)",
                category="Professional Fees",
                quantity=8.0,
                unit_rate=2500.0,
                total_charge=20000.0,
            ),
            BillItem(
                item_id="item-8",
                item_name="Pharmacy: Paracetamol IV 100ml",
                category="Pharmacy",
                quantity=6.0,
                unit_rate=220.0,
                total_charge=1320.0,
            ),
            BillItem(
                item_id="item-9",
                item_name="Pharmacy: Ceftriaxone 1g Inj",
                category="Pharmacy",
                quantity=4.0,
                unit_rate=480.0,
                total_charge=1920.0,
            ),
            BillItem(
                item_id="item-10",
                item_name="Administrative & Admission File Fee",
                category="Overhead Surcharge",
                quantity=1.0,
                unit_rate=2500.0,
                total_charge=2500.0,
            ),
        ]
        total = sum(i.total_charge for i in items)
        return NormalizedBill(
            hospital_name="Apollo Specialty Healthcare India Ltd.",
            hospital_city="Delhi",
            bill_number="DEL-2024-89211",
            bill_date="2024-10-14",
            admission_date="2024-10-08",
            discharge_date="2024-10-12",
            patient_name="Ramesh Kumar Sharma",
            patient_uhid="DLH-9012384",
            ward_type="Super Deluxe / ICU Multi-bed",
            items=items,
            subtotal_amount=total,
            discount_amount=0.0,
            tax_amount=0.0,
            total_amount=total,
        )

    async def execute_demo_audit(
        self, db: Optional[AsyncSession] = None
    ) -> AuditReportResponse:
        """Execute deterministic audit on standard demo bill."""
        bill = self.get_demo_normalized_bill()
        return await self.execute_audit_on_bill(bill=bill, db=db)

    async def execute_audit_on_bill(
        self, bill: NormalizedBill, db: Optional[AsyncSession] = None
    ) -> AuditReportResponse:
        """
        Execute comprehensive deterministic audit on any NormalizedBill.
        1. Runs Rule Engine (Arithmetic, Duplicates, Caps, Unbundling, IRDAI, GST)
        2. Validates statutory evidence citations
        3. Generates clear patient explanations and recommended actions
        4. Calculates separated totals: Arithmetic errors, Suspicious charges, Disallowed items
        """
        # Step 1: Run Deterministic Rule Engine
        rule_result = self.rule_engine.evaluate_bill(bill)

        # Step 2: Validate Evidence & Generate Explanations
        findings: list[AuditFinding] = []
        arithmetic_total = 0.0
        suspicious_total = 0.0
        disallowed_total = 0.0

        for discrepancy in rule_result.discrepancies:
            evidence = self.evidence_validator.validate_discrepancy(discrepancy)
            v_type = discrepancy.violation_type.value

            # Classify category totals
            if v_type == "CALCULATION_ERROR":
                arithmetic_total += discrepancy.excess_amount
                rec_action = "Request billing supervisor to recalculate line math or bill subtotal and issue an amended invoice."
                confidence = "VERIFIED_MATHEMATICAL_ERROR (100% Deterministic)"
            elif v_type == "INSURANCE_NON_PAYABLE":
                disallowed_total += discrepancy.excess_amount
                rec_action = "Request hospital to absorb this supply into general room charges as mandated by IRDAI Master Circular."
                confidence = "HIGH (IRDAI Non-Payable Regulatory Schedule)"
            elif v_type == "DUPLICATE_ENTRY":
                suspicious_total += discrepancy.excess_amount
                rec_action = "Request nurse administration chart and diagnostic time-stamps to verify whether service was repeated."
                confidence = "MEDIUM (Cross-Reference with Medical Chart Advised)"
            elif v_type == "GST_MISCALCULATION":
                suspicious_total += discrepancy.excess_amount
                rec_action = "Request 0% GST adjustment under CBIC Notification 12/2017-Central Tax Sl. No. 74."
                confidence = "HIGH (CBIC Statutory Notification)"
            elif v_type in ["ARBITRARY_SURCHARGE", "UNBUNDLING_PROHIBITED"]:
                suspicious_total += discrepancy.excess_amount
                rec_action = "Present State Clinical Directives prohibiting unbundling of general institutional overheads."
                confidence = "HIGH (State Health Authority Directives)"
            else:
                suspicious_total += discrepancy.excess_amount
                rec_action = "Present notified statutory ceiling order and request deduction of excess tariff."
                confidence = "HIGH (Statutory Tariff Ceiling Order)"

            # Calculation basis string
            calc_details = discrepancy.calculation_details or {}
            calc_formula = calc_details.get("formula") or (
                f"Billed: ₹{discrepancy.billed_amount:,.2f} - Permissible: ₹{discrepancy.permissible_amount:,.2f} = Excess: ₹{discrepancy.excess_amount:,.2f}"
            )

            # LLM is used ONLY for explanation, not rule evaluation
            explanation = await self.llm_provider.generate_finding_explanation(
                finding_data={
                    "item_name": discrepancy.item_name,
                    "excess_amount": discrepancy.excess_amount,
                },
                rule_citation={
                    "title": discrepancy.rule_title,
                    "order_number": discrepancy.statutory_citation,
                },
            )

            findings.append(
                AuditFinding(
                    finding_id=f"fnd-{uuid.uuid4().hex[:8]}",
                    rule_id=discrepancy.rule_id,
                    item_name=discrepancy.item_name,
                    billed_amount=discrepancy.billed_amount,
                    permissible_amount=discrepancy.permissible_amount,
                    excess_amount=discrepancy.excess_amount,
                    violation_type=v_type,
                    severity=discrepancy.severity.value,
                    evidence_citation=evidence.citation_text,
                    patient_explanation=explanation.patient_summary,
                    auditor_notes=explanation.auditor_notes,
                    recommended_action=rec_action,
                    confidence_level=confidence,
                    calculation_basis=calc_formula,
                )
            )

        job_id = f"job-{uuid.uuid4().hex[:8]}"

        # Persist to database if active session provided
        if db is not None:
            try:
                job_model = AuditJobModel(
                    id=job_id,
                    status="COMPLETED",
                    state_jurisdiction=bill.hospital_city or "Delhi",
                    scheme_applied="CGHS",
                    hospital_name=bill.hospital_name,
                    patient_name=bill.patient_name,
                    bill_number=bill.bill_number,
                    total_billed_amount=rule_result.total_billed,
                    total_permissible_amount=rule_result.total_permissible,
                    potential_savings=rule_result.potential_savings,
                )
                db.add(job_model)

                for f in findings:
                    finding_model = FindingModel(
                        id=f.finding_id,
                        audit_job_id=job_id,
                        rule_id=f.rule_id,
                        item_name=f.item_name,
                        billed_amount=f.billed_amount,
                        permissible_amount=f.permissible_amount,
                        excess_amount=f.excess_amount,
                        violation_type=f.violation_type,
                        severity=f.severity,
                        evidence_citation=f.evidence_citation,
                        patient_explanation=f.patient_explanation,
                        auditor_notes=f.auditor_notes,
                    )
                    db.add(finding_model)

                await db.commit()
            except Exception as e:
                logger.warning(f"Could not persist audit job to DB: {e}")
                await db.rollback()

        return AuditReportResponse(
            job_id=job_id,
            status="COMPLETED",
            hospital_name=bill.hospital_name,
            patient_name=bill.patient_name,
            bill_number=bill.bill_number,
            bill_date=bill.bill_date,
            ward_type=bill.ward_type,
            total_billed=rule_result.total_billed,
            total_permissible=rule_result.total_permissible,
            potential_savings=rule_result.potential_savings,
            arithmetic_error_total=round(arithmetic_total, 2),
            suspicious_charges_total=round(suspicious_total, 2),
            disallowed_items_total=round(disallowed_total, 2),
            findings_count=len(findings),
            findings=findings,
            normalized_bill=bill,
        )

    def extract_bill_from_pdf(
        self,
        file_bytes_or_path: Union[bytes, str, Path],
        filename: str = "document.pdf",
    ) -> Tuple[NormalizedBill, PDFParsedDocument, RawTableExtraction]:
        """
        Execute reliable PDF extraction:
        1. PyMuPDF coordinate & block extraction
        2. Multi-signal scanned/empty/encrypted page assessment
        3. Table row and column extraction
        4. Bill normalization with field-level provenance
        """
        parsed_doc = PDFParser.parse_pdf(file_bytes_or_path, filename=filename)

        if parsed_doc.extraction_status.value in [
            "EMPTY_DOCUMENT",
            "ENCRYPTED_DOCUMENT",
            "CORRUPT_DOCUMENT",
            "UNSUPPORTED_FORMAT",
        ]:
            empty_table = RawTableExtraction()
            normalized = BillNormalizer.normalize(empty_table, parsed_doc)
            return normalized, parsed_doc, empty_table

        raw_table = TableExtractor.extract_table(parsed_doc)
        normalized_bill = BillNormalizer.normalize(raw_table, parsed_doc)
        return normalized_bill, parsed_doc, raw_table

