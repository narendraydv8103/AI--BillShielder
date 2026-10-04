from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProviderHealth(BaseModel):
    provider_name: str
    provider_type: str  # "ocr" | "llm" | "storage"
    is_ready: bool
    is_demo: bool = False
    details: Optional[str] = None


class OCRExtractedLine(BaseModel):
    text: str
    confidence: float = 1.0
    bounding_box: Optional[List[float]] = None  # [x0, y0, x1, y1]
    page_number: int = 1


class OCRExtractionResult(BaseModel):
    raw_text: str
    lines: List[OCRExtractedLine] = Field(default_factory=list)
    page_count: int = 1
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BaseOCRProvider(ABC):
    """Abstract Base Class for OCR Providers (Tesseract, Google DocAI, Azure, Mock)."""

    @abstractmethod
    async def extract_text(self, file_path_or_bytes: Any) -> OCRExtractionResult:
        """Extract plain text and line coordinates from document."""
        pass

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        """Verify provider availability and credentials."""
        pass


class ClassificationResult(BaseModel):
    category: str
    sub_category: Optional[str] = None
    standardized_code: Optional[str] = None
    confidence: float = 1.0
    notes: Optional[str] = None


class ExplanationResult(BaseModel):
    patient_summary: str
    auditor_notes: str
    applicable_regulation_clarification: str
    dispute_recommendation: str


class BaseLLMProvider(ABC):
    """
    Abstract Base Class for LLM Providers (Gemini, OpenAI, Mock).
    CRITICAL: The LLM is NEVER used for statutory rule evaluation or mathematical calculations.
    It is strictly used for standardizing billing terminology and generating human-readable explanations.
    """

    @abstractmethod
    async def classify_billing_item(
        self,
        raw_item_name: str,
        charge_amount: float,
        context: Optional[Dict[str, Any]] = None,
    ) -> ClassificationResult:
        """Standardize raw hospital bill item line into CGHS/Standard category."""
        pass

    @abstractmethod
    async def generate_finding_explanation(
        self,
        finding_data: Dict[str, Any],
        rule_citation: Dict[str, Any],
    ) -> ExplanationResult:
        """Generate patient-friendly and legal-auditor explanations for a flagged violation."""
        pass

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        """Verify provider availability and credentials."""
        pass


class StoredFileInfo(BaseModel):
    file_id: str
    storage_path: str
    filename: str
    content_type: str
    size_bytes: int


class BaseStorageProvider(ABC):
    """Abstract Base Class for Document Storage (Local File System, S3, GCS)."""

    @abstractmethod
    async def save_file(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str = "application/pdf",
    ) -> StoredFileInfo:
        """Store uploaded hospital document and return metadata."""
        pass

    @abstractmethod
    async def get_file_bytes(self, storage_path: str) -> bytes:
        """Retrieve stored document bytes."""
        pass

    @abstractmethod
    async def delete_file(self, storage_path: str) -> bool:
        """Delete stored document."""
        pass

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        """Verify storage backend availability."""
        pass
