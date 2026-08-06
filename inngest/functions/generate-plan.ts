import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastJobEvent } from "@/lib/realtime";
import { env } from "@/lib/env";
import { generateJson } from "@/lib/ai/generate";
import { planSchema } from "@/lib/ai/schemas";
import { planPrompt, preambleFor } from "@/lib/ai/prompts";
import { capturePostHog } from "@/lib/analytics/server";
import { loadGenerationContext } from "@/lib/ai/job-helpers";

/** generate-plan (docs/04 §6): topics + exam_date + familiarity → plan items.
 *  target_id is NOT AI-emitted — resolved lazily on first click (docs/06 §4.5). */
export const generatePlan = inngest.createFunction(
  { id: "generate-plan", retries: 1 },
  { event: "plan/requested" },
  async ({ event, step }) => {
    const courseId = event.data.courseId as string;
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const { course, profile } = await step.run("load", () => loadGenerationContext(admin, courseId));
    const userId = course.user_id;
    const started = Date.now();
    await capturePostHog(userId, "generation_requested", { artifact: "plan", model: env.modelBulk });

    try {
      const items = await step.run("generate", async () => {
        // Topics: note section headings first; fall back to the course name.
        const { data: sections } = await admin
          .from("note_sections")
          .select("heading, notes!inner(course_id)")
          .eq("notes.course_id", courseId)
          .order("idx");
        const topics = (sections ?? []).map((s) => s.heading as string);
        const topicList = topics.length > 0 ? topics.join(", ") : course.name;

        const res = await generateJson({
          model: env.modelBulk,
          prompt: planPrompt({
            preamble: preambleFor(profile?.study_level ?? null),
            course: course.name,
            date: new Date().toISOString().slice(0, 10),
            examDate: course.exam_date,
            familiarity: course.familiarity,
            topics: topicList,
          }),
          schema: planSchema,
          maxTokens: 4000,
        });

        // Replace the plan only once the new one is ready; completed items keep
        // their state by title match (docs/05 §7.7 "Rebuild plan keeps completed items").
        const { data: previous } = await admin
          .from("study_plan_items")
          .select("title, completed_at")
          .eq("course_id", courseId)
          .not("completed_at", "is", null);
        const completedTitles = new Set((previous ?? []).map((p) => (p.title as string).toLowerCase()));

        await admin.from("study_plan_items").delete().eq("course_id", courseId);
        const rows = res.data.items.map((item, i) => ({
          course_id: courseId,
          user_id: userId,
          idx: item.idx ?? i,
          title: item.title,
          kind: item.kind,
          topic: item.topic || null,
          due_date: item.due_date,
          completed_at: completedTitles.has(item.title.toLowerCase()) ? new Date().toISOString() : null,
        }));
        const { error } = await admin.from("study_plan_items").insert(rows);
        if (error) throw new Error(error.message);

        for (const item of rows) {
          await broadcastJobEvent(courseId, { stage: "plan_item", title: item.title, idx: item.idx });
        }
        await broadcastJobEvent(courseId, { stage: "plan", status: "ready", count: rows.length });
        return rows.length;
      });

      await capturePostHog(userId, "generation_completed", {
        artifact: "plan", model: env.modelBulk, seconds: Math.round((Date.now() - started) / 1000),
      });
      return { ok: true, items };
    } catch (e) {
      const code = (e as { code?: string }).code ?? "ai_invalid_output";
      await broadcastJobEvent(courseId, {
        stage: "failed", artifact: "plan", error_code: code, error_detail: "Generation hiccuped — retry.",
      });
      await capturePostHog(userId, "generation_failed", { artifact: "plan", error_code: code });
      return { ok: false, error: code };
    }
  }
);
