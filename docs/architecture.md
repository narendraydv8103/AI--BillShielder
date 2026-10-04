# Hospital Bill Auditor (India) — Architecture Documentation

## 1. System Mission & Core Philosophy

Hospital Bill Auditor is an **AI-assisted regulatory compliance and auditing platform** engineered specifically for the Indian private and empaneled healthcare ecosystem.

### Core Architectural Invariants:
1. **The System is NOT a generic chatbot**: It is a structured audit processing system.
2. **The LLM is NOT the legal source of truth**: Statutory compliance is governed strictly by verified government gazette notifications, circulars, and tariff orders.
3. **Deterministic Rule Engine**: All numerical comparisons, rate caps, packaging rules, and excess calculations are computed via deterministic Python logic.
4. **LLM Isolation**: Generative AI (Google Gemini / OpenAI) is strictly confined to two tasks:
   - Normalizing unstandardized hospital billing nomenclature into standard medical taxonomy.
   - Translating technical statutory findings into patient-comprehensible language and formal dispute letters.
5. **Zero-Friction Demo Mode**: The platform functions 100% offline out-of-the-box using mock providers and synthetic Indian hospital billing data without requiring external paid API keys.

---

## 2. Separation of Concerns Matrix

| Layer | Directory | Primary Responsibility | Strict Prohibitions |
| :--- | :--- | :--- | :--- |
| **UI** | `/frontend` | Next.js + Tailwind UI presentation, user interactions, status display | **NO** business logic, **NO** direct DB calls |
| **API** | `/backend/app/api` | Request validation, HTTP routing, response serialization | **NO** SQL queries, **NO** business logic in routes |
| **Business Logic** | `/backend/app/services` | Pipeline orchestration, multi-stage workflow execution | Decoupled from HTTP framework |
| **Database Access** | `/backend/app/db`, `/database` | SQLAlchemy models, async sessions, Alembic migrations | All DB queries handled via repositories/sessions |
| **Rule Engine** | `/backend/app/rules` | Deterministic tariff checks, packaging limits, unbundling bans | **NO** LLM calls in calculation |
| **Document Processing**| `/backend/app/documents` | PyMuPDF (fitz) text and layout extraction, normalizer | Format conversion only |
| **AI Providers** | `/backend/app/providers` | Provider interfaces (OCR, LLM, Storage) + Mock & Live adapters | No vendor lock-in; swappable via factory |
| **Evidence Validation**| `/backend/app/evidence` | Verified legal grounding: links findings to circulars & gazettes | Every finding must have a statutory basis |

---

## 3. Technology Stack

- **Frontend**: Next.js 16 + TypeScript + React 19
- **Styling**: Tailwind CSS v4
- **Backend API**: Python 3.11+ / FastAPI
- **Database & ORM**: PostgreSQL (pgvector optional) + asyncpg / SQLAlchemy 2.0
- **Development Database**: SQLite via `aiosqlite` for zero-configuration local runs
- **Migrations**: Alembic
- **PDF Extraction**: PyMuPDF (`fitz`)
- **Containerization**: Docker Compose (`postgres`, `backend`, `frontend`)
