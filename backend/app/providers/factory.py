import logging
from backend.app.core.config import Settings, settings
from backend.app.providers.base import BaseOCRProvider, BaseLLMProvider, BaseStorageProvider
from backend.app.providers.ocr.mock import MockOCRProvider
from backend.app.providers.ocr.tesseract import TesseractOCRProvider
from backend.app.providers.ocr.google_doc_ai import GoogleDocumentAIProvider
from backend.app.providers.llm.mock import MockLLMProvider
from backend.app.providers.llm.gemini import GeminiLLMProvider
from backend.app.providers.llm.openai import OpenAILLMProvider
from backend.app.providers.storage.local import LocalStorageProvider
from backend.app.providers.storage.s3 import S3StorageProvider

logger = logging.getLogger(__name__)


def get_storage_provider(cfg: Settings = settings) -> BaseStorageProvider:
    """Return active storage provider based on configuration."""
    if cfg.STORAGE_PROVIDER == "s3" and not cfg.DEMO_MODE:
        return S3StorageProvider(bucket_name=cfg.S3_BUCKET_NAME, region=cfg.S3_REGION)
    return LocalStorageProvider(base_directory=cfg.LOCAL_STORAGE_DIR)


def get_ocr_provider(cfg: Settings = settings) -> BaseOCRProvider:
    """Return active OCR provider based on configuration."""
    if cfg.DEMO_MODE or cfg.OCR_PROVIDER == "mock":
        return MockOCRProvider()

    if cfg.OCR_PROVIDER == "tesseract":
        return TesseractOCRProvider(tesseract_cmd=cfg.TESSERACT_CMD)
    elif cfg.OCR_PROVIDER == "google_document_ai":
        return GoogleDocumentAIProvider(credentials_path=cfg.GOOGLE_APPLICATION_CREDENTIALS)

    logger.warning(f"Unrecognized OCR provider '{cfg.OCR_PROVIDER}'. Defaulting to MockOCRProvider.")
    return MockOCRProvider()


def get_llm_provider(cfg: Settings = settings) -> BaseLLMProvider:
    """Return active LLM provider based on configuration."""
    if cfg.DEMO_MODE or cfg.LLM_PROVIDER == "mock":
        return MockLLMProvider()

    if cfg.LLM_PROVIDER == "gemini":
        return GeminiLLMProvider(api_key=cfg.GEMINI_API_KEY, model_name=cfg.LLM_MODEL)
    elif cfg.LLM_PROVIDER == "openai":
        return OpenAILLMProvider(api_key=cfg.OPENAI_API_KEY, model_name=cfg.LLM_MODEL)

    logger.warning(f"Unrecognized LLM provider '{cfg.LLM_PROVIDER}'. Defaulting to MockLLMProvider.")
    return MockLLMProvider()
