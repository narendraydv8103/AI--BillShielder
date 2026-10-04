# Running in Demo Mode

The Hospital Bill Auditor includes a fully functional **Demo Mode** designed to allow developers, stakeholders, and auditors to evaluate the platform offline without external API keys or cloud dependencies.

## Key Demo Mode Features

1. **Zero External API Keys**:
   - `DEMO_MODE=true` is set by default in `.env.example` and `.env`.
   - Uses `MockOCRProvider` providing synthetic Indian hospital bills.
   - Uses `MockLLMProvider` delivering deterministic explanations and classifications.
   - Uses `LocalStorageProvider` for filesystem-backed document storage in `./documents/uploads`.
2. **Zero-Configuration Database**:
   - In demo mode, SQLite (`aiosqlite`) is enabled as the default database fallback, requiring zero setup or Docker containers.
   - PostgreSQL can be used if desired by simply setting `DATABASE_URL`.
3. **One-Click Demo Audit Execution**:
   - The frontend includes a dedicated **Run Demo Bill Audit** button.
   - It runs the complete 8-stage pipeline against a synthetic Apollo Healthcare bill and displays evidence-backed findings and calculated savings.

## Enabling Live Providers

To transition from Demo Mode to production/live providers in Step 2:

```env
DEMO_MODE=false
OCR_PROVIDER=google_document_ai  # or "tesseract"
LLM_PROVIDER=gemini              # or "openai"
GEMINI_API_KEY=your_gemini_api_key_here
STORAGE_PROVIDER=s3              # or "local"
```
