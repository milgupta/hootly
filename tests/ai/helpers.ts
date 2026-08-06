import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chunkBlocks,
  buildChunkContext,
  resolveCitations,
  type RetrievedChunk,
  type ChunkContext,
} from "@/lib/ai/rag";
import { extractChunkMarkers } from "@/lib/ai/chunk-markers";
import { fillBlankLeaks } from "@/lib/ai/groundedness";
import {
  notesOutlineSchema,
  noteSectionSchema,
  cardsSchema,
  quizSchema,
  planSchema,
  groundednessSchema,
  answerKeySchema,
  type NotesOutline,
  type NoteSectionOut,
  type CardsOut,
  type QuizOut,
  type PlanOut,
  type GroundednessOut,
  type AnswerKeyOut,
} from "@/lib/ai/schemas";

/** Shared machinery for the docs/06 §8 eval harness.
 *
 *  The golden set is deterministic end to end: the fixture .txt files are chunked
 *  by the REAL rag.ts chunker, and each chunk is given a stable uuid derived from
 *  its index so the recorded model outputs can cite `[chunk:{prefix}]` markers that
 *  actually resolve. Nothing here touches the network. */

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = path.join(HERE, "fixtures");

export const FIXTURE_IDS = [
  "biology_cell_structure",
  "us_history_declaration",
  "calculus_limits_derivatives",
] as const;
export type FixtureId = (typeof FIXTURE_IDS)[number];

export interface ExpectedProperties {
  id: string;
  source: string;
  course: string;
  subject: string;
  study_level: string;
  familiarity: string;
  chunk_id_prefix: string;
  min_chunks: number;
  must_appear_topics: string[];
  must_not_appear_claims: string[];
  must_not_appear_patterns: string[];
  thresholds: {
    schema_validity: number;
    citation_coverage: number;
    answer_key_pass_rate: number;
    fill_blank_leaks: number;
    min_note_sections: number;
    min_cards: number;
    min_questions: number;
  };
}

export interface RecordedOutput {
  notes_outline: NotesOutline;
  note_sections: NoteSectionOut[];
  cards: CardsOut;
  quiz: QuizOut;
  plan: PlanOut;
  groundedness: GroundednessOut[];
  answer_key_verdicts: AnswerKeyOut[];
}

export interface Fixture {
  id: FixtureId;
  expected: ExpectedProperties;
  text: string;
  chunks: RetrievedChunk[];
  context: ChunkContext;
}

/** Deterministic, valid-looking uuid whose first 8 hex chars are the prompt-facing
 *  prefix (`b10c0003`), matching the chunk-ID contract in docs/06 §1. */
export function deterministicChunkId(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(4, "0")}-1111-4222-8333-444455556666`;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function loadExpected(id: FixtureId): ExpectedProperties {
  return readJson<ExpectedProperties>(path.join(FIXTURES_DIR, `${id}.expected.json`));
}

/** Build the fixture's chunks + prompt context using the real pipeline. */
export function loadFixture(id: FixtureId): Fixture {
  const expected = loadExpected(id);
  const text = readFileSync(path.join(FIXTURES_DIR, expected.source), "utf8");
  const prepared = chunkBlocks([{ text, page: 1 }]);
  const chunks: RetrievedChunk[] = prepared.map((c) => ({
    id: deterministicChunkId(expected.chunk_id_prefix, c.idx),
    material_id: `material-${id}`,
    content: c.content,
    page: c.page,
    start_seconds: c.start_seconds,
    end_seconds: c.end_seconds,
    similarity: 0.8,
    material_title: expected.course,
  }));
  // 12k budget = the notes-outline budget from docs/06 §1.
  return { id, expected, text, chunks, context: buildChunkContext(chunks, 12_000) };
}

export function loadRecorded(id: FixtureId): RecordedOutput {
  return readJson<RecordedOutput>(
    path.join(FIXTURES_DIR, "recorded", `${id}.model-output.json`)
  );
}

export interface RedTeamPrompt {
  id: string;
  category?: string;
  prompt: string;
  expected: "STUDY" | "INTEGRITY" | "OFFTOPIC";
  expect_prefilter: boolean;
  recorded_classifier_reply: string;
}

export interface RedTeamSet {
  course_terms: string[];
  top_course_topic: string;
  red_team: RedTeamPrompt[];
  controls: RedTeamPrompt[];
}

export function loadRedTeam(): RedTeamSet {
  return readJson<RedTeamSet>(path.join(FIXTURES_DIR, "redteam.json"));
}

// ---------------------------------------------------------------------------
// Check 1 — schema validity
// ---------------------------------------------------------------------------

export interface SchemaCheck {
  total: number;
  valid: number;
  pct: number;
  failures: string[];
}

/** Validate every artifact in a recorded/live output against its zod schema. */
export function schemaValidity(out: RecordedOutput): SchemaCheck {
  const cases: Array<[string, { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, unknown]> = [
    ["notes_outline", notesOutlineSchema, out.notes_outline],
    ["cards", cardsSchema, out.cards],
    ["quiz", quizSchema, out.quiz],
    ["plan", planSchema, out.plan],
  ];
  out.note_sections.forEach((s, i) => cases.push([`note_sections[${i}]`, noteSectionSchema, s]));
  out.groundedness.forEach((g, i) => cases.push([`groundedness[${i}]`, groundednessSchema, g]));
  out.answer_key_verdicts.forEach((v, i) => cases.push([`answer_key[${i}]`, answerKeySchema, v]));

  const failures: string[] = [];
  for (const [name, schema, value] of cases) {
    if (!schema.safeParse(value).success) failures.push(name);
  }
  return {
    total: cases.length,
    valid: cases.length - failures.length,
    pct: cases.length === 0 ? 0 : (cases.length - failures.length) / cases.length,
    failures,
  };
}

// ---------------------------------------------------------------------------
// Check 2 — citation coverage
// ---------------------------------------------------------------------------

/** Claim-bearing sentences of a note section: prose only — headings, tables and
 *  the "> Not in your materials" footer are not factual claims about the source. */
export function claimSentences(bodyMd: string): string[] {
  const prose = bodyMd
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("#")) return false;
      if (t.startsWith(">")) return false;
      if (t.startsWith("|")) return false;
      return true;
    })
    .join(" ");
  return prose
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

export interface CitationCheck {
  total: number;
  cited: number;
  pct: number;
  uncited: string[];
  unresolvable: string[];
}

/** docs/06 §8 check 2: ≥95% of note sentences carry a RESOLVABLE chunk id. */
export function citationCoverage(
  sections: NoteSectionOut[],
  prefixToUuid: Map<string, string>
): CitationCheck {
  let total = 0;
  let cited = 0;
  const uncited: string[] = [];
  const unresolvable: string[] = [];
  for (const section of sections) {
    for (const sentence of claimSentences(section.body_md)) {
      total++;
      const markers = extractChunkMarkers(sentence);
      if (markers.length === 0) {
        uncited.push(sentence);
        continue;
      }
      const resolved = resolveCitations(markers, prefixToUuid);
      if (resolved.length === 0) {
        unresolvable.push(sentence);
        continue;
      }
      cited++;
    }
  }
  return { total, cited, pct: total === 0 ? 0 : cited / total, uncited, unresolvable };
}

// ---------------------------------------------------------------------------
// Checks 3 + 5 — answer-key verification and fill-blank leaks
// ---------------------------------------------------------------------------

export type QuizQuestionOut = QuizOut["questions"][number];

/** Deterministic well-formedness rules from docs/06 §4.3 + §6(b). These are
 *  computed locally — they do not depend on any model verdict. */
export function questionIssues(
  question: QuizQuestionOut,
  prefixToUuid: Map<string, string>
): string[] {
  const issues: string[] = [];
  const options = question.options ?? null;

  if (question.qtype === "mcq") {
    if (!options) issues.push("mcq_without_options");
    else {
      if (options.length !== 4) issues.push("mcq_option_count");
      if (new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length) {
        issues.push("mcq_duplicate_options");
      }
      const matches = options.filter((o) => o.trim() === question.answer.trim()).length;
      if (matches !== 1) issues.push("mcq_answer_not_uniquely_in_options");
      if (options.some((o) => /\b(all|none) of the above\b/i.test(o))) {
        issues.push("mcq_all_or_none_of_the_above");
      }
    }
  }

  if (question.qtype === "true_false") {
    if (!/^(true|false)$/i.test(question.answer.trim())) issues.push("true_false_answer_not_boolean");
  }

  if (question.qtype === "fill_blank") {
    if (!/_{2,}|\.\.\./.test(question.prompt)) issues.push("fill_blank_no_blank_marker");
    // docs/06 §4.3 + §8 check 5 — the known TurboLearn failure.
    if (fillBlankLeaks(question.prompt, question.answer)) issues.push("fill_blank_answer_leaked");
  }

  if (question.qtype === "short_answer" && question.answer.trim().length < 3) {
    issues.push("short_answer_too_vague");
  }

  // Every question must cite, and every citation must resolve (docs/06 §2 rule 4).
  if (question.source_chunk_ids.length === 0) issues.push("no_source_chunk_ids");
  else if (resolveCitations(question.source_chunk_ids, prefixToUuid).length === 0) {
    issues.push("source_chunk_ids_unresolvable");
  }
  const explanationMarkers = extractChunkMarkers(question.explanation);
  if (explanationMarkers.length === 0) issues.push("explanation_without_citation");
  else if (resolveCitations(explanationMarkers, prefixToUuid).length === 0) {
    issues.push("explanation_citation_unresolvable");
  }

  return issues;
}

export interface AnswerKeyCheck {
  total: number;
  passed: number;
  pct: number;
  failures: Array<{ idx: number; prompt: string; issues: string[]; reason?: string }>;
  leaks: Array<{ idx: number; prompt: string; answer: string }>;
}

/** docs/06 §8 checks 3 + 5. A question passes on the first try only when the local
 *  well-formedness rules AND the model's three verification flags all hold. */
export function verifyQuiz(
  quiz: QuizOut,
  verdicts: AnswerKeyOut[],
  prefixToUuid: Map<string, string>
): AnswerKeyCheck {
  const failures: AnswerKeyCheck["failures"] = [];
  const leaks: AnswerKeyCheck["leaks"] = [];
  let passed = 0;

  quiz.questions.forEach((question, idx) => {
    const issues = questionIssues(question, prefixToUuid);
    if (issues.includes("fill_blank_answer_leaked")) {
      leaks.push({ idx, prompt: question.prompt, answer: question.answer });
    }
    const verdict = verdicts[idx];
    const verdictOk = verdict
      ? verdict.correct && verdict.well_formed && verdict.explanation_ok
      : false;
    if (!verdict) issues.push("no_verification_verdict");
    else {
      if (!verdict.correct) issues.push("model_says_answer_incorrect");
      if (!verdict.well_formed) issues.push("model_says_not_well_formed");
      if (!verdict.explanation_ok) issues.push("model_says_explanation_unsupported");
    }
    if (issues.length === 0 && verdictOk) passed++;
    else failures.push({ idx, prompt: question.prompt, issues, reason: verdict?.reason });
  });

  const total = quiz.questions.length;
  return { total, passed, pct: total === 0 ? 0 : passed / total, failures, leaks };
}

/** docs/06 §8 check 5 on its own — counted across every fill_blank question. */
export function fillBlankLeakCount(quiz: QuizOut): number {
  return quiz.questions.filter(
    (q) => q.qtype === "fill_blank" && fillBlankLeaks(q.prompt, q.answer)
  ).length;
}

// ---------------------------------------------------------------------------
// Content property checks (expected-properties files)
// ---------------------------------------------------------------------------

/** Every piece of learner-visible text an artifact set produces. */
export function artifactText(out: RecordedOutput): string {
  const parts: string[] = [];
  for (const s of out.notes_outline.sections) parts.push(s.heading);
  for (const s of out.note_sections) parts.push(s.heading, s.body_md);
  for (const c of out.cards.cards) parts.push(c.front, c.back);
  parts.push(out.quiz.title);
  for (const q of out.quiz.questions) {
    parts.push(q.prompt, q.answer, q.explanation, q.topic, ...(q.options ?? []));
  }
  for (const i of out.plan.items) parts.push(i.title, i.topic);
  return parts.join("\n");
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`$\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function missingTopics(out: RecordedOutput, topics: string[]): string[] {
  const haystack = normalize(artifactText(out));
  return topics.filter((t) => !haystack.includes(normalize(t)));
}

/** Cues that mean the surrounding sentence is REFUTING the claim it contains
 *  ("assuming the derivative of a product is the product of the derivatives is the
 *  most common error"). Good notes quote misconceptions in order to correct them,
 *  so a naive substring match would flag correct teaching as a falsehood. */
const REFUTATION_CUES =
  /\b(not|never|no|isn't|aren't|doesn't|don't|cannot|false|incorrect|wrong|error|mistake|misconception|myth|avoid|assuming|contrary|rather than|instead of|disproves?|fails?|but)\b/;

export function forbiddenClaimsPresent(out: RecordedOutput, claims: string[]): string[] {
  const sentences = normalize(artifactText(out))
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  return claims.filter((claim) => {
    const needle = normalize(claim);
    return sentences.some((s) => s.includes(needle) && !REFUTATION_CUES.test(s));
  });
}

export function forbiddenPatternsMatched(text: string, patterns: string[]): string[] {
  return patterns.filter((p) => new RegExp(p, "i").test(text));
}
