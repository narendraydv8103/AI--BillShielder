from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.bill import NormalizedBill


class AuditJobCreate(BaseModel):
    state: str = "Delhi"
    scheme: str = "CGHS"
    demo_bill_preset: Optional[str] = None


class AuditFinding(BaseModel):
    finding_id: str
    rule_id: str
    item_name: str
    billed_amount: float
    permissible_amount: float
    excess_amount: float
    violation_type: str  # "CALCULATION_ERROR", "DUPLICATE_ENTRY", "RATE_CAP_EXCEEDED", "UNBUNDLING_PROHIBITED", "ARBITRARY_SURCHARGE", "INSURANCE_NON_PAYABLE", "GST_MISCALCULATION"
    severity: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    evidence_citation: str
    patient_explanation: Optional[str] = None
    auditor_notes: Optional[str] = None
    recommended_action: Optional[str] = None
    confidence_level: Optional[str] = None
    calculation_basis: Optional[str] = None


class AuditJobResponse(BaseModel):
    job_id: str
    status: str  # "PENDING", "PROCESSING", "COMPLETED", "FAILED"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: str
    extraction_status: Optional[str] = None
    ocr_required: bool = False
    normalized_bill: Optional[NormalizedBill] = None


class ExtractionResponse(BaseModel):
    filename: str
    extraction_status: str
    ocr_required: bool
    page_count: int
    normalized_bill: NormalizedBill
    document_uncertainty_flags: List[str] = Field(default_factory=list)


class AuditReportResponse(BaseModel):
    job_id: str
    status: str
    hospital_name: str
    patient_name: Optional[str] = None
    bill_number: Optional[str] = None
    bill_date: Optional[str] = None
    ward_type: Optional[str] = None
    total_billed: float
    total_permissible: float
    potential_savings: float
    arithmetic_error_total: float = 0.0
    suspicious_charges_total: float = 0.0
    disallowed_items_total: float = 0.0
    findings_count: int
    findings: List[AuditFinding] = Field(default_factory=list)
    normalized_bill: Optional[NormalizedBill] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class AuditChatRequest(BaseModel):
    message: str
    bill: Optional[NormalizedBill] = None
    findings: List[AuditFinding] = Field(default_factory=list)
    history: List[ChatMessage] = Field(default_factory=list)


class AuditChatResponse(BaseModel):
    reply: str
    suggested_actions: List[str] = Field(default_factory=list)
    rule_citations: List[str] = Field(default_factory=list)


class DisputeLetterRequest(BaseModel):
    report: AuditReportResponse
    recipient_title: Optional[str] = "The Medical Superintendent / Patient Relations Officer"
    patient_address: Optional[str] = None
    notes: Optional[str] = None


class DisputeLetterResponse(BaseModel):
    html_content: str
    markdown_content: str
    summary: Dict[str, Any] = Field(default_factory=dict)
