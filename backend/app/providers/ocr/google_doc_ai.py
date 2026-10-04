from typing import Any
from backend.app.providers.base import (
    BaseOCRProvider,
    OCRExtractionResult,
    ProviderHealth,
)


class GoogleDocumentAIProvider(BaseOCRProvider):
    """
    Cloud Google Document AI / Cloud Vision OCR Provider adapter.
    """

    def __init__(self, credentials_path: str = ""):
        self.credentials_path = credentials_path

    async def extract_text(self, file_path_or_bytes: Any) -> OCRExtractionResult:
        raise NotImplementedError("Google Document AI integration is scheduled for Step 2.")

    async def health_check(self) -> ProviderHealth:
        return ProviderHealth(
            provider_name="google_document_ai",
            provider_type="ocr",
            is_ready=False,
            is_demo=False,
            details="Google Document AI adapter registered. Ready for cloud service account configuration.",
        )
