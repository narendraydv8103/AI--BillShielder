from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class BillItem(BaseModel):
    item_id: str
    item_name: str
    category: str = "General"
    standard_code: Optional[str] = None
    quantity: float = 1.0
    unit_rate: float
    total_charge: float
    service_date: Optional[str] = None
    is_bundled_suspect: bool = False
    notes: Optional[str] = None

    # Step 2A Provenance & Raw Source Metadata (Separate from normalized values)
    raw_description: Optional[str] = None
    raw_quantity: Optional[str] = None
    raw_unit_rate: Optional[str] = None
    raw_total_charge: Optional[str] = None
    page_number: Optional[int] = None
    bounding_box: Optional[List[float]] = None  # [x0, y0, x1, y1]
    field_provenance: Optional[Dict[str, Any]] = None
    uncertainty_flags: List[str] = Field(default_factory=list)


class NormalizedBill(BaseModel):
    hospital_name: str
    hospital_city: Optional[str] = "Delhi"
    bill_number: str
    bill_date: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    patient_name: Optional[str] = None
    patient_uhid: Optional[str] = None
    ward_type: Optional[str] = "General"
    items: List[BillItem] = Field(default_factory=list)
    subtotal_amount: float
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float

    # Step 2A Extraction & Page Diagnostics
    extraction_status: str = "SUCCESS"
    ocr_required: bool = False
    pages_info: List[Dict[str, Any]] = Field(default_factory=list)
    document_uncertainty_flags: List[str] = Field(default_factory=list)
    document_metadata: Dict[str, Any] = Field(default_factory=dict)
