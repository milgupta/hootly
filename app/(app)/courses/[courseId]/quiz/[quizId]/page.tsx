import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Quiz, QuizQuestionTake } from "@/lib/types";
import { QuizEngine } from "./QuizEngine";
import { QuizFailed, QuizGenerating, QuizNoQuestions } from "./QuizShared";

/**
 * `/courses/[courseId]/quiz/[quizId]` — quiz take (docs/05 §7.4).
 *
 * Questions are read from the `quiz_questions_take` view ONLY (docs/04 §4): no
 * answer, explanation or source_chunk_ids ever reaches the client from this page.
 * The quiz reveal arrives per question from `submitAnswer`.
 */
export default async function QuizPage({
  params,
}: {
  params: Promise<{ courseId: string; quizId: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { courseId, quizId } = await params;

  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: quizRow } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!quizRow) notFound();
  const quiz = quizRow as Quiz;
  if (quiz.course_id !== courseId) notFound();
  if (quiz.kind === "exam") redirect(`/courses/${courseId}/exam/${quizId}`);

  if (quiz.status === "queued" || quiz.status === "generating") {
    return <QuizGenerating courseId={courseId} kind="quiz" />;
  }
  if (quiz.status === "failed") {
    return <QuizFailed quizId={quiz.id} kind="quiz" courseId={courseId} />;
  }

  const { data: questionRows } = await supabase
    .from("quiz_questions_take")
    .select("id, quiz_id, user_id, idx, qtype, topic, prompt, options, difficulty")
    .eq("quiz_id", quizId)
    .order("idx", { ascending: true });
  const questions = (questionRows ?? []) as QuizQuestionTake[];
  if (questions.length === 0) {
    return <QuizNoQuestions courseId={courseId} kind="quiz" />;
  }

  // Resume an open attempt rather than losing progress (unlosable-data rule).
  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, auto_add_misses")
    .eq("quiz_id", quizId)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let answeredCount = 0;
  if (attempt) {
    const { count } = await supabase
      .from("attempt_answers")
      .select("id", { count: "exact", head: true })
      .eq("attempt_id", attempt.id as string)
      .not("answer", "is", null);
    answeredCount = count ?? 0;
  }

  return (
    <QuizEngine
      courseId={courseId}
      quiz={{ id: quiz.id, title: quiz.title, kind: quiz.kind, topic_mode: quiz.topic_mode }}
      questions={questions}
      initialAttempt={
        attempt
          ? { id: attempt.id as string, autoAddMisses: Boolean(attempt.auto_add_misses) }
          : null
      }
      answeredCount={answeredCount}
    />
  );
}
