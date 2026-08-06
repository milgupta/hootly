import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastJobEvent } from "@/lib/realtime";
import { env } from "@/lib/env";
import { generateJson } from "@/lib/ai/generate";
import { noteSectionSchema } from "@/lib/ai/schemas";
import { notesSectionPrompt, preambleFor, topicModeBlock } from "@/lib/ai/prompts";
import { buildChunkContext, extractChunkMarkers, resolveCitations } from "@/lib/ai/rag";
import {
  checkGroundedness, GROUNDED_FLAG_THRESHOLD, GROUNDED_REGEN_THRESHOLD,
} from "@/lib/ai/groundedness";
import { loadGenerationContext } from "@/lib/ai/job-helpers";
import { capturePostHog } from "@/lib/analytics/server";

/** Regenerate ONE note section (docs/05 §7.1 "Regenerate section" per section).
 *  The existing section stays intact until the replacement is ready. */
export const regenerateSection = inngest.createFunction(
  { id: "regenerate-note-section", retries: 1 },
  { event: "notes/section-regenerate" },
  async ({ event, step }) => {
    const sectionId = event.data.sectionId as string;
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const loaded = await step.run("load", async () => {
      const { data: section } = await admin
        .from("note_sections")
        .select("*, notes!inner(id, course_id, depth, topic_mode)")
        .eq("id", sectionId)
        .maybeSingle();
      if (!section) throw new NonRetriableError("section not found");
      const note = section.notes as unknown as {
        id: string; course_id: string; depth: string; topic_mode: boolean;
      };
      const base = await loadGenerationContext(admin, note.course_id);
      return { section, note, ...base };
    });
    const { section, note, course, profile, chunks } = loaded;
    const topicMode = note.topic_mode || chunks.length === 0;

    try {
      await step.run("regenerate", async () => {
        // Reuse the section's own cited chunks plus neighbors for continuity.
        const cited = new Set((section.source_chunk_ids as string[]) ?? []);
        const relevant = chunks.filter((c) => cited.has(c.id));
        const pool = relevant.length > 0 ? relevant : chunks.slice(0, 8);
        const context = topicMode
          ? { block: topicModeBlock(section.heading as string, profile?.study_level ?? null, course.familiarity), prefixToUuid: new Map<string, string>() }
          : buildChunkContext(pool, 6000);

        const res = await generateJson({
          model: env.modelBulk,
          prompt: notesSectionPrompt({
            preamble: preambleFor(profile?.study_level ?? null),
            heading: section.heading as string,
            depth: note.depth,
            sources: context.block,
          }),
          schema: noteSectionSchema,
          maxTokens: 3000,
        });

        let grounded = true;
        if (!topicMode) {
          let pct = await checkGroundedness(res.data.body_md, context.block);
          if (pct < GROUNDED_REGEN_THRESHOLD) pct = await checkGroundedness(res.data.body_md, context.block);
          if (pct < GROUNDED_FLAG_THRESHOLD) {
            grounded = false;
            await capturePostHog(section.user_id as string, "groundedness_flagged", { artifact: "notes", pct });
          }
        }

        const markers = extractChunkMarkers(res.data.body_md);
        await admin
          .from("note_sections")
          .update({
            body_md: res.data.body_md,
            grounded,
            source_chunk_ids: topicMode
              ? []
              : resolveCitations([...markers, ...res.data.source_chunk_ids], context.prefixToUuid),
          })
          .eq("id", sectionId);
        await broadcastJobEvent(note.id, { stage: "section_regenerated", sectionId });
      });
      return { ok: true };
    } catch (e) {
      const code = (e as { code?: string }).code ?? "ai_invalid_output";
      await broadcastJobEvent(note.id, {
        stage: "failed", artifact: "notes", sectionId, error_code: code,
        error_detail: "Generation hiccuped — retry.",
      });
      return { ok: false, error: code };
    }
  }
);
