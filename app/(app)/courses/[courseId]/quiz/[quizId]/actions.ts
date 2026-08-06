"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInngestEvent } from "@/lib/inngest-send";
import { capturePostHog } from "@/lib/analytics/server";
import { gradeAnswer } from "@/lib/quiz-grading";
import type { ActionResult } from "@/app/(app)/actions";
import type {
  AnswerFeedback,
  AttemptResults,
  Citation,
  MaterialInsight,
  QType,
  QuestionResult,
  TopicResult,
} from "@/lib/types";

/**
 * Quiz + practice-exam engine actions (docs/04 §7, docs/05 §7.4–7.5).
 * Shared by QuizEngine and ExamEngine.
 *
 * EXAM INTEGRITY (enforced here, server-side): the client only ever receives
 * `quiz_questions_take` rows (no answer / explanation / source_chunk_ids). During
 * an exam attempt `submitAnswer` returns nothing but a save receipt and writes
 * `is_correct = null`, so even a direct read of attempt_answers reveals nothing.
 * Grading and the answer key arrive only from `completeAttempt`. For kind='quiz'
 * the reveal is immediate, so submitAnswer returns that one question's answer,
 * explanation and citations.
 */

const uuid = z.string().uuid();

interface AttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  auto_add_misses: boolean;
}

interface QuizRow {
  id: string;
  course_id: string;
  user_id: string;
  kind: "quiz" | "exam";
  title: string;
  status: string;
  time_limit_seconds: number | null;
}

interface QuestionRow {
  id: string;
  quiz_id: string;
  idx: number;
  qtype: QType;
  topic: string | null;
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  source_chunk_ids: string[];
}

interface AttemptCtx {
  userId: string;
  admin: SupabaseClient;
  attempt: AttemptRow;
  quiz: QuizRow;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Loads the attempt + its quiz, proving ownership before anything is revealed. */
async function loadAttempt(attemptId: string): Promise<AttemptCtx | null> {
  if (!uuid.safeParse(attemptId).success) return null;
  const userId = await currentUserId();
  if (!userId) return null;
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: attempt } = await admin
    .from("quiz_attempts")
    .select("id, quiz_id, user_id, started_at, completed_at, auto_add_misses")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!attempt) return null;

  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, course_id, user_id, kind, title, status, time_limit_seconds")
    .eq("id", (attempt as AttemptRow).quiz_id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quiz) return null;

  return { userId, admin, attempt: attempt as AttemptRow, quiz: quiz as QuizRow };
}

/** chunk_id → source chip data (material title + page / timestamp). One batched read. */
async function citationMap(
  admin: SupabaseClient,
  chunkIds: string[]
): Promise<Map<string, Citation>> {
  const map = new Map<string, Citation>();
  const unique = [...new Set(chunkIds)];
  if (unique.length === 0) return map;
  const { data } = await admin
    .from("chunks")
    .select("id, page, start_seconds, materials(title)")
    .in("id", unique);
  for (const row of data ?? []) {
    const material = row.materials as unknown as { title?: string } | null;
    map.set(row.id as string, {
      chunk_id: row.id as string,
      material_title: material?.title ?? "Your materials",
      page: (row.page ?? null) as number | null,
      start_seconds: (row.start_seconds ?? null) as number | null,
    });
  }
  return map;
}

function citationsFor(ids: string[], map: Map<string, Citation>): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const found = map.get(id);
    if (found && !seen.has(found.chunk_id)) {
      seen.add(found.chunk_id);
      out.push(found);
    }
  }
  return out;
}

/**
 * Misses feed the flashcard queue. These are NOT AI generations, so they must
 * never touch the `cards_generated` usage counter (docs/04 §5).
 */
async function addCardFromQuestion(
  admin: SupabaseClient,
  params: { courseId: string; userId: string; question: Pick<QuestionRow, "prompt" | "answer" | "source_chunk_ids"> }
): Promise<boolean> {
  const { data: existing } = await admin
    .from("flashcards")
    .select("id")
    .eq("course_id", params.courseId)
    .eq("user_id", params.userId)
    .eq("front", params.question.prompt)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) return false;
  const { error } = await admin.from("flashcards").insert({
    course_id: params.courseId,
    user_id: params.userId,
    kind: "basic",
    front: params.question.prompt,
    back: params.question.answer,
    source_chunk_ids: params.question.source_chunk_ids ?? [],
  });
  return !error;
}

/** Starts (or resumes) an attempt. `restart: true` always opens a fresh one — "Retake". */
export async function startQuizAttempt(
  quizId: string,
  options?: { restart?: boolean }
): Promise<ActionResult<{ attemptId: string; startedAt: string; autoAddMisses: boolean }>> {
  if (!uuid.safeParse(quizId).success) return { ok: false, error: "Bad request." };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in first." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "This deployment isn't connected to a database yet." };

  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, course_id, user_id, status")
    .eq("id", quizId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quiz) return { ok: false, error: "Quiz not found." };
  if (quiz.status !== "ready") return { ok: false, error: "This quiz isn't ready yet." };

  if (!options?.restart) {
    const { data: open } = await admin
      .from("quiz_attempts")
      .select("id, started_at, auto_add_misses")
      .eq("quiz_id", quizId)
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open) {
      return {
        ok: true,
        data: {
          attemptId: open.id as string,
          startedAt: open.started_at as string,
          autoAddMisses: Boolean(open.auto_add_misses),
        },
      };
    }
  }

  const { data: created, error } = await admin
    .from("quiz_attempts")
    .insert({ quiz_id: quizId, user_id: userId })
    .select("id, started_at, auto_add_misses")
    .single();
  if (error || !created) return { ok: false, error: "Couldn't start the attempt — try again." };

  return {
    ok: true,
    data: {
      attemptId: created.id as string,
      startedAt: created.started_at as string,
      autoAddMisses: Boolean(created.auto_add_misses),
    },
  };
}

/**
 * Saves one answer (and/or its flag). Quizzes get the reveal back immediately;
 * exams get only a receipt — the answer key stays server-side until submission.
 */
export async function submitAnswer(
  attemptId: string,
  questionId: string,
  answer: string | null,
  flagged?: boolean
): Promise<ActionResult<{ feedback: AnswerFeedback | null }>> {
  const parsed = z
    .object({
      attemptId: uuid,
      questionId: uuid,
      answer: z.string().max(2000).nullable(),
      flagged: z.boolean().optional(),
    })
    .safeParse({ attemptId, questionId, answer, flagged });
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const ctx = await loadAttempt(attemptId);
  if (!ctx) return { ok: false, error: "Attempt not found." };
  if (ctx.attempt.completed_at) return { ok: false, error: "This attempt is already submitted." };

  const { data: questionRow } = await ctx.admin
    .from("quiz_questions")
    .select("id, quiz_id, idx, qtype, topic, prompt, options, answer, explanation, source_chunk_ids")
    .eq("id", parsed.data.questionId)
    .eq("quiz_id", ctx.attempt.quiz_id)
    .maybeSingle();
  if (!questionRow) return { ok: false, error: "Question not found." };
  const question = questionRow as QuestionRow;

  const isExam = ctx.quiz.kind === "exam";
  const grade = gradeAnswer(question.qtype, parsed.data.answer, question.answer);

  const { data: existing } = await ctx.admin
    .from("attempt_answers")
    .select("id, answer, flagged")
    .eq("attempt_id", ctx.attempt.id)
    .eq("question_id", question.id)
    .limit(1)
    .maybeSingle();

  const patch = {
    answer: parsed.data.answer,
    // Exam integrity: correctness is never written (and so never readable) mid-exam.
    is_correct: isExam ? null : grade,
    flagged: parsed.data.flagged ?? (existing?.flagged as boolean | undefined) ?? false,
    answered_at: new Date().toISOString(),
  };

  if (existing) {
    await ctx.admin.from("attempt_answers").update(patch).eq("id", existing.id);
  } else {
    await ctx.admin.from("attempt_answers").insert({
      attempt_id: ctx.attempt.id,
      question_id: question.id,
      user_id: ctx.userId,
      ...patch,
    });
  }

  if (isExam) return { ok: true, data: { feedback: null } };

  // Quiz: instant reveal — correct answer + why + where it came from.
  const map = await citationMap(ctx.admin, question.source_chunk_ids ?? []);
  return {
    ok: true,
    data: {
      feedback: {
        questionId: question.id,
        isCorrect: grade,
        correctAnswer: question.answer,
        explanation: question.explanation,
        citations: citationsFor(question.source_chunk_ids ?? [], map),
      },
    },
  };
}

/** "Flag for review" (exam palette) — persists attempt_answers.flagged. */
export async function setFlagged(
  attemptId: string,
  questionId: string,
  flagged: boolean
): Promise<ActionResult> {
  const parsed = z
    .object({ attemptId: uuid, questionId: uuid, flagged: z.boolean() })
    .safeParse({ attemptId, questionId, flagged });
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const ctx = await loadAttempt(attemptId);
  if (!ctx) return { ok: false, error: "Attempt not found." };
  if (ctx.attempt.completed_at) return { ok: false, error: "This attempt is already submitted." };

  const { data: existing } = await ctx.admin
    .from("attempt_answers")
    .select("id")
    .eq("attempt_id", ctx.attempt.id)
    .eq("question_id", parsed.data.questionId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await ctx.admin
      .from("attempt_answers")
      .update({ flagged: parsed.data.flagged })
      .eq("id", existing.id);
  } else {
    await ctx.admin.from("attempt_answers").insert({
      attempt_id: ctx.attempt.id,
      question_id: parsed.data.questionId,
      user_id: ctx.userId,
      answer: null,
      is_correct: null,
      flagged: parsed.data.flagged,
    });
  }
  return { ok: true };
}

export async function setAutoAddMisses(
  attemptId: string,
  value: boolean
): Promise<ActionResult> {
  const parsed = z.object({ attemptId: uuid, value: z.boolean() }).safeParse({ attemptId, value });
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const ctx = await loadAttempt(attemptId);
  if (!ctx) return { ok: false, error: "Attempt not found." };
  const { error } = await ctx.admin
    .from("quiz_attempts")
    .update({ auto_add_misses: parsed.data.value })
    .eq("id", ctx.attempt.id);
  if (error) return { ok: false, error: "Couldn't save that — try again." };
  return { ok: true };
}

/** "Add to flashcards" ghost button on any question's explanation card. */
export async function addQuestionToFlashcards(questionId: string): Promise<ActionResult<{ added: boolean }>> {
  if (!uuid.safeParse(questionId).success) return { ok: false, error: "Bad request." };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in first." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "This deployment isn't connected to a database yet." };

  const { data: question } = await admin
    .from("quiz_questions")
    .select("id, quiz_id, user_id, prompt, answer, source_chunk_ids")
    .eq("id", questionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!question) return { ok: false, error: "Question not found." };

  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, course_id")
    .eq("id", question.quiz_id as string)
    .maybeSingle();
  if (!quiz) return { ok: false, error: "Quiz not found." };

  const added = await addCardFromQuestion(admin, {
    courseId: quiz.course_id as string,
    userId,
    question: question as Pick<QuestionRow, "prompt" | "answer" | "source_chunk_ids">,
  });
  revalidatePath(`/courses/${quiz.course_id as string}/cards`);
  return { ok: true, data: { added } };
}

/** Grades everything, scores the attempt, feeds misses to the card queue, and
 *  returns the full answer key + per-topic breakdown + material insights. */
export async function completeAttempt(attemptId: string): Promise<ActionResult<AttemptResults>> {
  const ctx = await loadAttempt(attemptId);
  if (!ctx) return { ok: false, error: "Attempt not found." };

  const { data: questionRows } = await ctx.admin
    .from("quiz_questions")
    .select("id, quiz_id, idx, qtype, topic, prompt, options, answer, explanation, source_chunk_ids")
    .eq("quiz_id", ctx.attempt.quiz_id)
    .order("idx", { ascending: true });
  const questions = (questionRows ?? []) as QuestionRow[];
  if (questions.length === 0) return { ok: false, error: "This quiz has no questions." };

  const { data: answerRows } = await ctx.admin
    .from("attempt_answers")
    .select("id, question_id, answer, is_correct, flagged")
    .eq("attempt_id", ctx.attempt.id);

  const answers = new Map<
    string,
    { id: string; answer: string | null; is_correct: boolean | null; flagged: boolean }
  >();
  for (const row of answerRows ?? []) {
    answers.set(row.question_id as string, {
      id: row.id as string,
      answer: (row.answer ?? null) as string | null,
      is_correct: (row.is_correct ?? null) as boolean | null,
      flagged: Boolean(row.flagged),
    });
  }

  const isExam = ctx.quiz.kind === "exam";
  const alreadyCompleted = Boolean(ctx.attempt.completed_at);

  // Exams grade at submission (that's the whole point) — quizzes were graded live.
  if (isExam && !alreadyCompleted) {
    for (const question of questions) {
      const row = answers.get(question.id);
      const grade = gradeAnswer(question.qtype, row?.answer ?? null, question.answer);
      if (row) {
        row.is_correct = grade;
        await ctx.admin.from("attempt_answers").update({ is_correct: grade }).eq("id", row.id);
      } else {
        const { data: inserted } = await ctx.admin
          .from("attempt_answers")
          .insert({
            attempt_id: ctx.attempt.id,
            question_id: question.id,
            user_id: ctx.userId,
            answer: null,
            is_correct: false,
            flagged: false,
          })
          .select("id")
          .single();
        answers.set(question.id, {
          id: (inserted?.id as string) ?? "",
          answer: null,
          is_correct: false,
          flagged: false,
        });
      }
    }
  }

  const chunkIds = questions.flatMap((q) => q.source_chunk_ids ?? []);
  const map = await citationMap(ctx.admin, chunkIds);

  const results: QuestionResult[] = questions.map((question) => {
    const row = answers.get(question.id);
    return {
      questionId: question.id,
      idx: question.idx,
      qtype: question.qtype,
      topic: question.topic,
      prompt: question.prompt,
      options: question.options,
      given: row?.answer ?? null,
      flagged: row?.flagged ?? false,
      isCorrect: row?.is_correct ?? false,
      correctAnswer: question.answer,
      explanation: question.explanation,
      citations: citationsFor(question.source_chunk_ids ?? [], map),
    };
  });

  const correct = results.filter((r) => r.isCorrect === true).length;
  const scorePct = Math.round((correct / results.length) * 100);

  // Auto-add misses (unresolved self-assessments are NOT treated as misses).
  let missesAddedToCards = 0;
  if (ctx.attempt.auto_add_misses && !alreadyCompleted) {
    for (const question of questions) {
      if (answers.get(question.id)?.is_correct !== false) continue;
      const created = await addCardFromQuestion(ctx.admin, {
        courseId: ctx.quiz.course_id,
        userId: ctx.userId,
        question,
      });
      if (created) missesAddedToCards += 1;
    }
  }

  if (!alreadyCompleted) {
    await ctx.admin
      .from("quiz_attempts")
      .update({ completed_at: new Date().toISOString(), score_pct: scorePct })
      .eq("id", ctx.attempt.id);
    await capturePostHog(ctx.userId, isExam ? "exam_completed" : "quiz_completed", {
      score_pct: scorePct,
      n_questions: results.length,
      misses_added_to_cards: missesAddedToCards,
    });
  } else {
    await ctx.admin.from("quiz_attempts").update({ score_pct: scorePct }).eq("id", ctx.attempt.id);
  }

  revalidatePath(`/courses/${ctx.quiz.course_id}`);
  revalidatePath(`/courses/${ctx.quiz.course_id}/cards`);

  return {
    ok: true,
    data: {
      attemptId: ctx.attempt.id,
      scorePct,
      correct,
      total: results.length,
      missesAddedToCards,
      questions: results,
      topics: topicBreakdown(results),
      insights: materialInsights(results, questions, map),
    },
  };
}

/** Free-text answers the grader couldn't match: the learner decides, the score
 *  and the miss-driven flashcards follow their call. */
export async function selfAssessAnswer(
  attemptId: string,
  questionId: string,
  isCorrect: boolean
): Promise<ActionResult<{ scorePct: number; correct: number; total: number; addedCard: boolean }>> {
  const parsed = z
    .object({ attemptId: uuid, questionId: uuid, isCorrect: z.boolean() })
    .safeParse({ attemptId, questionId, isCorrect });
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const ctx = await loadAttempt(attemptId);
  if (!ctx) return { ok: false, error: "Attempt not found." };

  const { data: existing } = await ctx.admin
    .from("attempt_answers")
    .select("id")
    .eq("attempt_id", ctx.attempt.id)
    .eq("question_id", parsed.data.questionId)
    .limit(1)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Nothing to assess." };

  await ctx.admin
    .from("attempt_answers")
    .update({ is_correct: parsed.data.isCorrect })
    .eq("id", existing.id);

  let addedCard = false;
  if (!parsed.data.isCorrect && ctx.attempt.auto_add_misses) {
    const { data: question } = await ctx.admin
      .from("quiz_questions")
      .select("prompt, answer, source_chunk_ids")
      .eq("id", parsed.data.questionId)
      .maybeSingle();
    if (question) {
      addedCard = await addCardFromQuestion(ctx.admin, {
        courseId: ctx.quiz.course_id,
        userId: ctx.userId,
        question: question as Pick<QuestionRow, "prompt" | "answer" | "source_chunk_ids">,
      });
    }
  }

  const { count: total } = await ctx.admin
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", ctx.attempt.quiz_id);
  const { data: correctRows } = await ctx.admin
    .from("attempt_answers")
    .select("id")
    .eq("attempt_id", ctx.attempt.id)
    .eq("is_correct", true);

  const totalCount = total ?? 0;
  const correct = (correctRows ?? []).length;
  const scorePct = totalCount > 0 ? Math.round((correct / totalCount) * 100) : 0;
  if (ctx.attempt.completed_at) {
    await ctx.admin.from("quiz_attempts").update({ score_pct: scorePct }).eq("id", ctx.attempt.id);
  }
  return { ok: true, data: { scorePct, correct, total: totalCount, addedCard } };
}

/** Failed generation recovery (docs/04 §9: message + one recovery action). */
export async function retryQuizGeneration(quizId: string): Promise<ActionResult> {
  if (!uuid.safeParse(quizId).success) return { ok: false, error: "Bad request." };
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in first." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "This deployment isn't connected to a database yet." };

  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, course_id, kind, status")
    .eq("id", quizId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quiz) return { ok: false, error: "Quiz not found." };
  if (quiz.status !== "failed") return { ok: false, error: "Nothing to retry." };

  await admin.from("quizzes").update({ status: "queued" }).eq("id", quizId);
  const isExam = quiz.kind === "exam";
  // Retry never re-charges quota — the first request already paid for it.
  const sent = await sendInngestEvent({
    name: isExam ? "exam/requested" : "quiz/requested",
    data: { quizId, metered: false },
  });
  if (!sent) {
    await admin.from("quizzes").update({ status: "failed" }).eq("id", quizId);
    return { ok: false, error: "Generation isn't configured yet on this deployment." };
  }
  revalidatePath(`/courses/${quiz.course_id as string}`);
  return { ok: true };
}

function topicBreakdown(results: QuestionResult[]): TopicResult[] {
  const buckets = new Map<string, TopicResult>();
  for (const result of results) {
    const topic = result.topic?.trim() || "General";
    const bucket = buckets.get(topic) ?? { topic, correct: 0, total: 0 };
    bucket.total += 1;
    if (result.isCorrect === true) bucket.correct += 1;
    buckets.set(topic, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.correct / a.total - b.correct / b.total);
}

/** "{n} questions came from {material} — reread p.12–18" — built from the MISSED
 *  questions' source chunks (rereading is remediation, docs/05 §7.5). */
function materialInsights(
  results: QuestionResult[],
  questions: QuestionRow[],
  map: Map<string, Citation>
): MaterialInsight[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const buckets = new Map<string, { questions: number; pages: number[] }>();
  for (const result of results) {
    if (result.isCorrect === true) continue;
    const question = byId.get(result.questionId);
    if (!question) continue;
    const titles = new Set<string>();
    for (const chunkId of question.source_chunk_ids ?? []) {
      const citation = map.get(chunkId);
      if (!citation) continue;
      const bucket = buckets.get(citation.material_title) ?? { questions: 0, pages: [] };
      if (citation.page != null) bucket.pages.push(citation.page);
      buckets.set(citation.material_title, bucket);
      titles.add(citation.material_title);
    }
    for (const title of titles) {
      const bucket = buckets.get(title);
      if (bucket) bucket.questions += 1;
    }
  }
  return [...buckets.entries()]
    .map(([materialTitle, bucket]) => ({
      materialTitle,
      questions: bucket.questions,
      pageFrom: bucket.pages.length > 0 ? Math.min(...bucket.pages) : null,
      pageTo: bucket.pages.length > 0 ? Math.max(...bucket.pages) : null,
    }))
    .filter((insight) => insight.questions > 0)
    .sort((a, b) => b.questions - a.questions);
}
