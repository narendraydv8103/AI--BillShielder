from typing import Any, Dict, Optional
from backend.app.providers.base import (
    BaseLLMProvider,
    ClassificationResult,
    ExplanationResult,
    ProviderHealth,
)


class GeminiLLMProvider(BaseLLMProvider):
    """
    Google Gemini API LLM Provider adapter.
    Strictly constrained to classification and explanation generation.
    """

    def __init__(self, api_key: str = "", model_name: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model_name = model_name

    async def classify_billing_item(
        self,
        raw_item_name: str,
        charge_amount: float,
        context: Optional[Dict[str, Any]] = None,
    ) -> ClassificationResult:
        raise NotImplementedError("Gemini LLM live API integration is scheduled for Step 2.")

    async def generate_finding_explanation(
        self,
        finding_data: Dict[str, Any],
        rule_citation: Dict[str, Any],
    ) -> ExplanationResult:
        raise NotImplementedError("Gemini LLM live API integration is scheduled for Step 2.")

    async def health_check(self) -> ProviderHealth:
        has_key = bool(self.api_key and not self.api_key.startswith("your_"))
        return ProviderHealth(
            provider_name="gemini_llm",
            provider_type="llm",
            is_ready=has_key,
            is_demo=False,
            details=f"Gemini adapter registered (model: {self.model_name}, api_key configured: {has_key})",
        )
