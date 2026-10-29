# Hospital Bill Auditor — AI-Powered Healthcare Bill Discrepancy Detection Platform (India)

> **AI-Assisted Regulatory Healthcare Bill Auditing & Dispute Dossier Generator for Indian Patients**  
> Evaluates medical bills using **10 deterministic audit checks** grounded in **37 catalogued regulatory references** (IRDAI Master Circular, NPPA Drug Price Control Orders, GST Council Notifications, CGHS Tariffs, and State Clinical Establishments Directives).

[![Backend: FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Frontend: TanStack Start](https://img.shields.io/badge/Frontend-TanStack%20Start%20%2B%20React%2019-2563EB.svg?logo=react&logoColor=white)](https://tanstack.com/start)
[![Bundler: Vite](https://img.shields.io/badge/Bundler-Vite%208-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![UI: Tailwind CSS v4](https://img.shields.io/badge/UI-Tailwind%20CSS%20v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Engine: Deterministic](https://img.shields.io/badge/Rule%20Engine-100%25%20Deterministic-emerald.svg)](#statutory-regulations-grounding)
[![Backend Tests](https://img.shields.io/badge/Backend%20Tests-31%2F31%20Passing-brightgreen.svg)](#running-tests)
[![Frontend Tests](https://img.shields.io/badge/Frontend%20Tests-13%2F13%20Passing-brightgreen.svg)](#running-tests)

---

## 1. Product Overview & Key Differentiators

Indian hospital bills are notoriously complex, unbundled, and difficult for patients to audit. Patients frequently encounter duplicate diagnostic charges, improper 18% GST on exempt healthcare accommodation, separate billing of nursing or infusion pumps when an all-inclusive ICU bed rate is charged, and arbitrary PPE or administrative surcharges.

**Hospital Bill Auditor** is an end-to-end healthcare fintech system designed for patient transparency:

* **Deterministic Rule Engine Instead of Black-Box Guesswork**: Every flag is verified by exact line-item arithmetic ($Qty \times Rate \ne Amount$, Subtotal Mismatch) or a primary official regulatory reference.
* **Separated Audit Categories**:
  1. *Verified Arithmetic Discrepancies* (provable mathematical errors)
  2. *Suspicious Surcharges & Unbundled Items* (ICU nursing unbundling, monitor fees, bio-waste)
  3. *Disallowed Non-Payable Items* (IRDAI List I non-payable consumables like admission kits and file fees)
  4. *Benchmark Discrepancies* (charges exceeding notified ceiling rates like CGHS daily bed caps or NPPA consumable orders).
* **Provenance-First Integrity**: Real uploads are analyzed by the genuine backend and never fall back to synthetic demo reports. Synthetic demo data is strictly confined to an explicit, clearly labeled Quick Demo.
* **Explainable AI Billing Assistant**: Integrates Google Gemini (`google-genai` SDK) when configured, and falls back to a deterministic, high-precision regulatory reasoning engine when offline.
* **Patient Action Center & Printable Dispute Letter**: Generates neutral, evidence-grounded dispute letters formatted with patient UHID, bill invoice numbers, reference benchmark citations, and itemized clarifications.
* **Ethical Consumer Standards**: Distinguishes calculation errors from potential unbundling. Never defames hospitals or doctors as "fraudulent".

---

## 2. Core Features Implemented

### 1. Document Extraction Pipeline
* **Multi-Format Ingestion**: Ingests hospital bills in **PDF**, **PNG**, and **JPG** format up to 25 MB.
* **PyMuPDF Coordinate Extraction**: Extracts line items, quantities, unit rates, taxes, and totals with exact bounding box provenance.
* **Safe Currency Parsing**: Handles Indian numbering (`1,00,000`), parenthesized discounts `(₹500)`, negative credits, and multi-currency markers.

### 2. 10 Executable Audit Checks
1. **Line-Item Arithmetic Verification**: Confirms $Quantity \times Rate = Total$ for every row.
2. **Subtotal & Summary Reconciliation**: Checks that item sum equals declared invoice subtotal.
3. **Duplicate Service Entry Detection**: Flags multiple occurrences of identical diagnostics on the same date.
4. **ICU Daily Tariff Benchmark**: Compares ICU bed charges against notified CGHS/State intensive care ceilings.
5. **Private Ward Accommodation Ceiling**: Flags room rents exceeding notified private deluxe benchmarks.
6. **Biomedical Waste Disposal Unbundling**: Flags separate line items for waste disposal mandated to be facility overhead.
7. **Equipment Rental Unbundling**: Flags separate infusion pump, monitor, or oximeter charges during ICU care.
8. **Administrative & Admission File Fees**: Identifies administrative charges classified as non-payable overhead by IRDAI.
9. **Consumable Price Monitoring**: Checks PPE kits and surgical gloves against NPPA price monitoring benchmarks.
10. **GST Healthcare Exemption Verification**: Identifies inappropriate GST charges levied on clinical healthcare services exempt under CBIC Notification 12/2017.

### 3. Pre-Configured Demonstration Scenarios
1. **Apollo Specialty Healthcare (ICU Unbundling & Surcharges)**: Total ₹1,01,540 with ₹45,000 in unbundled ICU charges, bio-waste, and PPE kit variances across 7 findings.
2. **Max Super Speciality (Duplicate Billing & Math Errors)**: Total ₹48,200 with duplicate diagnostic tests and verified line-item calculation discrepancy.
3. **Fortis Memorial (Surgical Package & GST Exemption Review)**: Total ₹1,33,200 with unbundled OT consumable charges and improper GST on healthcare inpatient services.

---

## 3. Technology Stack & Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │      TanStack Start (React 19 + Vite + Nitro)          │
                    │   (Analyzer, Dashboard, Findings, Chat, Action Center) │
                    └───────────────────────────┬────────────────────────────┘
                                                │ REST JSON / Multipart
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               FastAPI (Python 3.12 Backend)            │
                    ├────────────────────────────────────────────────────────┤
                    │ • GET  /api/v1/health                                  │
                    │ • GET  /api/v1/audit/sample-bills                      │
                    │ • GET  /api/v1/audit/sample-bills/{id}                 │
                    │ • GET  /api/v1/audit/statutory-rules                   │
                    │ • POST /api/v1/audit/upload                            │
                    │ • POST /api/v1/audit/analyze-bill                      │
                    │ • POST /api/v1/audit/demo                              │
                    │ • POST /api/v1/audit/chat                              │
                    │ • POST /api/v1/audit/dispute-letter                    │
                    └───────┬───────────────────┬────────────────────┬───────┘
                            │                   │                    │
              ┌─────────────▼──────┐   ┌────────▼──────────┐  ┌──────▼──────┐
              │ PyMuPDF Parser     │   │ Deterministic     │  │ AI Service  │
              │ • Table Detection  │   │ Rule Engine       │  │ • Gemini API│
              │ • Indian Currency  │   │ • 10 Active Checks│  │ • Neutral   │
              │ • OCR Coordinator  │   │ • 37 Rules Base   │  │   Assistant │
              └────────────────────┘   └───────────────────┘  └─────────────┘
```

---

## 4. API Endpoints Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` / `/api/v1/health` | System health check (database, OCR provider, LLM provider). |
| `GET` | `/api/v1/audit/sample-bills` | Returns catalog of 3 realistic synthetic hospital bills. |
| `GET` | `/api/v1/audit/sample-bills/{id}` | Returns normalized bill structure for selected sample case. |
| `GET` | `/api/v1/audit/statutory-rules` | Returns all 37 catalogued regulatory rules with citations and authority. |
| `POST` | `/api/v1/audit/upload` | Multipart upload for bill PDF/images with size & mime validation. |
| `POST` | `/api/v1/audit/analyze-bill` | Runs deterministic rule engine on a `NormalizedBill` JSON payload. |
| `POST` | `/api/v1/audit/demo` | Executes audit on synthetic demo bill (7 findings, ₹45,000 under review). |
| `POST` | `/api/v1/audit/chat` | AI Patient Advocate conversational query grounded in findings. |
| `POST` | `/api/v1/audit/dispute-letter` | Generates neutral, printable Markdown and HTML clarification letters. |

---

## 5. Quick Start & Running Locally

### Prerequisites
* **Python**: 3.11, 3.12, or 3.14
* **Node.js**: 20+

### 1. Setup Backend
```bash
# Navigate to backend
cd backend

# Create virtual environment and activate
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
Backend API will be live at `http://127.0.0.1:8000` (Interactive OpenAPI Swagger at `http://127.0.0.1:8000/docs`).

### 2. Setup Frontend
```bash
# In a new terminal:
cd frontend

# Install dependencies
npm install

# Start Vite / TanStack Start development server
npm run dev
```
Frontend will be available at `http://localhost:3000`.

---

## 6. Running Tests

### Backend Test Suite (PyTest)
The backend test suite contains **31 comprehensive tests** covering PDF parsing, bounding box provenance, Indian currency parsing, arithmetic errors, duplicate detection, unbundling rules, sample bills, health probes, and full 7-step API workflow execution:

```bash
# From repository root
.\backend\.venv\Scripts\pytest.exe tests/ -v
```

Expected result:
```text
======================== 31 passed in 1.89s ========================
```

### Frontend Test Suite (Vitest)
The frontend test suite contains **13 unit & integration tests** covering API integrity, file validation, failure modes (no fake fallbacks), quick demo labeling, dispute letter tone, and data integrity:

```bash
cd frontend
npm test
```

Expected result:
```text
Test Files  3 passed (3)
     Tests  13 passed (13)
```

---

## 7. Regulatory Grounding & Benchmark Scope

The platform's rule engine evaluates charges against 37 normalized rules stored in `Default Project/Default Project/rules.json`:
* **IRDAI Non-Payables**: *IRDAI/HLT/REG/CIR/193/07/2020* (List I Non-Payable Expenses).
* **NPPA Drug & Device Caps**: *Drug Prices Control Order (DPCO) 2013* and pricing orders on PPE kits (*S.O. 1492(E)*).
* **GST Council Exemptions**: *Notification No. 12/2017-Central Tax (Rate)* Sl. No. 74 Heading 9993.
* **CGHS & PM-JAY Package Rates**: *CGHS Office Memorandum S.11011/11/2021* (Published reference tariff schedules).
* **State Clinical Establishments**: Standards under the *Clinical Establishments (Registration and Regulation) Act, 2010* and state-specific directives on overhead unbundling.

---

## 8. Consumer & Legal Disclaimer

* **Consumer Awareness Tool**: This software is intended solely for consumer awareness, billing transparency, and educational assistance. It helps patients formulate itemized inquiries for hospital billing desks.
* **Reference Benchmarks**: Rate caps cited (e.g., CGHS tariffs) serve as published reference standards; their direct legal applicability depends on hospital empanelment status, local state notifications, and patient agreements.
* **No Legal Advice**: Audit reports and generated clarification letters do not constitute formal legal counsel or binding judicial determinations.
