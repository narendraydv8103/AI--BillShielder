import io
import pytest
import pymupdf
from fastapi import status
from httpx import AsyncClient

from backend.app.documents.currency import parse_indian_currency
from backend.app.documents.pdf_parser import PDFParser
from backend.app.documents.table_extractor import TableExtractor
from backend.app.documents.normalizer import BillNormalizer
from backend.app.schemas.provenance import (
    BoundingBox,
    ExtractionStatus,
    UncertaintyFlag,
)
from tests.fixtures.pdf_fixtures import (
    create_digital_invoice_multipage_pdf,
    create_wrapped_description_pdf,
    create_indian_currency_pdf,
    create_ambiguous_columns_pdf,
    create_scanned_image_pdf,
    create_blank_pdf,
    create_encrypted_pdf,
)


# ============================================================================
# 1. BoundingBox & Coordinate Validity Tests
# ============================================================================

def test_bounding_box_validity():
    """Verify BoundingBox schema enforces non-inverted geometry and round trip."""
    box = BoundingBox(x0=50.0, y0=100.0, x1=200.0, y1=150.0)
    assert box.x0 == 50.0
    assert box.y0 == 100.0
    assert box.x1 == 200.0
    assert box.y1 == 150.0
    assert box.as_list() == [50.0, 100.0, 200.0, 150.0]

    # Inverted box coordinates should clamp x1 >= x0 and y1 >= y0
    clamped = BoundingBox(x0=100.0, y0=200.0, x1=50.0, y1=150.0)
    assert clamped.x1 >= clamped.x0
    assert clamped.y1 >= clamped.y0


# ============================================================================
# 2. Currency Parsing Semantics Tests
# ============================================================================

def test_currency_positive_and_indian_numbering():
    """Verify standard positive numbers and Indian lakhs/crores formatting."""
    res1 = parse_indian_currency("15000.00")
    assert res1.amount == 15000.0
    assert not res1.is_negative
    assert not res1.is_ambiguous

    # Indian comma grouping: 1,50,000.00 -> 150000.0
    res2 = parse_indian_currency("1,50,000.00")
    assert res2.amount == 150000.0
    assert not res2.is_negative

    # Currency symbols: ₹, Rs., INR
    res3 = parse_indian_currency("₹ 1,50,000.00")
    assert res3.amount == 150000.0

    res4 = parse_indian_currency("Rs. 4,500.50")
    assert res4.amount == 4500.50

    res5 = parse_indian_currency("INR 25,000")
    assert res5.amount == 25000.0


def test_currency_negative_and_credit_semantics():
    """
    Verify strict accounting semantics for negative amounts,
    parenthesized credits, trailing minus, and discounts.
    """
    # Leading minus
    res1 = parse_indian_currency("-1200.00")
    assert res1.amount == -1200.0
    assert res1.is_negative

    # Leading minus with space and symbol
    res2 = parse_indian_currency("₹ - 1,200.00")
    assert res2.amount == -1200.0
    assert res2.is_negative

    # Trailing minus: 500.00-
    res3 = parse_indian_currency("500.00-")
    assert res3.amount == -500.0
    assert res3.is_negative

    # Parenthesized credit: (500.00) -> -500.0
    res4 = parse_indian_currency("(500.00)")
    assert res4.amount == -500.0
    assert res4.is_negative
    assert res4.is_parenthesized

    # Parenthesized credit with symbol: (₹ 1,500.00) -> -1500.0
    res5 = parse_indian_currency("(₹ 1,500.00)")
    assert res5.amount == -1500.0
    assert res5.is_negative
    assert res5.is_parenthesized

    # Trailing CR: 750.00 CR -> negative credit
    res6 = parse_indian_currency("750.00 CR")
    assert res6.amount == -750.0
    assert res6.is_negative
    assert res6.is_discount_or_credit

    # Indian suffix notation: 500/- -> positive 500.0
    res7 = parse_indian_currency("500/-")
    assert res7.amount == 500.0
    assert not res7.is_negative


def test_currency_ambiguous_and_invalid():
    """Verify ambiguous formats, multiple decimals, and invalid text are rejected."""
    # Multiple decimals
    res1 = parse_indian_currency("12.34.56")
    assert res1.is_ambiguous
    assert res1.amount is None

    # Date formatted string
    res2 = parse_indian_currency("12/10/2024")
    assert res2.is_ambiguous
    assert res2.amount is None

    # Alphabetic text
    res3 = parse_indian_currency("N/A")
    assert res3.is_ambiguous
    assert res3.amount is None

    # None and empty
    assert parse_indian_currency(None).is_ambiguous
    assert parse_indian_currency("   ").is_ambiguous


# ============================================================================
# 3. PDF Parser Multi-Signal Detection Tests
# ============================================================================

def test_pdf_parser_digital_document():
    """Verify digital PDF with selectable text is detected as digital (not scanned)."""
    pdf_bytes = create_digital_invoice_multipage_pdf()
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="digital_bill.pdf")

    assert parsed.extraction_status == ExtractionStatus.SUCCESS
    assert not parsed.ocr_required
    assert parsed.page_count == 2
    assert len(parsed.pages) == 2

    # Check page 1
    p1 = parsed.pages[0]
    assert p1.page_number == 1
    assert p1.has_selectable_text
    assert not p1.is_likely_scanned
    assert not p1.needs_ocr
    assert p1.word_count > 10
    assert len(p1.words) > 10


def test_pdf_parser_scanned_image_document():
    """Verify scanned document (raster image, 0 text) is identified as requiring OCR."""
    pdf_bytes = create_scanned_image_pdf()
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="scanned_bill.pdf")

    assert parsed.extraction_status == ExtractionStatus.OCR_REQUIRED
    assert parsed.ocr_required
    assert parsed.page_count == 1

    p1 = parsed.pages[0]
    assert not p1.has_selectable_text
    assert p1.is_likely_scanned
    assert p1.needs_ocr
    assert p1.image_count >= 1
    assert UncertaintyFlag.SCANNED_PAGE_DETECTED in p1.page_uncertainty_flags
    assert UncertaintyFlag.OCR_REQUIRED in p1.page_uncertainty_flags


def test_pdf_parser_low_text_alone_not_scanned():
    """
    Requirement 1: Low extracted text ALONE is NOT treated as definitive proof
    of a scanned PDF if images are absent. Flagged as UNCERTAIN_PAGE_TYPE.
    """
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    # Insert very sparse text (< 30 chars, no images)
    page.insert_text(pymupdf.Point(50, 50), "Only 15 chars", fontsize=10)
    pdf_bytes = doc.tobytes()
    doc.close()

    parsed = PDFParser.parse_pdf(pdf_bytes, filename="sparse.pdf")
    p1 = parsed.pages[0]

    # Must NOT be marked as scanned when there are no images
    assert not p1.is_likely_scanned
    assert not p1.needs_ocr
    assert UncertaintyFlag.UNCERTAIN_PAGE_TYPE in p1.page_uncertainty_flags


def test_pdf_parser_blank_document():
    """Verify blank PDF handling."""
    pdf_bytes = create_blank_pdf()
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="blank.pdf")

    assert parsed.page_count == 1
    p1 = parsed.pages[0]
    assert not p1.has_selectable_text
    assert not p1.is_likely_scanned
    assert not p1.needs_ocr


def test_pdf_parser_encrypted_document():
    """Verify encrypted PDF is safely flagged without crash."""
    pdf_bytes = create_encrypted_pdf(password="secret123")
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="encrypted.pdf")

    assert parsed.extraction_status == ExtractionStatus.ENCRYPTED_DOCUMENT
    assert "password" in parsed.error_detail.lower() or "encrypted" in parsed.error_detail.lower()


def test_pdf_parser_corrupt_and_empty_bytes():
    """Verify corrupt and 0-byte inputs fail gracefully."""
    # 0 bytes
    parsed_empty = PDFParser.parse_pdf(b"", filename="empty.pdf")
    assert parsed_empty.extraction_status == ExtractionStatus.EMPTY_DOCUMENT

    # Corrupt bytes
    parsed_corrupt = PDFParser.parse_pdf(b"Not a PDF file header", filename="corrupt.pdf")
    assert parsed_corrupt.extraction_status == ExtractionStatus.CORRUPT_DOCUMENT


# ============================================================================
# 4. Table Extraction & Multi-Page Handling Tests
# ============================================================================

def test_multipage_table_extraction():
    """
    Verify TableExtractor extracts items across multiple pages,
    suppresses repeated headers on page 2, and preserves page numbers.
    """
    pdf_bytes = create_digital_invoice_multipage_pdf()
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="multipage.pdf")
    table = TableExtractor.extract_table(parsed)

    # 4 items on page 1 + 4 items on page 2 = 8 line items
    assert len(table.rows) == 8

    # Check page numbers
    page_1_items = [r for r in table.rows if r.page_number == 1]
    page_2_items = [r for r in table.rows if r.page_number == 2]
    assert len(page_1_items) == 4
    assert len(page_2_items) == 4

    # Verify repeated headers suppressed
    assert table.repeated_headers_count >= 1
    assert UncertaintyFlag.REPEATED_HEADER_SUPPRESSED in table.extraction_uncertainty_flags

    # Verify summary rows captured
    assert table.subtotal is not None
    assert "61080" in table.subtotal.raw_text
    assert table.total is not None
    assert "60000" in table.total.raw_text


def test_wrapped_description_merging():
    """Verify multi-line item description is merged into single row."""
    pdf_bytes = create_wrapped_description_pdf()
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="wrapped.pdf")
    table = TableExtractor.extract_table(parsed)

    # Should have exactly 2 line items (row 1 + wrapped continuation merged, row 2)
    assert len(table.rows) == 2

    first_item = table.rows[0]
    assert first_item.raw_description is not None
    desc = first_item.raw_description.raw_text
    assert "Surgical Laparoscopic Abdominal Intervention" in desc
    assert "intraoperative fluoroscopy guidance" in desc
    assert UncertaintyFlag.WRAPPED_DESCRIPTION_MERGED in first_item.row_uncertainty_flags
    assert UncertaintyFlag.WRAPPED_DESCRIPTION_MERGED in table.extraction_uncertainty_flags


# ============================================================================
# 5. Raw vs Normalized Separation & Provenance Tests
# ============================================================================

def test_raw_vs_normalized_provenance():
    """
    Requirement 2 & 4: Keep raw extracted values separate from normalized values.
    Never infer a missing quantity/rate and present it as source-extracted data.
    """
    pdf_bytes = create_ambiguous_columns_pdf()
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="ambiguous.pdf")
    table = TableExtractor.extract_table(parsed)
    normalized = BillNormalizer.normalize(table, parsed)

    assert len(normalized.items) == 3

    # Item 1: Emergency Resuscitation Service (Total: 5000.0, Qty missing, Rate missing)
    item1 = normalized.items[0]
    assert item1.raw_total_charge == "5000.00"
    assert item1.raw_quantity is None  # Raw quantity was NOT present
    assert item1.raw_unit_rate is None  # Raw unit rate was NOT present

    # Normalized fields have defaulted/inferred values
    assert item1.quantity == 1.0
    assert item1.unit_rate == 5000.0
    assert item1.total_charge == 5000.0

    # Provenance must clearly mark inference
    prov_qty = item1.field_provenance["quantity"]
    assert prov_qty["is_inferred"] is True
    assert prov_qty["raw"]["raw_text"] is None

    prov_rate = item1.field_provenance["unit_rate"]
    assert prov_rate["is_inferred"] is True
    assert prov_rate["raw"]["raw_text"] is None

    prov_total = item1.field_provenance["total_charge"]
    assert prov_total["is_inferred"] is False
    assert prov_total["raw"]["raw_text"] == "5000.00"

    # Uncertainty flags must be attached
    assert UncertaintyFlag.INFERRED_QUANTITY.value in item1.uncertainty_flags
    assert UncertaintyFlag.INFERRED_RATE_FROM_TOTAL.value in item1.uncertainty_flags


def test_indian_currency_in_normalized_bill():
    """Verify Indian currency formats normalize accurately with provenance."""
    pdf_bytes = create_indian_currency_pdf()
    parsed = PDFParser.parse_pdf(pdf_bytes, filename="inr.pdf")
    table = TableExtractor.extract_table(parsed)
    normalized = BillNormalizer.normalize(table, parsed)

    # Check Specialist Consultation ₹ 1,50,000.00
    item1 = normalized.items[0]
    assert item1.unit_rate == 150000.0
    assert item1.total_charge == 150000.0

    # Check Concession Rebate -1,200.00
    item3 = normalized.items[2]
    assert item3.total_charge == -1200.0
    assert UncertaintyFlag.DISCOUNT_OR_CREDIT_APPLIED.value in item3.uncertainty_flags

    # Check Advance Credit (500.00)
    item4 = normalized.items[3]
    assert item4.total_charge == -500.0
    assert UncertaintyFlag.DISCOUNT_OR_CREDIT_APPLIED.value in item4.uncertainty_flags

    # Check 500/- notation
    item5 = normalized.items[4]
    assert item5.total_charge == 500.0


# ============================================================================
# 6. API Endpoint Tests (Step 2A Integration & Regression)
# ============================================================================

@pytest.mark.asyncio
async def test_api_direct_extract_endpoint(client: AsyncClient):
    """Test POST /api/v1/audit/extract with multi-page digital PDF."""
    pdf_bytes = create_digital_invoice_multipage_pdf()
    files = {"file": ("invoice.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    response = await client.post("/api/v1/audit/extract", files=files)
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["filename"] == "invoice.pdf"
    assert data["extraction_status"] == "SUCCESS"
    assert not data["ocr_required"]
    assert data["page_count"] == 2

    norm = data["normalized_bill"]
    assert "Max Super Speciality Hospital" in norm["hospital_name"]
    assert norm["bill_number"] == "MAX-2024-8831"
    assert len(norm["items"]) == 8
    assert norm["total_amount"] == 60000.0

    # Verify field provenance on items
    first_item = norm["items"][0]
    assert first_item["page_number"] == 1
    assert first_item["bounding_box"] is not None
    assert len(first_item["bounding_box"]) == 4
    assert first_item["field_provenance"] is not None


@pytest.mark.asyncio
async def test_api_upload_endpoint_with_pdf(client: AsyncClient):
    """Test POST /api/v1/audit/upload with PDF file."""
    pdf_bytes = create_digital_invoice_multipage_pdf()
    files = {"file": ("hospital_bill.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    data = {"state": "Delhi", "scheme": "CGHS"}

    response = await client.post("/api/v1/audit/upload", files=files, data=data)
    assert response.status_code == status.HTTP_202_ACCEPTED

    res = response.json()
    assert res["status"] == "COMPLETED"
    assert res["extraction_status"] == "SUCCESS"
    assert not res["ocr_required"]
    assert res["normalized_bill"] is not None
    assert len(res["normalized_bill"]["items"]) == 8


@pytest.mark.asyncio
async def test_api_extract_corrupt_file_handling(client: AsyncClient):
    """Test POST /api/v1/audit/extract with corrupt bytes returns 422."""
    files = {"file": ("corrupt.pdf", io.BytesIO(b"garbage content"), "application/pdf")}
    response = await client.post("/api/v1/audit/extract", files=files)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert "CORRUPT_DOCUMENT" in response.json()["detail"]


@pytest.mark.asyncio
async def test_api_extract_empty_file_handling(client: AsyncClient):
    """Test POST /api/v1/audit/extract with 0-byte file returns 400."""
    files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    response = await client.post("/api/v1/audit/extract", files=files)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "empty" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_api_demo_regression(client: AsyncClient):
    """Verify demo audit endpoint regression (must remain fully intact)."""
    response = await client.post("/api/v1/audit/demo")
    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["findings_count"] > 0
    assert data["total_billed"] > 0
    assert data["potential_savings"] > 0
