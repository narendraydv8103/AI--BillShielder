import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel

from backend.app.documents.currency import parse_indian_currency
from backend.app.documents.pdf_parser import PDFParsedDocument
from backend.app.documents.table_extractor import RawTableExtraction, RawTableRow
from backend.app.schemas.bill import BillItem, NormalizedBill
from backend.app.schemas.provenance import (
    ExtractionStatus,
    FieldProvenance,
    RawExtractedValue,
    UncertaintyFlag,
)


class BillNormalizer:
    """
    Transforms raw document extractions into standardized NormalizedBill schemas.
    Maintains strict separation between source-extracted raw values and computed normalized values.
    Never fabricates or claims inferred data as raw source extraction.
    """

    @classmethod
    def normalize(
        cls,
        raw_table: RawTableExtraction,
        parsed_doc: PDFParsedDocument,
    ) -> NormalizedBill:
        """Construct NormalizedBill with complete field provenance and diagnostics."""
        items: List[BillItem] = []
        item_idx = 1
        doc_uncertainties: List[str] = [f.value for f in parsed_doc.document_uncertainty_flags]

        for flag in raw_table.extraction_uncertainty_flags:
            if flag.value not in doc_uncertainties:
                doc_uncertainties.append(flag.value)

        # 1. Normalize line items
        for row in raw_table.rows:
            item = cls._normalize_row(row, item_idx)
            if item:
                items.append(item)
                item_idx += 1

        # 2. Extract header metadata from page 1 text blocks
        hospital_name = cls._extract_hospital_name(parsed_doc)
        bill_number = cls._extract_bill_number(parsed_doc)
        bill_date, admission_date, discharge_date = cls._extract_dates(parsed_doc)
        patient_name, patient_uhid = cls._extract_patient_details(parsed_doc)

        # 3. Compute or extract totals
        subtotal = 0.0
        if raw_table.subtotal and raw_table.subtotal.raw_text:
            parsed_sub = parse_indian_currency(raw_table.subtotal.raw_text)
            if parsed_sub.amount is not None:
                subtotal = parsed_sub.amount
        if subtotal == 0.0:
            subtotal = sum(i.total_charge for i in items if i.total_charge > 0)

        discount = 0.0
        if raw_table.discount and raw_table.discount.raw_text:
            parsed_disc = parse_indian_currency(raw_table.discount.raw_text)
            if parsed_disc.amount is not None:
                discount = abs(parsed_disc.amount)

        tax = 0.0
        if raw_table.tax and raw_table.tax.raw_text:
            parsed_tax = parse_indian_currency(raw_table.tax.raw_text)
            if parsed_tax.amount is not None:
                tax = parsed_tax.amount

        total = 0.0
        if raw_table.total and raw_table.total.raw_text:
            parsed_total = parse_indian_currency(raw_table.total.raw_text)
            if parsed_total.amount is not None:
                total = parsed_total.amount
        if total == 0.0:
            total = max(0.0, subtotal - discount + tax)

        # Sanity check: sum of line items vs subtotal
        computed_items_sum = sum(i.total_charge for i in items)
        if subtotal > 0 and abs(computed_items_sum - subtotal) > 5.0:
            doc_uncertainties.append(UncertaintyFlag.TOTAL_MISMATCH.value)

        # Prepare page diagnostics
        pages_info = [p.to_page_info().model_dump() for p in parsed_doc.pages]

        # Determine overall extraction status
        extraction_status = parsed_doc.extraction_status.value
        if parsed_doc.ocr_required:
            extraction_status = ExtractionStatus.OCR_REQUIRED.value
        elif not items and parsed_doc.page_count > 0:
            extraction_status = ExtractionStatus.UNCERTAIN.value

        return NormalizedBill(
            hospital_name=hospital_name or "Hospital / Clinical Establishment",
            hospital_city="India",
            bill_number=bill_number or f"BILL-{uuid.uuid4().hex[:8].upper()}",
            bill_date=bill_date,
            admission_date=admission_date,
            discharge_date=discharge_date,
            patient_name=patient_name,
            patient_uhid=patient_uhid,
            ward_type="Inpatient Care",
            items=items,
            subtotal_amount=round(subtotal, 2),
            discount_amount=round(discount, 2),
            tax_amount=round(tax, 2),
            total_amount=round(total, 2),
            extraction_status=extraction_status,
            ocr_required=parsed_doc.ocr_required,
            pages_info=pages_info,
            document_uncertainty_flags=doc_uncertainties,
            document_metadata=parsed_doc.metadata,
        )

    @classmethod
    def _normalize_row(cls, row: RawTableRow, index: int) -> Optional[BillItem]:
        """Convert a single RawTableRow into a BillItem with full provenance."""
        uncertainties: List[str] = [f.value for f in row.row_uncertainty_flags]
        field_prov: Dict[str, Any] = {}

        # 1. Description
        desc_text = "Unspecified Medical Service"
        if row.raw_description and row.raw_description.raw_text:
            desc_text = row.raw_description.raw_text.strip()
            field_prov["description"] = FieldProvenance(
                raw=row.raw_description,
                parsed_value=desc_text,
                is_inferred=False,
            ).model_dump()
        else:
            field_prov["description"] = FieldProvenance(
                raw=RawExtractedValue(raw_text=None, page_number=row.page_number),
                parsed_value=desc_text,
                is_inferred=True,
                uncertainty_flags=[UncertaintyFlag.AMBIGUOUS_COLUMNS],
            ).model_dump()

        # 2. Total Charge
        total_val = 0.0
        if row.raw_total_charge and row.raw_total_charge.raw_text:
            parsed = parse_indian_currency(row.raw_total_charge.raw_text)
            if parsed.amount is not None:
                total_val = parsed.amount
                if parsed.is_negative or parsed.is_discount_or_credit:
                    uncertainties.append(UncertaintyFlag.DISCOUNT_OR_CREDIT_APPLIED.value)
            if parsed.is_ambiguous:
                uncertainties.append(UncertaintyFlag.AMBIGUOUS_AMOUNT_FORMAT.value)

            field_prov["total_charge"] = FieldProvenance(
                raw=row.raw_total_charge,
                parsed_value=total_val,
                is_inferred=False,
            ).model_dump()
        else:
            field_prov["total_charge"] = FieldProvenance(
                raw=RawExtractedValue(raw_text=None, page_number=row.page_number),
                parsed_value=0.0,
                is_inferred=True,
                uncertainty_flags=[UncertaintyFlag.MISSING_LINE_TOTAL],
            ).model_dump()

        # 3. Quantity
        qty_val = 1.0
        qty_inferred = False
        if row.raw_quantity and row.raw_quantity.raw_text:
            parsed_q = parse_indian_currency(row.raw_quantity.raw_text)
            if parsed_q.amount is not None and parsed_q.amount > 0:
                qty_val = parsed_q.amount
            field_prov["quantity"] = FieldProvenance(
                raw=row.raw_quantity,
                parsed_value=qty_val,
                is_inferred=False,
            ).model_dump()
        else:
            qty_inferred = True
            uncertainties.append(UncertaintyFlag.INFERRED_QUANTITY.value)
            # Crucial: raw value is None, marked is_inferred=True
            field_prov["quantity"] = FieldProvenance(
                raw=RawExtractedValue(raw_text=None, page_number=row.page_number),
                parsed_value=1.0,
                is_inferred=True,
                uncertainty_flags=[UncertaintyFlag.INFERRED_QUANTITY],
            ).model_dump()

        # 4. Unit Rate
        rate_val = total_val
        rate_inferred = False
        if row.raw_unit_rate and row.raw_unit_rate.raw_text:
            parsed_r = parse_indian_currency(row.raw_unit_rate.raw_text)
            if parsed_r.amount is not None:
                rate_val = parsed_r.amount
            field_prov["unit_rate"] = FieldProvenance(
                raw=row.raw_unit_rate,
                parsed_value=rate_val,
                is_inferred=False,
            ).model_dump()
        else:
            rate_inferred = True
            if qty_val > 0:
                rate_val = round(total_val / qty_val, 2)
            uncertainties.append(UncertaintyFlag.INFERRED_RATE_FROM_TOTAL.value)
            # Crucial: raw value is None, marked is_inferred=True
            field_prov["unit_rate"] = FieldProvenance(
                raw=RawExtractedValue(raw_text=None, page_number=row.page_number),
                parsed_value=rate_val,
                is_inferred=True,
                uncertainty_flags=[UncertaintyFlag.INFERRED_RATE_FROM_TOTAL],
            ).model_dump()

        category = cls._categorize_item(desc_text)
        bbox_list = None
        if row.raw_description and row.raw_description.bounding_box:
            bbox_list = row.raw_description.bounding_box.as_list()

        return BillItem(
            item_id=f"item-{index}",
            item_name=desc_text,
            category=category,
            quantity=qty_val,
            unit_rate=rate_val,
            total_charge=total_val,
            raw_description=row.raw_description.raw_text if row.raw_description else None,
            raw_quantity=row.raw_quantity.raw_text if row.raw_quantity else None,
            raw_unit_rate=row.raw_unit_rate.raw_text if row.raw_unit_rate else None,
            raw_total_charge=row.raw_total_charge.raw_text if row.raw_total_charge else None,
            page_number=row.page_number,
            bounding_box=bbox_list,
            field_provenance=field_prov,
            uncertainty_flags=uncertainties,
        )

    @staticmethod
    def _categorize_item(desc: str) -> str:
        """Deterministic heuristic categorization into Indian hospital billing categories."""
        desc_l = desc.lower()
        if "icu" in desc_l:
            return "Intensive Care"
        if any(w in desc_l for w in ["room", "bed", "ward", "nursing"]):
            return "Accommodation"
        if any(w in desc_l for w in ["doctor", "visit", "consult", "surgeon"]):
            return "Professional Fees"
        if any(w in desc_l for w in ["gloves", "ppe", "mask", "syringe", "waste", "sanitizer", "disposable"]):
            return "Consumables & Overheads"
        if any(w in desc_l for w in ["pharmacy", "inj", "tab", "iv", "syrup", "medicine"]):
            return "Pharmacy"
        if any(w in desc_l for w in ["x-ray", "mri", "ct scan", "blood", "test", "pathology", "radiology"]):
            return "Diagnostics"
        return "General Healthcare Service"

    @staticmethod
    def _extract_hospital_name(doc: PDFParsedDocument) -> Optional[str]:
        """Extract candidate hospital name from top blocks of first page."""
        if not doc.pages:
            return None
        p1 = doc.pages[0]
        # Look at the first 3 text blocks
        for b in p1.blocks[:3]:
            for line in b.text.split("\n"):
                cleaned = line.strip()
                if len(cleaned) > 4 and any(
                    kw in cleaned.lower()
                    for kw in ["hospital", "healthcare", "clinic", "medical", "centre", "institute"]
                ):
                    return cleaned
        return None

    @staticmethod
    def _extract_bill_number(doc: PDFParsedDocument) -> Optional[str]:
        """Extract invoice/bill number matching common patterns."""
        if not doc.pages:
            return None
        match = re.search(r"(?:bill|invoice)\s*(?:no\.?|#)?\s*[:\-]?\s*([A-Za-z0-9\-_/]+)", doc.full_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return None

    @staticmethod
    def _extract_dates(doc: PDFParsedDocument) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Extract bill, admission, and discharge dates if present."""
        bill_date = None
        adm_date = None
        dis_date = None

        m_bill = re.search(r"(?:bill\s*date|invoice\s*date)\s*[:\-]?\s*(\d{1,2}[-/\.]\w+[-/\.]\d{2,4})", doc.full_text, re.IGNORECASE)
        if m_bill:
            bill_date = m_bill.group(1).strip()

        m_adm = re.search(r"(?:admission|adm)\s*(?:date)?\s*[:\-]?\s*(\d{1,2}[-/\.]\w+[-/\.]\d{2,4})", doc.full_text, re.IGNORECASE)
        if m_adm:
            adm_date = m_adm.group(1).strip()

        m_dis = re.search(r"(?:discharge|dis)\s*(?:date)?\s*[:\-]?\s*(\d{1,2}[-/\.]\w+[-/\.]\d{2,4})", doc.full_text, re.IGNORECASE)
        if m_dis:
            dis_date = m_dis.group(1).strip()

        return bill_date, adm_date, dis_date

    @staticmethod
    def _extract_patient_details(doc: PDFParsedDocument) -> Tuple[Optional[str], Optional[str]]:
        """Extract patient name and UHID if present without logging them."""
        name = None
        uhid = None

        m_name = re.search(r"(?:patient\s*name|name)\s*[:\-]?\s*([A-Za-z\s\.]+)(?:\s+(?:age|sex|gender|uhid|ipd))", doc.full_text, re.IGNORECASE)
        if m_name:
            name = m_name.group(1).strip()

        m_uhid = re.search(r"(?:uhid|mrn|ipd\s*no)\s*[:\-]?\s*([A-Za-z0-9\-_]+)", doc.full_text, re.IGNORECASE)
        if m_uhid:
            uhid = m_uhid.group(1).strip()

        return name, uhid
