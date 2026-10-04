# Hospital Bill Auditor — AI-Powered Hospital Bill Fraud & Overcharging Detection Platform (India)

> **AI-Assisted Regulatory Hospital Bill Auditing & Dispute Dossier Generator for Indian Patients**  
> Evaluates medical bills against **37 codified statutory regulations** (IRDAI Master Circular, NPPA Drug Price Control Orders, GST Council Notifications, CGHS Tariffs, and State Clinical Establishments Acts).

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind%20CSS%20v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PyMuPDF](https://img.shields.io/badge/PDF-PyMuPDF-green.svg)](https://pymupdf.readthedocs.io)
[![Gemini](https://img.shields.io/badge/AI-Google%20GenAI%20SDK-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev/)
[![Tests](https://img.shields.io/badge/Tests-30%2F30%20Passing-brightgreen.svg)](#test-suite)
[![Demo Mode](https://img.shields.io/badge/Demo%20Mode-100%25%20Offline-blue.svg)](#instant-hackathon-demo-scenarios)

---

## 1. Product Overview & Key Differentiators

Indian hospital bills are notoriously complex, unbundled, and opaque. Patients often face duplicate diagnostic charges, illegal 18% GST on non-ICU beds, separate billing of nursing or monitoring when an all-inclusive ICU bed rate is charged, and arbitrary PPE or administrative surcharges.

**Hospital Bill Auditor** is an end-to-end healthcare fintech system designed for patient empowerment:

* **Transparent Math & Statutory Checks Instead of a Black-Box Fraud Score**: Every flag is backed by exact line-item arithmetic ($Qty \times Rate \ne Amount$, Subtotal Mismatch) or a specific official government circular.
* **Separated Audit Metrics**: Distinctly breaks down:
  1. *Verified Arithmetic Discrepancies* (provable mathematical errors)
  2. *Suspicious Surcharges & Unbundled Items* (ICU nursing unbundling, monitor fees)
  3. *Disallowed Non-Payable Items* (IRDAI List I non-payable consumables like gloves and hand rub)
  4. *Potential Review Amount* (items requiring clarification; never misleadingly claimed as "guaranteed legal savings").
* **Explainable AI Billing Assistant**: Integrates Google Gemini (`google-genai` SDK) when configured, and falls back to a deterministic, high-precision statutory reasoning engine when offline.
* **Patient Action Center & Dispute Dossier**: Generates formal, printable dispute letters addressed to hospital billing departments, formatted with patient UHID, bill invoice numbers, statutory citations, and negotiation checklists.
* **Ethical Safeguards**: Distinguishes calculation errors from potential unbundling. Never defames hospitals or doctors as "fraudulent".

---

## 2. Core Features Implemented

### 1. AI Bill Analyzer (Upload & Extraction)
* **Multi-format Ingestion**: Ingests hospital bills in **PDF**, **PNG**, and **JPG** format up to 25 MB.
* **PyMuPDF Coordinate Extraction**: Extracts line items, quantities, unit rates, taxes, and totals with exact bounding box provenance.
* **Safe Currency Parsing**: Handles Indian numbering (`1,00,000`), parenthesized discounts `(₹500)`, negative credits, and multi-currency markers.

### 2. Suspicious Charge & Unbundling Detection
* **Mathematical Reconciliation**: Detects line item multiplication errors and subtotal calculation discrepancies.
* **Duplicate Charge Detection**: Flags repeated billings of identical medical tests (e.g., multiple Serum Electrolyte tests billed on the same day).
* **ICU Unbundling Prohibitions**: Flags separate charges for ICU Nursing, Multi-para Monitor, Syringe Pump, or IV Cannulation when ICU bed charges are already billed.
* **IRDAI Master Circular Compliance**: Identifies List I non-payable items (PPE kits, examination gloves, sanitizers, thermometer charges) improperly shifted to patients.
* **GST Council Healthcare Exemption**: Enforces GST Notification 12/2017 & Circular 177/2022 (exempting healthcare diagnosis and non-ICU beds $\le ₹5,000$).

### 3. Explainable AI Agent (Chat)
* Provides conversational Q&A for any bill finding.
* Preset prompt chips for common Indian hospital billing questions.
* Shows exact legal authority (e.g., *CGHS/NHA Circular F.No. S.11011/11/2021-CGHS(P)*, *IRDAI/HLT/REG/CIR/193/07/2020*).

### 4. Bill Comparison Dashboard
* Financial summary cards: Original Billed, Permissible Benchmark, Arithmetic Discrepancies, Suspicious Charges, Potential Review Amount.
* Severity distribution charts (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
* Transparent calculation methodology disclosure.

### 5. Patient Action Center
* One-click generation of formal dispute letters for hospital Medical Superintendents or TPA desks.
* Copy-to-clipboard (Markdown) and Browser Print / PDF download.
* Patient escalation hierarchy (Hospital Grievance Cell $\rightarrow$ TPA $\rightarrow$ State Clinical Establishments Council $\rightarrow$ Consumer Forum / NCH 1915).

### 6. Instant Hackathon Demo Scenarios (Zero Setup Required)
Pre-configured with 3 realistic synthetic Indian hospital bills:
1. **Apollo Specialty Healthcare (ICU Unbundling & Surcharges)**: Total ₹1,01,540 with ₹45,000 in unbundled ICU nursing, arterial line maintenance, and PPE kit markups.
2. **Max Super Speciality (Duplicate Billing & Math Errors)**: Total ₹48,200 with duplicate diagnostic tests and line item calculation discrepancy ($15 \times 350 = 5,250$ billed as $6,500$).
3. **Fortis Memorial (Surgical Package & Illegal GST)**: Total ₹1,33,200 with unbundled OT consumable charges and illegal 18% GST on a non-ICU ward room under ₹5,000/day.

---

## 3. Technology Stack & Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │          Next.js 16 + React 19 + Tailwind v4           │
                    │   (Analyzer, Dashboard, Findings, Chat, Action Center) │
                    └───────────────────────────┬────────────────────────────┘
                                                │ REST JSON / Multipart
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               FastAPI (Python 3.12 Backend)            │
                    ├────────────────────────────────────────────────────────┤
                    │ • /api/v1/health          • /api/v1/audit/analyze-bill │
                    │ • /api/v1/audit/upload    • /api/v1/audit/chat         │
                    │ • /api/v1/audit/sample-bills • /api/v1/audit/dispute-letter │
                    └───────┬───────────────────┬────────────────────┬───────┘
                            │                   │                    │
              ┌─────────────▼──────┐   ┌────────▼──────────┐  ┌──────▼──────┐
              │ PyMuPDF Parser     │   │ Deterministic     │  │ AI Service  │
              │ • Table Detection  │   │ Rule Engine       │  │ • Gemini API│
              │ • Indian Currency  │   │ • 37 Gov Rules    │  │ • Statutory │
              │ • OCR Coordinator  │   │ • Math & Duplicates│ │   Fallback  │
              └────────────────────┘   └───────────────────┘  └─────────────┘
```

---

## 4. Quick Start & Running Locally

### Prerequisites
* **Python**: 3.11 or 3.12
* **Node.js**: 18+ (Node 20+ recommended)

### 1. Clone & Setup Backend
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

# (Optional) Add your Gemini API key in backend/.env for generative chat
# GEMINI_API_KEY="your-api-key-here"
# If omitted, the system automatically uses its built-in rule reasoning engine!

# Run backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Backend API will be live at `http://127.0.0.1:8000` (Swagger docs at `/docs`).

### 2. Setup Frontend
```bash
# In a new terminal:
cd frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
Frontend will be available at `http://localhost:3000`.

---

## 5. Running Tests

The test suite contains 30 comprehensive unit and integration tests covering PDF parsing, bounding box provenance, Indian currency parsing, arithmetic errors, duplicate detection, unbundling rules, sample bills, and AI chat.

```bash
# Run backend pytest suite
cd backend
.venv\Scripts\pytest.exe -v
```

Expected result:
```text
============================== 30 passed in 0.64s ==============================
```

---

## 6. Statutory Regulations Grounding

The platform's rule engine evaluates charges against 37 normalized rules stored in `Default Project/Default Project/rules.json`:
* **IRDAI Non-Payables**: *IRDAI/HLT/REG/CIR/193/07/2020* (Standardization of Exclusions and Non-Payable Items).
* **NPPA Drug & Device Caps**: *Drug Prices Control Order (DPCO) 2013* (Ceiling prices on Coronary Stents, Orthopaedic Implants, and Scheduled Formulations).
* **GST Council Exemptions**: *Notification No. 12/2017-Central Tax (Rate)* & *Circular 177/09/2022-TRU*.
* **CGHS & PM-JAY Package Rates**: *NHA/AB-PMJAY/HBP-2.2* & *CGHS Office Memorandum S.11011/11/2021*.
* **State Clinical Establishments**: Standards under the *Clinical Establishments (Registration and Regulation) Act, 2010* and state-specific nursing home acts.

---

## 7. Limitations & Future Roadmap

* **OCR Resolution**: Scanned bills with low resolution (< 150 DPI) or heavy skew may require preprocessing through an external high-accuracy vision API.
* **State Hospital Variations**: Hospital billing terminology varies significantly across states; while the rule engine supports fuzzy matching and standard classifications, regional colloquial names are continuously expanded.
* **Disclaimer**: This software is intended solely for consumer awareness and educational auditing. It does not constitute legal counsel or formal accusation of criminal malfeasance.
