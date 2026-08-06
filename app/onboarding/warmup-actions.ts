"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/(app)/actions";

export interface WarmupQuestion {
  id: string;
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation: string;
}

/** The onboarding warm-up is a kind='quiz' (not 'exam'), so per-question reveal
 *  is immediate and answers may be sent with the questions (docs/04 §4). */
export async function getWarmupQuestions(
  quizId: string
): Promise<ActionResult<{ questions: WarmupQuestion[] }>> {
  if (!z.string().uuid().safeParse(quizId).success) return { ok: false, error: "Bad request." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, kind, status")
    .eq("id", quizId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!quiz || quiz.kind !== "quiz") return { ok: false, error: "Quiz not found." };
  if (quiz.status !== "ready") return { ok: false, error: "Still generating." };

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, prompt, options, answer, explanation")
    .eq("quiz_id", quizId)
    .order("idx")
    .limit(3);

  if (!questions || questions.length === 0) return { ok: false, error: "No questions yet." };

  return {
    ok: true,
    data: {
      questions: questions.map((q) => ({
        id: q.id as string,
        prompt: q.prompt as string,
        options: (q.options ?? null) as string[] | null,
        answer: q.answer as string,
        explanation: q.explanation as string,
      })),
    },
  };
}
