/**
 * Pricing constants — docs/02 §10 and docs/07 §1.1 (Stripe catalog).
 * These are the only prices that may appear anywhere on the marketing surface.
 */
export const PRICE = {
  monthlyPerMonth: "12.99",
  annualPerMonth: "6.99",
  annualTotal: "83.88",
  /** 12 × $12.99 — the honest comparison number behind the "Save 46%" badge. */
  monthlyYearlyTotal: "155.88",
  annualSavings: "72.00",
  savePct: 46,
} as const;

export type Interval = "monthly" | "annual";

/** Free-plan limits, published verbatim (docs/05 §2) with the doc 04 §5 semantics. */
export const FREE_BULLETS: ReadonlyArray<{ label: string; note: string }> = [
  { label: "1 active course", note: "Delete a course and the slot frees up." },
  { label: "3 file uploads", note: "Lifetime total, not monthly." },
  {
    label: "50 AI flashcards",
    note: "Lifetime total. Cards you write yourself are always free.",
  },
  { label: "2 AI quizzes", note: "Lifetime total. Practice exams count here too." },
  { label: "20 tutor messages/mo", note: "Resets on the 1st of each month." },
  { label: "audio up to 30 min", note: "Per audio or video file." },
];

/** Plus feature line, docs/05 §2 verbatim. */
export const PLUS_BULLETS: ReadonlyArray<string> = [
  "Everything unlimited",
  "Lecture recording",
  "Audio recaps",
  "PDF export",
  "Priority processing",
];
