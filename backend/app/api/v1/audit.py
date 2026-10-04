import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, UploadFile, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.db.session import get_db
from backend.app.schemas.audit import (
    AuditJobResponse,
    AuditReportResponse,
    AuditJobCreate,
    ExtractionResponse,
    AuditChatRequest,
    AuditChatResponse,
    DisputeLetterRequest,
    DisputeLetterResponse,
)
from backend.app.schemas.bill import NormalizedBill
from backend.app.services.audit_orchestrator import AuditOrchestrationService
from backend.app.services.ai_chat_service import AIChatService
from backend.app.services.report_generator import ReportGeneratorService
from backend.app.services.sample_bills import get_sample_bills_catalog, get_sample_bill_by_id

router = APIRouter(prefix="/audit", tags=["Audit"])
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


def get_audit_service() -> AuditOrchestrationService:
    return AuditOrchestrationService()


@router.post(
    "/demo",
    response_model=AuditReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute Demo Audit on Synthetic India Hospital Bill",
)
async def run_demo_audit(
    service: AuditOrchestrationService = Depends(get_audit_service),
    db: AsyncSession = Depends(get_db),
) -> AuditReportResponse:
    """
    Executes a complete deterministic audit on a synthetic private hospital bill.
    Runs entirely offline in DEMO MODE with zero external API dependencies.
    """
    return await service.execute_demo_audit(db=db)


@router.get(
    "/sample-bills",
    summary="List Pre-configured Realistic Synthetic Hospital Bills",
)
async def list_sample_bills() -> List[Dict[str, Any]]:
    """Returns catalog of realistic synthetic bills for 1-click demonstration."""
    return get_sample_bills_catalog()


@router.get(
    "/sample-bills/{bill_id}",
    response_model=NormalizedBill,
    summary="Get Specific Synthetic Sample Bill",
)
async def get_sample_bill(bill_id: str) -> NormalizedBill:
    """Return structured NormalizedBill for selected sample."""
    return get_sample_bill_by_id(bill_id)


@router.get(
    "/statutory-rules",
    summary="List 37 Verified Statutory Healthcare Rules",
)
async def list_statutory_rules(
    service: AuditOrchestrationService = Depends(get_audit_service),
) -> List[Dict[str, Any]]:
    """Return all 37 government rules from the knowledge base."""
    return service.rule_engine.get_all_statutory_rules()


@router.post(
    "/analyze-bill",
    response_model=AuditReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute Audit on Provided Normalized Bill",
)
async def analyze_normalized_bill(
    bill: NormalizedBill,
    service: AuditOrchestrationService = Depends(get_audit_service),
    db: AsyncSession = Depends(get_db),
) -> AuditReportResponse:
    """Run complete deterministic audit on provided bill data."""
    return await service.execute_audit_on_bill(bill=bill, db=db)


@router.post(
    "/chat",
    response_model=AuditChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask Explainable AI Agent About Bill & Findings",
)
async def chat_with_audit_agent(
    request: AuditChatRequest,
) -> AuditChatResponse:
    """Interactive patient advocate AI chat about specific bill discrepancies."""
    chat_service = AIChatService()
    return await chat_service.answer_query(request)


@router.post(
    "/dispute-letter",
    response_model=DisputeLetterResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Formal Patient Dispute Letter & Dossier",
)
async def generate_dispute_letter(
    request: DisputeLetterRequest,
) -> DisputeLetterResponse:
    """Generate printable HTML and Markdown dispute letter."""
    return ReportGeneratorService.generate_dispute_letter(request)


@router.post(
    "/upload",
    response_model=AuditJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload Hospital Bill Document (PDF/Image)",
)
async def upload_bill(
    file: UploadFile = File(...),
    state: str = Form("Delhi"),
    scheme: str = Form("CGHS"),
    service: AuditOrchestrationService = Depends(get_audit_service),
    db: AsyncSession = Depends(get_db),
) -> AuditJobResponse:
    """
    Accepts bill file, validates size/format, stores document, and executes PDF extraction pipeline.
    Never logs patient PII or raw medical data.
    """
    if not file.filename or not file.filename.lower().endswith((".pdf", ".png", ".jpg", ".jpeg")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported document format. Please upload PDF or image file.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum permissible size of {MAX_FILE_SIZE // (1024*1024)} MB.",
        )

    stored = await service.storage_provider.save_file(
        file_bytes=file_bytes, filename=file.filename, content_type=file.content_type or "application/pdf"
    )

    # If document is a PDF, run the extraction pipeline
    if file.filename.lower().endswith(".pdf"):
        norm_bill, parsed_doc, _ = service.extract_bill_from_pdf(file_bytes, filename=file.filename)
        job_status = "COMPLETED" if parsed_doc.extraction_status.value == "SUCCESS" else "PENDING"
        if parsed_doc.extraction_status.value in ["EMPTY_DOCUMENT", "ENCRYPTED_DOCUMENT", "CORRUPT_DOCUMENT"]:
            job_status = "FAILED"

        return AuditJobResponse(
            job_id=stored.file_id,
            status=job_status,
            extraction_status=parsed_doc.extraction_status.value,
            ocr_required=norm_bill.ocr_required,
            normalized_bill=norm_bill,
            message=(
                f"PDF extracted successfully with {len(norm_bill.items)} line item(s)."
                if job_status != "FAILED"
                else f"Extraction failed: {parsed_doc.error_detail}"
            ),
        )

    return AuditJobResponse(
        job_id=stored.file_id,
        status="PENDING",
        message=f"Bill '{file.filename}' received and stored. Ready for Step 2 OCR & extraction pipeline.",
    )


@router.post(
    "/extract",
    response_model=ExtractionResponse,
    status_code=status.HTTP_200_OK,
    summary="Synchronous PDF Extraction and Provenance Inspection",
)
async def extract_pdf(
    file: UploadFile = File(...),
    service: AuditOrchestrationService = Depends(get_audit_service),
) -> ExtractionResponse:
    """
    Directly parses an uploaded PDF hospital bill and returns normalized data
    with field-level provenance, bounding boxes, and uncertainty diagnostics.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported for direct PDF extraction.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum permissible size of {MAX_FILE_SIZE // (1024*1024)} MB.",
        )

    norm_bill, parsed_doc, _ = service.extract_bill_from_pdf(file_bytes, filename=file.filename)

    if parsed_doc.extraction_status.value in ["EMPTY_DOCUMENT", "ENCRYPTED_DOCUMENT", "CORRUPT_DOCUMENT"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"PDF extraction error: {parsed_doc.extraction_status.value} - {parsed_doc.error_detail or ''}",
        )

    return ExtractionResponse(
        filename=file.filename,
        extraction_status=parsed_doc.extraction_status.value,
        ocr_required=norm_bill.ocr_required,
        page_count=parsed_doc.page_count,
        normalized_bill=norm_bill,
        document_uncertainty_flags=norm_bill.document_uncertainty_flags,
    )


@router.get(
    "/{job_id}",
    response_model=AuditJobResponse,
    summary="Get Audit Job Status",
)
async def get_audit_status(job_id: str) -> AuditJobResponse:
    """Check processing status of an audit job."""
    return AuditJobResponse(
        job_id=job_id,
        status="PENDING",
        message="Job is registered. Async queue processing will be attached in Step 2.",
    )


@router.get(
    "/{job_id}/report",
    response_model=AuditReportResponse,
    summary="Get Final Audit Report",
)
async def get_audit_report(
    job_id: str,
    service: AuditOrchestrationService = Depends(get_audit_service),
    db: AsyncSession = Depends(get_db),
) -> AuditReportResponse:
    """Retrieve full audit report with evidence-backed findings."""
    return await service.execute_demo_audit(db=db)
