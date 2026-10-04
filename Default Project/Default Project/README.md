# India Hospital Bill Rules — Auditable Knowledge Base

A machine-readable rule database for auditing Indian hospital bills. Every rule is a
normalized operational rule traceable to a primary government or statutory source, with
effective dates, thresholds, and explicit verification state.

- **Database:** `india-hospital-bill-rules`
- **Schema version:** `1.0.0`
- **As of:** 2026-10-04
- **Scope:** GST treatment of hospital services, AB PM-JAY package and scheme limits,
  IRDAI health-insurance standardisation, plus engine-level arithmetic and evidence controls.

## Files

| File | Purpose |
| --- | --- |
| `rules.json` | The rule database. 37 normalized rules with thresholds, applicability, authority, effective dates, verbatim source text, and verification flags. Also carries `coverage_gaps`. |
| `documents.json` | The 17 distinct legal instruments referenced, each mapped to the rules that depend on it, with in-force / superseded status. |
| `sources.json` | The 18 official URLs cited, publisher, authority rank, and which rules cite each one. |
| `amendments.json` | Change log: supersessions and amending instruments, plus the date-evaluation contract. |
| `rule_examples.json` | 39 regression cases covering every rule, including threshold boundaries, carve-outs, date changes, and no-invention paths. |

## Evidence standard

This database accepts **only** primary legislation, statutory notifications, official
government circulars and orders, scheme guidelines, and IRDAI regulations.

Rejected: blogs, commercial rate cards, news articles, hospital or insurer websites,
aggregator sites, mirrors of notifications, and model prior knowledge.

**The no-invention rule.** If verbatim official text could not be retrieved, the gap is
recorded in `rules.json` → `coverage_gaps` and *no figure is encoded*. Unresolved
questions return `INSUFFICIENT_EVIDENCE` rather than a guess.

## Three distinctions the engine must never collapse

**1. Tax treatment is not a price cap.** The INR 5,000/day room-charge figure in
`GST-IN-HC-005` is a GST taxability trigger. A hospital is *not* prohibited from charging
more; charging more simply moves that room supply out of the exemption. Every rule carries
a `price_control` object with a mandatory `who_is_bound` field stating exactly who the rule
constrains — the hospital, the scheme payer, the insurer, or nobody.

**2. Scheme and insurance limits bind the payer, not the hospital.** PM-JAY package rates,
the INR 5 lakh family ceiling, and IRDAI List I–IV non-payables limit what the *payer*
reimburses. They are not automatically caps on what a hospital may charge a private patient.

**3. The hospital and the insurer are assessed independently on the same line.** One
inpatient "toilet charges" line can be correctly nil-GST (`GST-IN-HC-013`) *and* correctly
non-payable by the insurer (`INS-IRDAI-001`). Both findings are emitted; neither suppresses
the other. See `EX-GST-016`.

## Evaluation contract

Rules are **date-aware**. A rule applies when:

```
effective_from <= bill_date < effective_until
```

An empty `effective_until` means still in force. Identical clinical facts can produce
different tax outcomes on either side of an amendment date — `EX-GST-005` and `EX-GST-006`
are the same INR 9,000/day room charge one month apart, with opposite results.

## Output discipline

Findings are a ranked list of separate, attributable findings against named rules, never a
single blended "overcharge" number. See `EX-COMBO-001`.

Severity and wording are constrained by what the evidence supports:

- Arithmetic errors are checked first — they are law-independent and the lowest-false-positive class.
- A line is `POTENTIALLY DUPLICATED`, never `DUPLICATE`. Repetition whitelist runs first.
- Clinical flags may only be `POTENTIALLY_CLINICALLY_INCONSISTENT` or
  `REQUIRES_CLINICAL_REVIEW`, never `CONFIRMED_MEDICAL_ERROR`.
- Insurance deductions and exclusions target the **insurer's payable amount**, never a hospital overcharge.
- `PROHIBITED PATIENT CHARGE` under PM-JAY is a genuine hospital-side finding, but it is a
  contractual empanelment obligation, not a tariff statute.

Where a rate depends on legislation not encoded here, the field value is the literal string
`REFER_TO_RATE_NOTIFICATION_IN_FORCE_ON_INVOICE_DATE`. Resolve it at query time or return
`INSUFFICIENT_EVIDENCE`.

## Known coverage gaps

Read `rules.json` → `coverage_gaps` before relying on any area below. Nothing was invented to
fill these.

| Gap | Status | Effect on output |
| --- | --- | --- |
| CGHS rate list and room-rent entitlements | NOT_VERIFIED | No CGHS figure encoded. cghs.gov.in unreachable; MoHFW CGHS PDFs are image-only with no text layer and no OCR available. |
| ESIC medical-benefit rates | NOT_VERIFIED | No ESIC figure encoded. No official rate list located with extractable text. |
| MoHFW Standard Treatment Guidelines | NOT_VERIFIED | `ENG-EVID-001` permits only `REQUIRES_CLINICAL_REVIEW` / `POTENTIALLY_CLINICALLY_INCONSISTENT`. |
| GST rate for non-exempt room rent above INR 5,000/day | DELIBERATELY_PARAMETERISED | `GST-IN-HC-005` resolves at query time or returns `INSUFFICIENT_EVIDENCE`. |
| State-specific tariff ceilings | NOT_ATTEMPTED | Clinical Establishments Act 2010 is state-wise. Never assert a national legal cap on hospital charges. |

## Verification flags

Each rule carries a `verification` object (`source_verified`, `citation_verified`,
`effective_date_verified`, `current_status_verified`). Rule `status` is one of:

- `CURRENT` — in force
- `SUPERSEDED` — replaced, with `superseded_by` naming the successor rule
- `UNCERTAIN` — official sources conflict; the rule surfaces both readings rather than picking one
  (see `INS-IRDAI-010` on the PED look-back window)

The three `ENG-*` derived controls are marked `source_verified: false` by design — they are
arithmetic and process controls, not statements of law.

## Query order

1. `ENG-GST-ARITH-001`, `ENG-DUP-001` — arithmetic and duplication, before any legal check.
2. `GST-*` — taxability, date-aware.
3. `PKG-PMJAY-*` or `INS-IRDAI-*` — payability, chosen by payer type.
4. `ENG-EVID-001` — clinical review last, evidence-gated.

## Attribution

Rules rest on: CBIC and the GST Council (Notification 12/2017-CT(R), 07/2022-CT(R),
Circulars 2/12/2018, 32/06/2018 and 177/09/2022); the National Health Authority (HBP 2022
package guidelines, HBP rate master, and PM-JAY Operations Manual); and IRDAI (Master
Circular on Standardisation of Health Insurance Products, circulars 193/07/2020,
151/06/2020, the 2020 exclusion amendment, and the 2024 product circular).

Full URLs with per-rule attribution are in `sources.json`.