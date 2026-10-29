export type Severity = "Critical" | "High" | "Medium";

export interface Finding {
  item: string;
  billed: number;
  excess: number;
  severity: Severity;
}

export const fmtINR = (n: number) =>
  "₹" + n.toLocaleString("en-IN");

export const heroFindings: Finding[] = [
  { item: "ICU Bed & Nursing Charges", billed: 13000, excess: 13000, severity: "Critical" },
  { item: "Room Rent (Private Deluxe)", billed: 10000, excess: 10000, severity: "High" },
  { item: "Infusion Pump Surcharge", billed: 4800, excess: 4800, severity: "High" },
  { item: "PPE Kit – High Risk ICU Care", billed: 8000, excess: 8000, severity: "Medium" },
];

export const statsBand = [
  { value: "10", label: "executable audit checks" },
  { value: "37", label: "regulatory entries with dates" },
  { value: "100%", label: "of findings carry a citation" },
  { value: "0", label: "amounts computed by the AI" },
];

export const steps = [
  {
    title: "Upload",
    text: "PDF, PNG or JPG. Digital and scanned pages are told apart automatically.",
  },
  {
    title: "Extract",
    text: "Line items, lakh-style amounts and credits are read with page and position kept.",
  },
  {
    title: "Audit",
    text: "A deterministic rule engine checks maths, duplicates, caps and non-payables.",
  },
  {
    title: "Explain",
    text: "Each finding gets a citation, a plain explanation and a dispute-letter draft.",
  },
];

export const features = [
  {
    icon: "align-left",
    title: "Provenance-first extraction",
    text: "Raw text, bounding boxes and uncertainty flags sit beside every value.",
  },
  {
    icon: "scale",
    title: "Deterministic rule engine",
    text: "Same bill, same result. Arithmetic, duplicates, tariff caps and unbundling.",
  },
  {
    icon: "file-search",
    title: "Citations on every finding",
    text: "Each flag names its authority, so you know what to ask the billing desk.",
  },
  {
    icon: "message",
    title: "Ask the assistant",
    text: "Chat about any charge. Answers use only the findings, never new numbers.",
  },
  {
    icon: "file-text",
    title: "Dispute letter draft",
    text: "A neutral, printable letter listing the amounts and the rules behind them.",
  },
  {
    icon: "activity",
    title: "Works offline",
    text: "Mock providers let you demo the full flow without any API key.",
  },
] as const;

export interface SampleAuditRow {
  item: string;
  billed: number;
  benchmark: number;
  excess: number;
  rule: string;
  severity: Severity;
}

export const sampleAuditRows: SampleAuditRow[] = [
  { item: "ICU Bed & Nursing Charges", billed: 30000, benchmark: 17000, excess: 13000, rule: "ICU per-day cap", severity: "Critical" },
  { item: "Room Rent (Private Deluxe)", billed: 19000, benchmark: 9000, excess: 10000, rule: "Ward per-day cap", severity: "High" },
  { item: "Biomedical Waste Disposal Surcharge", billed: 3400, benchmark: 0, excess: 3400, rule: "Unbundled overhead", severity: "High" },
  { item: "Infusion Pump Surcharge", billed: 4800, benchmark: 0, excess: 4800, rule: "Unbundled overhead", severity: "High" },
  { item: "PPE Kit – High Risk ICU Care", billed: 14400, benchmark: 6400, excess: 8000, rule: "PPE price ceiling", severity: "Medium" },
];

export const dashboardFindings: Finding[] = [
  { item: "ICU Bed & Nursing", billed: 30000, excess: 13000, severity: "Critical" },
  { item: "Room Rent (Private Deluxe)", billed: 19000, excess: 10000, severity: "High" },
  { item: "Bio-waste Surcharge", billed: 3400, excess: 3400, severity: "High" },
  { item: "Infusion Pump Surcharge", billed: 4800, excess: 4800, severity: "High" },
  { item: "Admission File Fee", billed: 2500, excess: 2500, severity: "High" },
  { item: "PPE Kit – High Risk ICU", billed: 14400, excess: 8000, severity: "Medium" },
  { item: "Sterile Gloves (Pair)", billed: 4200, excess: 3300, severity: "Medium" },
];

export const dashboardTotals = {
  totalBilled: 101540,
  flagged: 45000,
  findings: 7,
  share: "44.3%",
  subtitle: "Apollo-style ICU bill · 10 line items · demo data",
};

/** Mock, offline assistant: answers come only from the flagged findings. */
export function assistantReply(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("pump") || q.includes("infusion")) {
    return "Pump use is part of ICU care and should not be billed as a separate overhead. ₹4,800 is flagged under the unbundling rule. You can ask the billing desk to justify it.";
  }
  if (q.includes("ppe")) {
    return "The PPE kit was billed at ₹14,400 against a review ceiling of ₹6,400, so ₹8,000 is flagged. Ask the billing desk for the per-unit rate and the quantity used.";
  }
  if (q.includes("icu") || q.includes("nursing") || q.includes("bed")) {
    return "ICU Bed & Nursing was billed at ₹30,000 against the per-day cap benchmark of ₹17,000, so ₹13,000 is flagged for review. Ask for the daily rate and the number of ICU days.";
  }
  if (q.includes("room")) {
    return "Room Rent (Private Deluxe) was billed at ₹19,000 against the ward per-day benchmark of ₹9,000, so ₹10,000 is flagged. Ask for the room tariff sheet.";
  }
  if (q.includes("waste") || q.includes("bio")) {
    return "Biomedical waste disposal is a hospital overhead and should be inside the facility charges. ₹3,400 is flagged as an unbundled overhead.";
  }
  if (q.includes("admission") || q.includes("file")) {
    return "The Admission File Fee of ₹2,500 is flagged as a non-payable administrative charge. Ask the billing desk to cite the authority for it.";
  }
  if (q.includes("glove")) {
    return "Sterile gloves were billed at ₹4,200 for the stay, above the review ceiling of ₹900, so ₹3,300 is flagged. Ask for the consumption register.";
  }
  return "I can explain the rule behind each flagged item. Ask about a charge such as the ICU bed, room rent, PPE kit or the infusion pump surcharge.";
}

/** Neutral dispute-letter draft, printable offline. */
export function disputeLetter(): string {
  const rows = dashboardFindings
    .map(
      (f) =>
        `- ${f.item}: billed ${fmtINR(f.billed)}, review excess ${fmtINR(f.excess)} (${f.severity})`
    )
    .join("\n");
  return `To: The Billing Desk / Hospital Administration

Subject: Request for clarification of charges on bill dated ___ (Total: ${fmtINR(
    dashboardTotals.totalBilled
  )})

I am reviewing the itemized bill enclosed above. The following items appear inconsistent with published tariffs and standard billing practice, and I request written justification for each:

${rows}

Total flagged for review: ${fmtINR(dashboardTotals.flagged)} (${dashboardTotals.share} of the bill).

I request that the amount in question be held pending clarification. Please share the tariff schedule, consumption registers and the regulatory basis for each charge. Benchmarks above are review thresholds, not claimed legal limits.

Sincerely,
___`;
}
