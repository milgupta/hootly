import type { QType } from "@/lib/types";

/**
 * Deterministic answer grading for the quiz/exam engines (docs/05 §7.4–7.5).
 *
 * MCQ + true/false are exact (normalized) matches. Free-text answers
 * (fill_blank, short_answer) normalize away casing, punctuation, smart quotes,
 * articles and extra whitespace; when that still doesn't match we return `null`
 * — "let the learner self-assess" — instead of silently marking a right answer
 * wrong. The correct answer is surfaced either way (brand rule: we never hide it).
 */

const ARTICLES = new Set(["a", "an", "the"]);

export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !ARTICLES.has(word))
    .join(" ");
}

/** true = correct · false = wrong · null = needs the learner's self-assessment. */
export function gradeAnswer(
  qtype: QType,
  given: string | null,
  canonical: string
): boolean | null {
  const answer = normalizeAnswer(given ?? "");
  const key = normalizeAnswer(canonical);
  if (answer.length === 0) return false;
  if (answer === key) return true;
  if (qtype === "mcq" || qtype === "true_false") return false;
  // The learner wrote the whole canonical answer inside a longer sentence.
  if (key.length > 0 && answer.includes(key)) return true;
  return null;
}

/** Options the learner picks from: MCQ ships its own; true/false is synthesized. */
export function optionsFor(qtype: QType, options: string[] | null): string[] | null {
  if (qtype === "mcq") return options && options.length > 0 ? options : null;
  if (qtype === "true_false") return ["True", "False"];
  return null;
}

export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"] as const;
