import pytest
from backend.app.core.config import Settings
from backend.app.providers.factory import (
    get_ocr_provider,
    get_llm_provider,
    get_storage_provider,
)
from backend.app.providers.ocr.mock import MockOCRProvider
from backend.app.providers.llm.mock import MockLLMProvider
from backend.app.providers.storage.local import LocalStorageProvider


@pytest.mark.asyncio
async def test_demo_providers_factory():
    cfg = Settings(DEMO_MODE=True, STORAGE_PROVIDER="local")
    ocr = get_ocr_provider(cfg)
    llm = get_llm_provider(cfg)
    storage = get_storage_provider(cfg)

    assert isinstance(ocr, MockOCRProvider)
    assert isinstance(llm, MockLLMProvider)
    assert isinstance(storage, LocalStorageProvider)

    # Verify OCR mock extraction
    ocr_result = await ocr.extract_text(b"fake_content")
    assert len(ocr_result.lines) > 0
    assert "Apollo" in ocr_result.raw_text

    # Verify LLM mock explanation
    explanation = await llm.generate_finding_explanation(
        finding_data={"item_name": "ICU Bed", "excess_amount": 13000.0},
        rule_citation={"title": "CGHS ICU Cap", "order_number": "F.No. S.11011"},
    )
    assert "13,000.00" in explanation.patient_summary
    assert "CGHS ICU Cap" in explanation.patient_summary

    # Verify Storage health
    health = await storage.health_check()
    assert health.is_ready is True
