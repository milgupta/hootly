import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastJobEvent } from "@/lib/realtime";
import { env } from "@/lib/env";
import { generateJson } from "@/lib/ai/generate";
import { quizSchema, type QuizOut } from "@/lib/ai/schemas";
import { quizPrompt, preambleFor, topicModeBlock } from "@/lib/ai/prompts";
import { buildChunkContext, LOW_CONFIDENCE_MIN, resolveCitations } from "@/lib/ai/rag";
import { fillBlankLeaks, verifyAnswerKey } from "@/lib/ai/groundedness";
import { capturePostHog } from "@/lib/analytics/server";
import { markFirstArtifact } from "@/lib/analytics/first-artifact";
import { failArtifact, loadGenerationContext } from "@/lib/ai/job-helpers";
import { checkQuota, incrementUsage } from "@/lib/billing/usage";

type Question = QuizOut["questions"][number];

/** generate-quiz / generate-exam (docs/04 §6): questions → answer-key verification
 *  (docs/06 §6) → insert. Failing questions are regenerated (max 2 tries) and
 *  never served. Exams use TUTOR, n=40, time_limit = n*90 unless a syllabus says otherwise. */
export const generateQuiz = inngest.createFunction(
  { id: "generate-quiz", retries: 1 },
  [{ event: "quiz/requested" }, { event: "exam/requested" }],
  async ({ event, step }) => {
    const quizId = event.data.quizId as string;
    const isExam = event.name === "exam/requested";
    const n = (event.data.n as number) ?? (isExam ? 40 : 10);
    const metered = event.data.metered !== false;
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const loaded = await step.run("load", async () => {
      const { data: quiz } = await admin.from("quizzes").select("*").eq("id", quizId).maybeSingle();
      if (!quiz) throw new NonRetriableError("quiz not found");
      await admin.from("quizzes").update({ status: "generating" }).eq("id", quizId);
      const base = await loadGenerationContext(admin, quiz.course_id);
      return { quiz, ...base };
    });
    const { quiz, course, profile, chunks } = loaded as Awaited<ReturnType<typeof loadGenerationContext>> & {
      quiz: { id: string; course_id: string; user_id: string; title: string; topic: string | null; kind: string };
    };
    const userId = quiz.user_id;
    const topicMode = chunks.length === 0;
    const artifact = isExam ? "exam" : "quiz";

    if (!topicMode && chunks.length < LOW_CONFIDENCE_MIN) {
      await failArtifact(admin, artifact, quizId, userId, "insufficient_material");
      return { ok: false, error: "insufficient_material" };
    }
    if (metered) {
      const quota = await checkQuota(userId, "quizzes_generated");
      if (!quota.allowed) {
        await capturePostHog(userId, "limit_hit", { metric: "quizzes_generated" });
        await failArtifact(admin, artifact, quizId, userId, "limit_reached");
        return { ok: false, error: "limit_reached" };
      }
    }

    const model = isExam ? env.modelTutor : env.modelBulk;
    const started = Date.now();
    await capturePostHog(userId, "generation_requested", { artifact, model });

    try {
      const result = await step.run("generate-verify-insert", async () => {
        const context = topicMode
          ? { block: topicModeBlock(quiz.topic ?? course.name, profile?.study_level ?? null, course.familiarity), prefixToUuid: new Map<string, string>() }
          : buildChunkContext(chunks, isExam ? 12_000 : 10_000);

        const buildPrompt = (count: number, note?: string) =>
          quizPrompt({
            preamble: preambleFor(profile?.study_level ?? null),
            n: count,
            isExam,
            topicOrCourse: quiz.topic ?? course.name,
            familiarity: course.familiarity,
            sources: context.block,
          }) + (note ? `\n${note}` : "");

        const first = await generateJson({
          model,
          prompt: buildPrompt(n),
          schema: quizSchema,
          maxTokens: isExam ? 16_000 : 6000,
        });

        const verified: Question[] = [];
        const rejected: Question[] = [];

        for (const q of first.data.questions) {
          if (await passes(q, context.block, topicMode)) verified.push(q);
          else rejected.push(q);
        }

        // Regenerate the shortfall (max 2 extra tries), then drop and backfill count.
        let tries = 0;
        while (verified.length < n && tries < 2) {
          tries += 1;
          const missing = n - verified.length;
          const retry = await generateJson({
            model,
            prompt: buildPrompt(
              missing,
              `Avoid these questions, they failed verification: ${rejected.slice(0, 8).map((r) => r.prompt).join(" | ")}`
            ),
            schema: quizSchema,
            maxTokens: isExam ? 12_000 : 5000,
          });
          for (const q of retry.data.questions) {
            if (verified.length >= n) break;
            if (await passes(q, context.block, topicMode)) verified.push(q);
            else rejected.push(q);
          }
        }

        if (verified.length === 0) throw new Error("ai_invalid_output");

        // New questions replace old ONLY once verified (durability rule).
        await admin.from("quiz_questions").delete().eq("quiz_id", quizId);
        const { error } = await admin.from("quiz_questions").insert(
          verified.map((q, idx) => ({
            quiz_id: quizId,
            user_id: userId,
            idx,
            qtype: q.qtype,
            topic: q.topic || null,
            prompt: q.prompt,
            options: q.qtype === "mcq" ? q.options ?? null : null,
            answer: q.answer,
            explanation: q.explanation,
            source_chunk_ids: topicMode ? [] : resolveCitations(q.source_chunk_ids, context.prefixToUuid),
            difficulty: q.difficulty,
          }))
        );
        if (error) throw new Error(error.message);

        const timeLimit = isExam ? verified.length * 90 : null;
        await admin
          .from("quizzes")
          .update({
            status: "ready",
            title: quiz.title || first.data.title,
            topic_mode: topicMode,
            time_limit_seconds: timeLimit,
          })
          .eq("id", quizId);

        await broadcastJobEvent(quiz.course_id, {
          stage: artifact, status: "ready", quizId, questions: verified.length,
        });
        return { count: verified.length, firstTryPassRate: first.data.questions.length ? verified.length / first.data.questions.length : 0 };
      });

      if (metered) await incrementUsage(userId, "quizzes_generated");
      await capturePostHog(userId, "generation_completed", {
        artifact, model, seconds: Math.round((Date.now() - started) / 1000),
      });
      if (topicMode) await capturePostHog(userId, "topic_mode_generated", { artifact });
      await markFirstArtifact(userId, artifact);
      return { ok: true, ...result };
    } catch (e) {
      const code = (e as { code?: string }).code ?? "ai_invalid_output";
      await failArtifact(admin, artifact, quizId, userId, code);
      return { ok: false, error: code };
    }
  }
);

/** A question ships only if the deterministic fill-blank leak check AND the
 *  CHECK-model answer-key verification both pass (docs/06 §6). */
async function passes(q: Question, sources: string, topicMode: boolean): Promise<boolean> {
  if (q.qtype === "mcq" && (!q.options || q.options.length !== 4)) return false;
  if (q.qtype === "fill_blank" && fillBlankLeaks(q.prompt, q.answer)) return false;
  if (q.qtype === "mcq" && q.options && !q.options.includes(q.answer)) return false;
  try {
    const verdict = await verifyAnswerKey({
      sources: topicMode ? "(general knowledge — verify the answer is factually correct and uniquely correct)" : sources,
      question: q.prompt,
      explanation: q.explanation,
      answer: q.answer,
      qtype: q.qtype,
      options: q.options ?? null,
    });
    return verdict.ok;
  } catch {
    // Verification unavailable (e.g. no API key) → don't serve unverified questions.
    return false;
  }
}
