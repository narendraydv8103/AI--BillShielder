import re
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from backend.app.documents.currency import parse_indian_currency, ParsedCurrency
from backend.app.documents.pdf_parser import PDFParsedDocument, PDFPageContent, TextWord
from backend.app.schemas.provenance import (
    BoundingBox,
    RawExtractedValue,
    UncertaintyFlag,
)

# Header identification keywords
HEADER_SNO_KEYS = {"s.no", "s.no.", "sr.no", "sl.no", "item#", "#", "sno"}
HEADER_DESC_KEYS = {"description", "particulars", "item", "service", "procedure", "details"}
HEADER_QTY_KEYS = {"qty", "quantity", "units", "count", "days"}
HEADER_RATE_KEYS = {"rate", "unit rate", "price", "unit price", "tariff"}
HEADER_AMOUNT_KEYS = {"amount", "total", "charge", "net amount", "total (inr)", "total(inr)"}

# Summary / Total row keywords
SUMMARY_SUBTOTAL = {"subtotal", "sub total", "gross amount", "gross total"}
SUMMARY_TOTAL = {"total", "net payable", "total payable", "total amount", "net amount", "final total"}
SUMMARY_DISCOUNT = {"discount", "rebate", "concession", "less"}
SUMMARY_TAX = {"gst", "cgst", "sgst", "igst", "tax", "vat"}


class RawTableRow(BaseModel):
    """
    Extracted invoice row preserving raw source tokens, page numbers, and bounding boxes.
    Does NOT infer missing values as source-extracted data.
    """
    page_number: int
    raw_sno: Optional[RawExtractedValue] = None
    raw_description: Optional[RawExtractedValue] = None
    raw_quantity: Optional[RawExtractedValue] = None
    raw_unit_rate: Optional[RawExtractedValue] = None
    raw_total_charge: Optional[RawExtractedValue] = None
    is_summary_row: bool = False
    summary_type: Optional[str] = None  # "subtotal", "total", "discount", "tax"
    row_uncertainty_flags: List[UncertaintyFlag] = Field(default_factory=list)


class RawTableExtraction(BaseModel):
    """Structured collection of extracted table rows with provenance."""
    rows: List[RawTableRow] = Field(default_factory=list)
    summary_rows: List[RawTableRow] = Field(default_factory=list)
    subtotal: Optional[RawExtractedValue] = None
    discount: Optional[RawExtractedValue] = None
    tax: Optional[RawExtractedValue] = None
    total: Optional[RawExtractedValue] = None
    detected_headers: List[str] = Field(default_factory=list)
    repeated_headers_count: int = 0
    extraction_uncertainty_flags: List[UncertaintyFlag] = Field(default_factory=list)


class TableExtractor:
    """
    Coordinate-aligned invoice table row extractor.
    Groups word tokens by vertical (y) bands, classifies columns by horizontal (x) position
    or keyword alignment, merges multi-line wrapped descriptions, and filters repeated headers.
    """

    @classmethod
    def extract_table(cls, parsed_doc: PDFParsedDocument) -> RawTableExtraction:
        """Extract invoice line items and totals across all document pages."""
        if not parsed_doc.pages:
            return RawTableExtraction()

        all_candidate_rows: List[RawTableRow] = []
        detected_headers: List[str] = []
        repeated_headers = 0
        doc_flags: List[UncertaintyFlag] = []

        active_header_pattern: Optional[Dict[str, float]] = None

        for page in parsed_doc.pages:
            if not page.has_selectable_text or not page.words:
                continue

            page_rows, is_header_found, header_names = cls._extract_page_rows(page, active_header_pattern)

            if is_header_found:
                if not active_header_pattern:
                    detected_headers = header_names
                    active_header_pattern = {"count": 1.0}
                else:
                    repeated_headers += 1
                    doc_flags.append(UncertaintyFlag.REPEATED_HEADER_SUPPRESSED)

            all_candidate_rows.extend(page_rows)

        # Merge multi-line wrapped descriptions
        merged_rows, wrapped_count = cls._merge_wrapped_rows(all_candidate_rows)
        if wrapped_count > 0:
            doc_flags.append(UncertaintyFlag.WRAPPED_DESCRIPTION_MERGED)

        # Separate line items from summary rows
        item_rows: List[RawTableRow] = []
        summary_rows: List[RawTableRow] = []

        subtotal_val: Optional[RawExtractedValue] = None
        discount_val: Optional[RawExtractedValue] = None
        tax_val: Optional[RawExtractedValue] = None
        total_val: Optional[RawExtractedValue] = None

        for row in merged_rows:
            if row.is_summary_row:
                summary_rows.append(row)
                if row.summary_type == "subtotal" and not subtotal_val:
                    subtotal_val = row.raw_total_charge
                elif row.summary_type == "discount" and not discount_val:
                    discount_val = row.raw_total_charge
                elif row.summary_type == "tax" and not tax_val:
                    tax_val = row.raw_total_charge
                elif row.summary_type == "total" and not total_val:
                    total_val = row.raw_total_charge
            else:
                # Must have a total charge or unit rate to qualify as a billable line item
                if row.raw_total_charge or row.raw_unit_rate:
                    item_rows.append(row)

        return RawTableExtraction(
            rows=item_rows,
            summary_rows=summary_rows,
            subtotal=subtotal_val,
            discount=discount_val,
            tax=tax_val,
            total=total_val,
            detected_headers=detected_headers,
            repeated_headers_count=repeated_headers,
            extraction_uncertainty_flags=doc_flags,
        )

    @classmethod
    def _extract_page_rows(
        cls,
        page: PDFPageContent,
        known_headers: Optional[Dict[str, float]],
    ) -> Tuple[List[RawTableRow], bool, List[str]]:
        """Group word tokens into horizontal lines and classify them into row columns."""
        # 1. Group words by y-coordinate (tolerance: ~4 points vertical distance)
        words_sorted = sorted(page.words, key=lambda w: (w.bbox.y0, w.bbox.x0))
        lines: List[List[TextWord]] = []

        current_line: List[TextWord] = []
        current_y: Optional[float] = None

        for w in words_sorted:
            if current_y is None:
                current_y = w.bbox.y0
                current_line.append(w)
            else:
                # If word is within vertical tolerance of the current line
                if abs(w.bbox.y0 - current_y) <= 4.0:
                    current_line.append(w)
                else:
                    if current_line:
                        lines.append(sorted(current_line, key=lambda token: token.bbox.x0))
                    current_line = [w]
                    current_y = w.bbox.y0

        if current_line:
            lines.append(sorted(current_line, key=lambda token: token.bbox.x0))

        # 2. Inspect lines for table headers or invoice rows
        page_rows: List[RawTableRow] = []
        header_found = False
        header_names: List[str] = []

        # Check if this page contains an explicit table header
        page_has_header = any(cls._is_table_header(line_w) for line_w in lines)
        # If the page has an explicit header, wait until the header is reached
        # If no explicit header is found on this page, but previous page had a table, continue table
        in_table_section = not page_has_header and (known_headers is not None)

        for line_words in lines:
            line_str = " ".join(w.text for w in line_words).strip()
            line_lower = line_str.lower()

            # Check if this line is a table header
            is_header = cls._is_table_header(line_words)
            if is_header:
                header_found = True
                in_table_section = True
                header_names = [w.text for w in line_words]
                continue  # Header itself is not a data row

            # If not yet inside table section, lines belong to header/patient metadata
            if not in_table_section:
                continue

            # Check if this line is a numbered line item (e.g. "1", "2.")
            has_sno = bool(line_words and re.match(r"^\d{1,3}\.?$", line_words[0].text))

            # Check if this line is a summary row (only if not a numbered line item)
            summary_type = None if has_sno else cls._get_summary_type(line_lower)
            if summary_type:
                row = cls._parse_summary_line(line_words, page.page_number, summary_type)
                page_rows.append(row)
                continue

            # Check for footer noise (e.g. "Continued on Page...", "Page X of Y", "Terms and conditions")
            if cls._is_footer_noise(line_lower):
                continue

            # Parse structured table data line
            row = cls._parse_table_data_line(line_words, page.page_number)
            if row:
                page_rows.append(row)

        return page_rows, header_found, header_names

    @classmethod
    def _is_footer_noise(cls, text_lower: str) -> bool:
        """Check if line is a page footer, continuation marker, or disclaimer."""
        noise_keywords = [
            "continued on page",
            "continues on page",
            "page 1 of",
            "page 2 of",
            "page 3 of",
            "page 4 of",
            "page 5 of",
            "page 6 of",
            "terms and conditions",
            "authorized signatory",
            "e. & o.e.",
            "e.&o.e.",
        ]
        return any(k in text_lower for k in noise_keywords)

    @classmethod
    def _is_table_header(cls, words: List[TextWord]) -> bool:
        """Detect whether a line is a table column header line."""
        text_lower = " ".join(w.text.lower() for w in words)
        matches = 0
        if any(k in text_lower for k in HEADER_SNO_KEYS):
            matches += 1
        if any(k in text_lower for k in HEADER_DESC_KEYS):
            matches += 1
        if any(k in text_lower for k in HEADER_QTY_KEYS):
            matches += 1
        if any(k in text_lower for k in HEADER_RATE_KEYS):
            matches += 1
        if any(k in text_lower for k in HEADER_AMOUNT_KEYS):
            matches += 1

        # If at least 2 distinct header column concepts are matched
        return matches >= 2

    @classmethod
    def _get_summary_type(cls, text_lower: str) -> Optional[str]:
        """Classify line as subtotal, total, tax, or discount."""
        if any(k in text_lower for k in SUMMARY_SUBTOTAL):
            return "subtotal"
        if any(k in text_lower for k in SUMMARY_DISCOUNT):
            return "discount"
        if any(k in text_lower for k in SUMMARY_TAX):
            return "tax"
        if any(k in text_lower for k in SUMMARY_TOTAL):
            return "total"
        return None

    @classmethod
    def _parse_summary_line(
        cls, words: List[TextWord], page_num: int, summary_type: str
    ) -> RawTableRow:
        """Parse summary line into amount with provenance."""
        # Find the numeric/currency amount token (usually the rightmost token)
        amount_word = None
        for w in reversed(words):
            parsed = parse_indian_currency(w.text)
            if not parsed.is_ambiguous and parsed.amount is not None:
                amount_word = w
                break

        raw_amount = None
        if amount_word:
            raw_amount = RawExtractedValue(
                raw_text=amount_word.text,
                page_number=page_num,
                bounding_box=amount_word.bbox,
                extraction_method="pymupdf_summary_row",
            )

        line_bbox = cls._combine_bboxes([w.bbox for w in words])
        raw_desc = RawExtractedValue(
            raw_text=" ".join(w.text for w in words),
            page_number=page_num,
            bounding_box=line_bbox,
            extraction_method="pymupdf_summary_row",
        )

        return RawTableRow(
            page_number=page_num,
            raw_description=raw_desc,
            raw_total_charge=raw_amount,
            is_summary_row=True,
            summary_type=summary_type,
        )

    @classmethod
    def _parse_table_data_line(
        cls, words: List[TextWord], page_num: int
    ) -> Optional[RawTableRow]:
        """
        Parse an invoice table row by distinguishing description text from numeric quantities/rates/totals.
        Never infers missing numbers as source-extracted raw values.
        """
        if not words:
            return None

        # Filter out decorative horizontal separator lines (e.g. "----", "====")
        full_line = "".join(w.text for w in words)
        if set(full_line).issubset({"-", "=", "_", "*", "."}):
            return None

        # Check for numeric candidates from right to left (Amount, Rate, Qty)
        desc_words: List[TextWord] = []
        numeric_words: List[Tuple[TextWord, ParsedCurrency]] = []
        sno_word: Optional[TextWord] = None

        # Check first token for serial number (e.g. "1", "1.", "10")
        start_idx = 0
        if re.match(r"^\d{1,3}\.?$", words[0].text):
            sno_word = words[0]
            start_idx = 1

        for w in words[start_idx:]:
            parsed = parse_indian_currency(w.text)
            if not parsed.is_ambiguous and parsed.amount is not None:
                numeric_words.append((w, parsed))
            else:
                desc_words.append(w)

        # If line has no words or purely non-item text, skip
        if not desc_words and not numeric_words:
            return None

        flags: List[UncertaintyFlag] = []

        raw_desc: Optional[RawExtractedValue] = None
        if desc_words:
            desc_text = " ".join(w.text for w in desc_words).strip()
            desc_bbox = cls._combine_bboxes([w.bbox for w in desc_words])
            raw_desc = RawExtractedValue(
                raw_text=desc_text,
                page_number=page_num,
                bounding_box=desc_bbox,
                extraction_method="pymupdf_text_coordinate",
            )

        raw_sno: Optional[RawExtractedValue] = None
        if sno_word:
            raw_sno = RawExtractedValue(
                raw_text=sno_word.text,
                page_number=page_num,
                bounding_box=sno_word.bbox,
                extraction_method="pymupdf_text_coordinate",
            )

        raw_qty: Optional[RawExtractedValue] = None
        raw_rate: Optional[RawExtractedValue] = None
        raw_amount: Optional[RawExtractedValue] = None

        num_count = len(numeric_words)
        if num_count >= 3:
            # Standard: Qty, Rate, Total
            qty_word, _ = numeric_words[0]
            rate_word, _ = numeric_words[1]
            amount_word, _ = numeric_words[2]

            raw_qty = RawExtractedValue(
                raw_text=qty_word.text,
                page_number=page_num,
                bounding_box=qty_word.bbox,
                extraction_method="pymupdf_column_alignment",
            )
            raw_rate = RawExtractedValue(
                raw_text=rate_word.text,
                page_number=page_num,
                bounding_box=rate_word.bbox,
                extraction_method="pymupdf_column_alignment",
            )
            raw_amount = RawExtractedValue(
                raw_text=amount_word.text,
                page_number=page_num,
                bounding_box=amount_word.bbox,
                extraction_method="pymupdf_column_alignment",
            )
        elif num_count == 2:
            # Ambiguity: could be (Qty, Total) or (Rate, Total)
            first_w, first_parsed = numeric_words[0]
            second_w, second_parsed = numeric_words[1]

            # If first is a small integer (<= 100), likely quantity
            if first_parsed.amount is not None and first_parsed.amount.is_integer() and first_parsed.amount <= 100:
                raw_qty = RawExtractedValue(
                    raw_text=first_w.text,
                    page_number=page_num,
                    bounding_box=first_w.bbox,
                    extraction_method="pymupdf_column_alignment",
                )
                flags.append(UncertaintyFlag.MISSING_UNIT_RATE)
            else:
                raw_rate = RawExtractedValue(
                    raw_text=first_w.text,
                    page_number=page_num,
                    bounding_box=first_w.bbox,
                    extraction_method="pymupdf_column_alignment",
                )
                flags.append(UncertaintyFlag.MISSING_QUANTITY)

            raw_amount = RawExtractedValue(
                raw_text=second_w.text,
                page_number=page_num,
                bounding_box=second_w.bbox,
                extraction_method="pymupdf_column_alignment",
            )
        elif num_count == 1:
            # Single number: total amount
            amt_w, _ = numeric_words[0]
            raw_amount = RawExtractedValue(
                raw_text=amt_w.text,
                page_number=page_num,
                bounding_box=amt_w.bbox,
                extraction_method="pymupdf_column_alignment",
            )
            flags.append(UncertaintyFlag.MISSING_QUANTITY)
            flags.append(UncertaintyFlag.MISSING_UNIT_RATE)
        else:
            # Wrapped description line or non-amount line
            flags.append(UncertaintyFlag.MISSING_LINE_TOTAL)

        return RawTableRow(
            page_number=page_num,
            raw_sno=raw_sno,
            raw_description=raw_desc,
            raw_quantity=raw_qty,
            raw_unit_rate=raw_rate,
            raw_total_charge=raw_amount,
            is_summary_row=False,
            row_uncertainty_flags=flags,
        )

    @classmethod
    def _merge_wrapped_rows(
        cls, rows: List[RawTableRow]
    ) -> Tuple[List[RawTableRow], int]:
        """
        Merge wrapped multi-line descriptions into parent row.
        A row is considered wrapped description if it has a description but NO amount,
        and follows immediately after or before a row that has amounts.
        """
        if not rows:
            return [], 0

        merged: List[RawTableRow] = []
        wrapped_count = 0

        for r in rows:
            # If current row has description but NO total charge and NO rate/qty
            if (
                r.raw_description
                and not r.raw_total_charge
                and not r.raw_unit_rate
                and not r.is_summary_row
                and merged
                and not merged[-1].is_summary_row
                and merged[-1].page_number == r.page_number
            ):
                prev = merged[-1]
                prev_bbox = prev.raw_description.bounding_box if prev.raw_description else None
                curr_bbox = r.raw_description.bounding_box if r.raw_description else None

                is_adjacent = True
                if prev_bbox and curr_bbox:
                    delta_y = curr_bbox.y0 - prev_bbox.y1
                    # Continuation lines should be within ~25 points below the previous line
                    if delta_y > 25.0 or delta_y < -5.0:
                        is_adjacent = False

                if is_adjacent and prev.raw_description:
                    stitched_text = f"{prev.raw_description.raw_text} {r.raw_description.raw_text}"
                    combined_bbox = cls._combine_two_bboxes(
                        prev.raw_description.bounding_box, r.raw_description.bounding_box
                    )
                    prev.raw_description.raw_text = stitched_text
                    prev.raw_description.bounding_box = combined_bbox
                    if UncertaintyFlag.WRAPPED_DESCRIPTION_MERGED not in prev.row_uncertainty_flags:
                        prev.row_uncertainty_flags.append(UncertaintyFlag.WRAPPED_DESCRIPTION_MERGED)
                    wrapped_count += 1
                    continue

            # If row has NO total charge and NO rate and is not a summary row, omit it
            if not r.raw_total_charge and not r.raw_unit_rate and not r.is_summary_row:
                continue

            merged.append(r)

        return merged, wrapped_count

    @staticmethod
    def _combine_bboxes(boxes: List[BoundingBox]) -> Optional[BoundingBox]:
        """Union a list of bounding boxes."""
        if not boxes:
            return None
        return BoundingBox(
            x0=min(b.x0 for b in boxes),
            y0=min(b.y0 for b in boxes),
            x1=max(b.x1 for b in boxes),
            y1=max(b.y1 for b in boxes),
        )

    @staticmethod
    def _combine_two_bboxes(b1: Optional[BoundingBox], b2: Optional[BoundingBox]) -> Optional[BoundingBox]:
        if not b1:
            return b2
        if not b2:
            return b1
        return BoundingBox(
            x0=min(b1.x0, b2.x0),
            y0=min(b1.y0, b2.y0),
            x1=max(b1.x1, b2.x1),
            y1=max(b1.y1, b2.y1),
        )
