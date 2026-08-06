import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastJobEvent } from "@/lib/realtime";
import { env } from "@/lib/env";
import { generateJson } from "@/lib/ai/generate";
import { cardsSchema } from "@/lib/ai/schemas";
import { cardsPrompt, preambleFor, topicModeBlock } from "@/lib/ai/prompts";
import { buildChunkContext, embedTexts, LOW_CONFIDENCE_MIN, resolveCitations } from "@/lib/ai/rag";
import { capturePostHog } from "@/lib/analytics/server";
import { markFirstArtifact } from "@/lib/analytics/first-artifact";
import { loadGenerationContext } from "@/lib/ai/job-helpers";
import { incrementUsage, checkQuota } from "@/lib/billing/usage";

const DUPE_COSINE = 0.95;

/** generate-cards (docs/04 §6): per-topic batches → zod validate → dedupe
 *  (cosine > 0.95 on front text) → insert. Emits count-so-far. */
export const generateCards = inngest.createFunction(
  { id: "generate-cards", retries: 1 },
  { event: "cards/requested" },
  async ({ event, step }) => {
    const courseId = event.data.courseId as string;
    const count = (event.data.count as number) ?? 20;
    const customFocus = (event.data.customFocus as string | null) ?? null;
    const metered = event.data.metered !== false; // onboarding jobs pass metered:false
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const ctx = await step.run("load", async () => {
      const base = await loadGenerationContext(admin, courseId);
      return base;
    });
    const { course, profile, chunks } = ctx;
    const userId = course.user_id;
    const topicMode = chunks.length === 0;

    if (!topicMode && chunks.length < LOW_CONFIDENCE_MIN) {
      await broadcastJobEvent(courseId, {
        stage: "failed", artifact: "cards", error_code: "insufficient_material",
        error_detail: "Not enough material on this topic yet.",
      });
      await capturePostHog(userId, "generation_failed", { artifact: "cards", error_code: "insufficient_material" });
      return { ok: false, error: "insufficient_material" };
    }

    // Free limits gate creating NEW things; onboarding build is exempt (docs/04 §5).
    if (metered) {
      const quota = await checkQuota(userId, "cards_generated", count);
      if (!quota.allowed) {
        await capturePostHog(userId, "limit_hit", { metric: "cards_generated" });
        await broadcastJobEvent(courseId, {
          stage: "failed", artifact: "cards", error_code: "limit_reached",
          error_detail: "You've used your free AI flashcards.",
        });
        return { ok: false, error: "limit_reached" };
      }
    }

    const started = Date.now();
    await capturePostHog(userId, "generation_requested", { artifact: "cards", model: env.modelBulk });

    try {
      const inserted = await step.run("generate-and-insert", async () => {
        const context = topicMode
          ? { block: topicModeBlock(course.name, profile?.study_level ?? null, course.familiarity), prefixToUuid: new Map<string, string>() }
          : buildChunkContext(chunks, 10_000);

        const res = await generateJson({
          model: env.modelBulk,
          prompt: cardsPrompt({
            preamble: preambleFor(profile?.study_level ?? null),
            count,
            topicOrCourse: course.name,
            customFocus,
            sources: context.block,
          }),
          schema: cardsSchema,
          maxTokens: 8000,
        });

        const candidates = res.data.cards.slice(0, count);
        if (candidates.length === 0) return 0;

        // Dedupe vs existing course cards on front-text cosine > 0.95.
        const { data: existing } = await admin
          .from("flashcards")
          .select("front")
          .eq("course_id", courseId)
          .is("deleted_at", null);
        const existingFronts = (existing ?? []).map((c) => c.front as string);

        const fronts = candidates.map((c) => c.front);
        const allEmbeddings = await embedTexts([...existingFronts, ...fronts]);
        const existingVecs = allEmbeddings.slice(0, existingFronts.length);
        const newVecs = allEmbeddings.slice(existingFronts.length);

        const keep: typeof candidates = [];
        const keptVecs: number[][] = [];
        candidates.forEach((card, i) => {
          const vec = newVecs[i]!;
          const dupeExisting = existingVecs.some((v) => cosine(v, vec) > DUPE_COSINE);
          const dupeBatch = keptVecs.some((v) => cosine(v, vec) > DUPE_COSINE);
          if (!dupeExisting && !dupeBatch) {
            keep.push(card);
            keptVecs.push(vec);
          }
        });
        if (keep.length === 0) return 0;

        const { error } = await admin.from("flashcards").insert(
          keep.map((c) => ({
            course_id: courseId,
            user_id: userId,
            kind: c.kind === "reversed" ? "reversed" : c.kind,
            front: c.front,
            back: c.back,
            source_chunk_ids: topicMode ? [] : resolveCitations(c.source_chunk_ids, context.prefixToUuid),
          }))
        );
        if (error) throw new Error(error.message);
        await broadcastJobEvent(courseId, { stage: "cards", status: "ready", count: keep.length });
        return keep.length;
      });

      if (metered && inserted > 0) await incrementUsage(userId, "cards_generated", inserted);
      await capturePostHog(userId, "generation_completed", {
        artifact: "cards",
        model: env.modelBulk,
        seconds: Math.round((Date.now() - started) / 1000),
      });
      if (topicMode) await capturePostHog(userId, "topic_mode_generated", { artifact: "cards" });
      await markFirstArtifact(userId, "cards");
      return { ok: true, cards: inserted };
    } catch (e) {
      const code = (e as { code?: string }).code ?? "ai_invalid_output";
      await broadcastJobEvent(courseId, {
        stage: "failed", artifact: "cards", error_code: code,
        error_detail: code === "ai_overloaded" ? "Our AI is busy — retrying automatically." : "Generation hiccuped — retry.",
      });
      await capturePostHog(userId, "generation_failed", { artifact: "cards", error_code: code });
      if (e instanceof NonRetriableError) throw e;
      return { ok: false, error: code };
    }
  }
);

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    dot += x * y; na += x * x; nb += y * y;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
