from typing import Any
from backend.app.providers.base import (
    BaseOCRProvider,
    OCRExtractionResult,
    OCRExtractedLine,
    ProviderHealth,
)


class MockOCRProvider(BaseOCRProvider):
    """
    Mock OCR Provider for DEMO MODE.
    Returns structured synthetic Indian hospital bill text without requiring external OCR APIs.
    """

    DEMO_BILL_TEXT = """
APOLLO SPECIALTY HEALTHCARE INDIA LTD.
Inpatient Final Tax Invoice / Bill
Bill No: DEL-2024-89211
Date: 14-Oct-2024
Patient Name: Ramesh Kumar Sharma
Age/Sex: 54 / M
UHID: DLH-9012384
Admission Date: 08-Oct-2024  Discharge Date: 12-Oct-2024
Ward: Super Deluxe / ICU Multi-bed
TPA / Insurance: Star Health Insurance (Self-Pay Co-payment)

S.No. Description                       Qty    Rate (INR)   Total (INR)
1     ICU Bed & Nursing Charges          2     15,000.00    30,000.00
2     Room Rent (Private Deluxe)         2      9,500.00    19,000.00
3     Biomedical Waste Disposal Surcharge 4       850.00     3,400.00
4     PPE Kit - High Risk ICU Care       8      1,800.00    14,400.00
5     Sterile Surgical Gloves 7.5 (Pair) 12       350.00     4,200.00
6     Infusion Pump Surcharge (Per Day)  4      1,200.00     4,800.00
7     Doctor In-Patient Visit (Twice/Day) 8     2,500.00    20,000.00
8     Pharmacy: Paracetamol IV 100ml     6        220.00     1,320.00
9     Pharmacy: Ceftriaxone 1g Inj       4        480.00     1,920.00
10    Administrative & Admission File Fee 1     2,500.00     2,500.00
------------------------------------------------------------------------
Subtotal:                                                   101,540.00
GST / Taxes (Exempted Healthcare):                                 0.00
Total Payable Amount:                                       101,540.00
========================================================================
Authorized Signatory: Apollo Accounts Dept
"""

    async def extract_text(self, file_path_or_bytes: Any) -> OCRExtractionResult:
        lines = [
            OCRExtractedLine(text=line, confidence=0.98, page_number=1)
            for line in self.DEMO_BILL_TEXT.strip().split("\n")
            if line.strip()
        ]
        return OCRExtractionResult(
            raw_text=self.DEMO_BILL_TEXT.strip(),
            lines=lines,
            page_count=1,
            metadata={"source": "mock_demo_provider", "bill_id": "DEL-2024-89211"},
        )

    async def health_check(self) -> ProviderHealth:
        return ProviderHealth(
            provider_name="mock_ocr",
            provider_type="ocr",
            is_ready=True,
            is_demo=True,
            details="Mock OCR Provider operational with synthetic India hospital bill templates",
        )
