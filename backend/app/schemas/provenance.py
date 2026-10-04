from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field, field_validator


class UncertaintyFlag(str, Enum):
    """Explicit flags signaling extraction uncertainty or non-standard states."""
    OCR_REQUIRED = "OCR_REQUIRED"
    SCANNED_PAGE_DETECTED = "SCANNED_PAGE_DETECTED"
    UNCERTAIN_PAGE_TYPE = "UNCERTAIN_PAGE_TYPE"
    MISSING_UNIT_RATE = "MISSING_UNIT_RATE"
    MISSING_QUANTITY = "MISSING_QUANTITY"
    MISSING_LINE_TOTAL = "MISSING_LINE_TOTAL"
    AMBIGUOUS_COLUMNS = "AMBIGUOUS_COLUMNS"
    AMBIGUOUS_AMOUNT_FORMAT = "AMBIGUOUS_AMOUNT_FORMAT"
    WRAPPED_DESCRIPTION_MERGED = "WRAPPED_DESCRIPTION_MERGED"
    REPEATED_HEADER_SUPPRESSED = "REPEATED_HEADER_SUPPRESSED"
    INFERRED_QUANTITY = "INFERRED_QUANTITY"
    INFERRED_RATE_FROM_TOTAL = "INFERRED_RATE_FROM_TOTAL"
    DISCOUNT_OR_CREDIT_APPLIED = "DISCOUNT_OR_CREDIT_APPLIED"
    TOTAL_MISMATCH = "TOTAL_MISMATCH"


class ExtractionStatus(str, Enum):
    """High-level document extraction status."""
    SUCCESS = "SUCCESS"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"
    OCR_REQUIRED = "OCR_REQUIRED"
    UNCERTAIN = "UNCERTAIN"
    EMPTY_DOCUMENT = "EMPTY_DOCUMENT"
    ENCRYPTED_DOCUMENT = "ENCRYPTED_DOCUMENT"
    CORRUPT_DOCUMENT = "CORRUPT_DOCUMENT"
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"


class BoundingBox(BaseModel):
    """2D Bounding Box in points [x0, y0, x1, y1]."""
    x0: float
    y0: float
    x1: float
    y1: float

    @field_validator("x1")
    @classmethod
    def validate_x(cls, v: float, info) -> float:
        x0 = info.data.get("x0", 0.0)
        if v < x0:
            return x0  # Clamp if inverted
        return v

    @field_validator("y1")
    @classmethod
    def validate_y(cls, v: float, info) -> float:
        y0 = info.data.get("y0", 0.0)
        if v < y0:
            return y0  # Clamp if inverted
        return v

    def as_list(self) -> List[float]:
        return [round(self.x0, 2), round(self.y0, 2), round(self.x1, 2), round(self.y1, 2)]


class RawExtractedValue(BaseModel):
    """
    Exact raw text and coordinates as extracted directly from the source document.
    Never fabricated or modified.
    """
    raw_text: Optional[str] = None
    page_number: Optional[int] = None
    bounding_box: Optional[BoundingBox] = None
    extraction_method: str = "pymupdf_text_coordinate"


class FieldProvenance(BaseModel):
    """
    Provenance tracking connecting normalized field value back to raw source extraction.
    Explicitly distinguishes source-extracted data from computed/inferred data.
    """
    raw: RawExtractedValue
    parsed_value: Any = None
    is_inferred: bool = False  # True if computed/defaulted; NEVER claimed as raw extracted data
    uncertainty_flags: List[UncertaintyFlag] = Field(default_factory=list)


class PageExtractionInfo(BaseModel):
    """Page-level extraction metadata and multi-signal classification."""
    page_number: int
    has_selectable_text: bool
    text_length: int
    word_count: int
    image_count: int
    drawing_count: int
    is_likely_scanned: bool
    needs_ocr: bool
    page_uncertainty_flags: List[UncertaintyFlag] = Field(default_factory=list)
