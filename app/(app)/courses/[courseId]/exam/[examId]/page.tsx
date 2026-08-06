import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Quiz, QuizQuestionTake } from "@/lib/types";
import { ExamEngine } from "./ExamEngine";
import {
  QuizFailed,
  QuizGenerating,
  QuizNoQuestions,
} from "../../quiz/[quizId]/QuizShared";

/**
 * `/courses/[courseId]/exam/[examId]` — practice exam (docs/05 §7.5).
 *
 * EXAM INTEGRITY: this page reads the `quiz_questions_take` view only — the
 * answer, explanation and source_chunk_ids columns never leave the server until
 * `completeAttempt` runs. Saved answers are loaded back for resume, but
 * `attempt_answers.is_correct` stays null for exams until submission.
 */
export default async function ExamPage({
  params,
}: {
  params: Promise<{ courseId: string; examId: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { courseId, examId } = await params;

  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: quizRow } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", examId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quizRow) notFound();
  const quiz = quizRow as Quiz;
  if (quiz.course_id !== courseId) notFound();
  if (quiz.kind !== "exam") redirect(`/courses/${courseId}/quiz/${examId}`);

  if (quiz.status === "queued" || quiz.status === "generating") {
    return <QuizGenerating courseId={courseId} kind="exam" />;
  }
  if (quiz.status === "failed") {
    return <QuizFailed quizId={quiz.id} kind="exam" courseId={courseId} />;
  }

  const { data: questionRows } = await supabase
    .from("quiz_questions_take")
    .select("id, quiz_id, user_id, idx, qtype, topic, prompt, options, difficulty")
    .eq("quiz_id", examId)
    .order("idx", { ascending: true });
  const questions = (questionRows ?? []) as QuizQuestionTake[];
  if (questions.length === 0) {
    return <QuizNoQuestions courseId={courseId} kind="exam" />;
  }

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, auto_add_misses, started_at")
    .eq("quiz_id", examId)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialAnswers: { questionId: string; answer: string | null; flagged: boolean }[] = [];
  if (attempt) {
    // Note: answer + flagged only. is_correct is null for every in-flight exam row.
    const { data: rows } = await supabase
      .from("attempt_answers")
      .select("question_id, answer, flagged")
      .eq("attempt_id", attempt.id as string);
    initialAnswers = (rows ?? []).map((row) => ({
      questionId: row.question_id as string,
      answer: (row.answer ?? null) as string | null,
      flagged: Boolean(row.flagged),
    }));
  }

  return (
    <ExamEngine
      courseId={courseId}
      quiz={{
        id: quiz.id,
        title: quiz.title,
        kind: quiz.kind,
        topic_mode: quiz.topic_mode,
        time_limit_seconds: quiz.time_limit_seconds,
      }}
      questions={questions}
      initialAttempt={
        attempt
          ? {
              id: attempt.id as string,
              autoAddMisses: Boolean(attempt.auto_add_misses),
              startedAt: attempt.started_at as string,
            }
          : null
      }
      initialAnswers={initialAnswers}
    />
  );
}
