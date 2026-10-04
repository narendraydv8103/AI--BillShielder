# Audit Execution Pipeline

The Hospital Bill Auditor operates an 8-stage pipeline ensuring high accuracy, auditability, and legal grounding:

```
[ Upload PDF / Image ]
          ↓
[ Document Processing ] (PyMuPDF layout block detection)
          ↓
[ OCR Provider ] (Mock / Tesseract / Google Document AI)
          ↓
[ Bill Extraction ] (Regex / structured key-value & table parsing)
          ↓
[ Normalized Bill Data ] (Pydantic NormalizedBill schema)
          ↓
[ Deterministic Audit Engine ] (Strict mathematical evaluation)
          ↓
[ Rule Engine ] (CGHS, PMJAY, NPPA, State CEA circulars)
          ↓
[ Evidence Validation ] (Statutory gazette & order verification)
          ↓
[ AI Explanation Layer ] (LLM generates patient-friendly summary & dispute letter)
          ↓
[ Actionable Audit Report ] (Comprehensive findings & potential savings)
```

### Stage Details

1. **Document Processing (`/backend/app/documents`)**:
   PyMuPDF parses incoming PDF streams, extracts embedded text objects, identifies table bounding boxes, and detects scanned image pages.

2. **OCR (`/backend/app/providers/ocr`)**:
   For scanned documents or image invoices, the active OCR provider extracts line items with coordinate bounds.

3. **Bill Extraction & Normalization (`/backend/app/schemas/bill.py`)**:
   Raw text lines are converted into standard `BillItem` objects containing: description, category, unit rate, quantity, billed amount, and date.

4. **Deterministic Audit Engine (`/backend/app/rules/engine.py`)**:
   Applies mathematical calculations:
   $$\text{Excess} = \max(0, \text{Billed Rate} - \text{Permissible Cap}) \times \text{Quantity}$$
   Flags prohibited unbundled items (e.g. charging separately for PPE, biomedical waste, or admission fees).

5. **Rule Engine & Repository (`/rules`)**:
   Matches bill items against verified rules stored in structured JSON schemas with authority, circular number, and effective date.

6. **Evidence Validation (`/backend/app/evidence/validator.py`)**:
   Ensures that every discrepancy links to a recognized statutory citation.

7. **AI Explanation (`/backend/app/providers/llm`)**:
   The LLM is prompted strictly to explain *why* the item was flagged and recommend dispute steps in simple language.

8. **Audit Report**:
   Produces the final dossier itemizing total billed amount, total permissible amount, and net savings.
