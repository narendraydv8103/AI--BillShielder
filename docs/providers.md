# Provider Abstraction Model & Extension Guide

The Hospital Bill Auditor isolates external dependencies using **Provider Abstractions** located in `backend/app/providers/`.

## 1. OCR Provider (`backend/app/providers/base.py`)

All OCR implementations inherit from `BaseOCRProvider`:

```python
class BaseOCRProvider(ABC):
    @abstractmethod
    async def extract_text(self, file_path_or_bytes: Any) -> OCRExtractionResult:
        pass

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        pass
```

### Implementing a New OCR Provider:
1. Create a class inheriting from `BaseOCRProvider` in `backend/app/providers/ocr/`.
2. Register the provider in `backend/app/providers/factory.py`.
3. Add the provider key to `Settings.OCR_PROVIDER` in `backend/app/core/config.py`.

---

## 2. LLM Provider (`backend/app/providers/base.py`)

All LLM implementations inherit from `BaseLLMProvider`:

```python
class BaseLLMProvider(ABC):
    @abstractmethod
    async def classify_billing_item(
        self,
        raw_item_name: str,
        charge_amount: float,
        context: Optional[Dict[str, Any]] = None,
    ) -> ClassificationResult:
        pass

    @abstractmethod
    async def generate_finding_explanation(
        self,
        finding_data: Dict[str, Any],
        rule_citation: Dict[str, Any],
    ) -> ExplanationResult:
        pass

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        pass
```

> [!IMPORTANT]
> Never implement rule calculations or tariff limits inside an LLM provider. The LLM is strictly used for classification and explanation.

---

## 3. Storage Provider (`backend/app/providers/base.py`)

All storage implementations inherit from `BaseStorageProvider`:

```python
class BaseStorageProvider(ABC):
    @abstractmethod
    async def save_file(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str = "application/pdf",
    ) -> StoredFileInfo:
        pass

    @abstractmethod
    async def get_file_bytes(self, storage_path: str) -> bytes:
        pass

    @abstractmethod
    async def delete_file(self, storage_path: str) -> bool:
        pass

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        pass
```
