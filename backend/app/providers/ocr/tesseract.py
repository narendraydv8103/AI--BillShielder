from typing import Any
from backend.app.providers.base import (
    BaseOCRProvider,
    OCRExtractionResult,
    ProviderHealth,
)


class TesseractOCRProvider(BaseOCRProvider):
    """
    Open-source local Tesseract OCR Provider adapter.
    """

    def __init__(self, tesseract_cmd: str = ""):
        self.tesseract_cmd = tesseract_cmd

    async def extract_text(self, file_path_or_bytes: Any) -> OCRExtractionResult:
        raise NotImplementedError("Tesseract OCR engine integration is scheduled for Step 2.")

    async def health_check(self) -> ProviderHealth:
        return ProviderHealth(
            provider_name="tesseract_ocr",
            provider_type="ocr",
            is_ready=False,
            is_demo=False,
            details=f"Tesseract adapter loaded (configured path: '{self.tesseract_cmd or 'system default'}'). Full integration in Step 2.",
        )
