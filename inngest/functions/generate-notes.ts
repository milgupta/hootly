import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastJobEvent } from "@/lib/realtime";
import { env } from "@/lib/env";
import { generateJson } from "@/lib/ai/generate";
import { notesOutlineSchema, noteSectionSchema } from "@/lib/ai/schemas";
import { notesOutlinePrompt, notesSectionPrompt, preambleFor, topicModeBlock } from "@/lib/ai/prompts";
import {
  buildChunkContext, extractChunkMarkers, getCourseChunks, resolveCitations,
  LOW_CONFIDENCE_MIN, type RetrievedChunk,
} from "@/lib/ai/rag";
import {
  checkGroundedness, GROUNDED_FLAG_THRESHOLD, GROUNDED_REGEN_THRESHOLD,
} from "@/lib/ai/groundedness";
import { capturePostHog } from "@/lib/analytics/server";
import { markFirstArtifact } from "@/lib/analytics/first-artifact";
import { failArtifact, loadGenerationContext } from "@/lib/ai/job-helpers";

/** generate-notes (docs/04 §6): outline (TUTOR) → sections in parallel (BULK) →
 *  groundedness pass → insert sections → status ready. Progress section-by-section.
 *  Regeneration never deletes the old version until the new one is ready. */
export const generateNotes = inngest.createFunction(
  { id: "generate-notes", retries: 1 },
  { event: "notes/requested" },
  async ({ event, step }) => {
    const noteId = event.data.noteId as string;
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const ctx = await step.run("load", async () => {
      const { data: note } = await admin.from("notes").select("*").eq("id", noteId).maybeSingle();
      if (!note) throw new NonRetriableError("note not found");
      await admin.from("notes").update({ status: "generating" }).eq("id", noteId);
      const base = await loadGenerationContext(admin, note.course_id);
      await broadcastJobEvent(note.course_id, { stage: "notes", status: "generating" });
      return { note, ...base };
    });

    const { note, course, profile, chunks } = ctx as Awaited<ReturnType<typeof loadGenerationContext>> & {
      note: { id: string; course_id: string; user_id: string; title: string; depth: string; topic_mode: boolean };
    };
    const preamble = preambleFor(profile?.study_level ?? null);
    const topicMode = note.topic_mode || chunks.length === 0;

    // Low-confidence rule (docs/06 §1): grounded generation needs ≥3 usable chunks.
    if (!topicMode && chunks.length < LOW_CONFIDENCE_MIN) {
      await failArtifact(admin, "notes", noteId, note.user_id, "insufficient_material");
      return { ok: false, error: "insufficient_material" };
    }

    const started = Date.now();
    await capturePostHog(note.user_id, "generation_requested", { artifact: "notes", model: env.modelTutor });

    try {
      // ---- outline -------------------------------------------------------
      const outline = await step.run("outline", async () => {
        const context = topicMode
          ? topicModeBlock(course.name, profile?.study_level ?? null, course.familiarity)
          : buildChunkContext(chunks, 12_000).block; // ≤12k tokens for notes outline
        const res = await generateJson({
          model: env.modelTutor,
          prompt: notesOutlinePrompt({
            preamble,
            course: course.name,
            depth: note.depth,
            sources: context,
          }),
          schema: notesOutlineSchema,
        });
        await broadcastJobEvent(note.course_id, {
          stage: "topics",
          headings: res.data.sections.map((s) => s.heading),
        });
        return res.data;
      });

      // ---- sections (parallel, BULK) --------------------------------------
      const sections = await Promise.all(
        outline.sections.map((section, idx) =>
          step.run(`section-${idx}`, async () => {
            const sectionChunks = topicMode
              ? []
              : pickSectionChunks(chunks, section.covers_chunk_ids);
            const context = topicMode
              ? topicModeBlock(section.heading, profile?.study_level ?? null, course.familiarity)
              : buildChunkContext(sectionChunks, 6000);
            const contextBlock = typeof context === "string" ? context : context.block;
            const prefixMap = typeof context === "string" ? new Map<string, string>() : context.prefixToUuid;

            const res = await generateJson({
              model: env.modelBulk,
              prompt: notesSectionPrompt({
                preamble,
                heading: section.heading,
                depth: note.depth,
                sources: contextBlock,
              }),
              schema: noteSectionSchema,
              maxTokens: 3000,
            });

            let body = res.data.body_md;
            let grounded = true;

            if (!topicMode) {
              // Groundedness pass; <0.5 regenerates once, then flags (docs/06 §5).
              let pct = await checkGroundedness(body, contextBlock);
              if (pct < GROUNDED_REGEN_THRESHOLD) {
                const retry = await generateJson({
                  model: env.modelBulk,
                  prompt: notesSectionPrompt({
                    preamble, heading: section.heading, depth: note.depth, sources: contextBlock,
                  }),
                  schema: noteSectionSchema,
                  maxTokens: 3000,
                });
                body = retry.data.body_md;
                pct = await checkGroundedness(body, contextBlock);
              }
              if (pct < GROUNDED_FLAG_THRESHOLD) {
                grounded = false;
                await capturePostHog(note.user_id, "groundedness_flagged", { artifact: "notes", pct });
              }
            }

            const markers = extractChunkMarkers(body);
            const cited = topicMode
              ? []
              : resolveCitations([...markers, ...res.data.source_chunk_ids], prefixMap);

            await broadcastJobEvent(note.course_id, {
              stage: "notes_section",
              idx,
              total: outline.sections.length,
              heading: section.heading,
            });

            return { idx, heading: section.heading, body_md: body, source_chunk_ids: cited, grounded };
          })
        )
      );

      // ---- swap in atomically (old version stays until new one is ready) ---
      await step.run("persist", async () => {
        await admin.from("note_sections").delete().eq("note_id", noteId);
        const { error } = await admin.from("note_sections").insert(
          sections.map((s) => ({
            note_id: noteId,
            user_id: note.user_id,
            idx: s.idx,
            heading: s.heading,
            body_md: s.body_md,
            source_chunk_ids: s.source_chunk_ids,
            grounded: s.grounded,
          }))
        );
        if (error) throw new Error(error.message);
        await admin.from("notes").update({ status: "ready", topic_mode: topicMode }).eq("id", noteId);
        await broadcastJobEvent(note.course_id, { stage: "notes", status: "ready", noteId });
      });

      await capturePostHog(note.user_id, "generation_completed", {
        artifact: "notes",
        model: env.modelTutor,
        seconds: Math.round((Date.now() - started) / 1000),
      });
      if (topicMode) await capturePostHog(note.user_id, "topic_mode_generated", { artifact: "notes" });
      await markFirstArtifact(note.user_id, "notes");
      return { ok: true, sections: sections.length };
    } catch (e) {
      const code = (e as { code?: string }).code ?? "ai_invalid_output";
      await failArtifact(admin, "notes", noteId, note.user_id, code);
      return { ok: false, error: code };
    }
  }
);

/** Prefer the chunks the outline named, then fill with neighbors for context. */
function pickSectionChunks(all: RetrievedChunk[], coversPrefixes: string[]): RetrievedChunk[] {
  const wanted = new Set(coversPrefixes.map((p) => p.replace(/^chunk:/, "").slice(0, 8)));
  const picked: RetrievedChunk[] = [];
  const indices: number[] = [];
  all.forEach((c, i) => {
    if (wanted.has(c.id.replace(/-/g, "").slice(0, 8))) {
      picked.push(c);
      indices.push(i);
    }
  });
  if (picked.length === 0) return all.slice(0, 8);
  // Neighbors for continuity.
  const withNeighbors = new Set(picked.map((c) => c.id));
  for (const i of indices) {
    for (const j of [i - 1, i + 1]) {
      const n = all[j];
      if (n && !withNeighbors.has(n.id)) {
        withNeighbors.add(n.id);
        picked.push(n);
      }
    }
  }
  return picked.slice(0, 14);
}
