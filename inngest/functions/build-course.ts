import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { broadcastJobEvent } from "@/lib/realtime";

/** build-course orchestrator (docs/04 §6): waits for ingestion, then fans out
 *  notes (standard) → plan → 20 cards + 3-question warm-up quiz, emitting theater
 *  stages on 'job:{courseId}'. Cards/quiz are metered:false — free limits start
 *  counting AFTER first value (docs/04 §5 trust rule). */
export const buildCourse = inngest.createFunction(
  { id: "build-course", retries: 1 },
  { event: "course/build" },
  async ({ event, step }) => {
    const courseId = event.data.courseId as string;
    const admin = createAdminClient();
    if (!admin) return { skipped: "no service role key" }; // TODO(key-needed)

    const userId = await step.run("start", async () => {
      const { data: course } = await admin
        .from("courses")
        .select("user_id")
        .eq("id", courseId)
        .maybeSingle();
      await broadcastJobEvent(courseId, { stage: "start" });
      return course?.user_id as string | undefined;
    });
    if (!userId) return { ok: false, error: "course not found" };

    // 1. Wait for this course's queued materials to finish ingesting.
    await step.run("await-ingestion", async () => {
      const deadline = Date.now() + 10 * 60_000;
      for (;;) {
        const { data: pending } = await admin
          .from("materials")
          .select("id")
          .eq("course_id", courseId)
          .is("deleted_at", null)
          .in("status", ["queued", "processing"]);
        if (!pending || pending.length === 0) return "ready";
        if (Date.now() > deadline) return "timeout";
        await new Promise((r) => setTimeout(r, 3000));
      }
    });

    // 2. Notes (depth=standard) — emits theater 'topics' from its outline.
    const noteId = await step.run("create-note", async () => {
      const { data: course } = await admin.from("courses").select("name").eq("id", courseId).single();
      const { data: note } = await admin
        .from("notes")
        .insert({
          course_id: courseId,
          user_id: userId,
          title: `${course?.name ?? "Course"} — Notes`,
          depth: "standard",
        })
        .select("id")
        .single();
      return note?.id as string;
    });
    await step.sendEvent("notes", { name: "notes/requested", data: { noteId, metered: false } });

    // 3. Study plan (after notes so section headings exist as topics).
    await step.run("await-notes", async () => {
      const deadline = Date.now() + 8 * 60_000;
      for (;;) {
        const { data: note } = await admin.from("notes").select("status").eq("id", noteId).maybeSingle();
        if (note?.status === "ready" || note?.status === "failed") return note.status;
        if (Date.now() > deadline) return "timeout";
        await new Promise((r) => setTimeout(r, 2000));
      }
    });
    await step.sendEvent("plan", { name: "plan/requested", data: { courseId } });

    // 4. 20 cards + 3-question warm-up quiz (both exempt from free metering).
    const quizId = await step.run("create-warmup-quiz", async () => {
      const { data: quiz } = await admin
        .from("quizzes")
        .insert({ course_id: courseId, user_id: userId, kind: "quiz", title: "Quick warm-up" })
        .select("id")
        .single();
      return quiz?.id as string;
    });
    await step.sendEvent("cards", {
      name: "cards/requested",
      data: { courseId, count: 20, metered: false },
    });
    await step.sendEvent("warmup-quiz", {
      name: "quiz/requested",
      data: { quizId, n: 3, metered: false },
    });

    // 5. Toolkit tiles pop in as each artifact lands, then done.
    await step.run("await-artifacts", async () => {
      const deadline = Date.now() + 10 * 60_000;
      const emitted = new Set<string>();
      for (;;) {
        const [{ count: cardCount }, { data: quiz }, { count: planCount }] = await Promise.all([
          admin.from("flashcards").select("id", { count: "exact", head: true }).eq("course_id", courseId).is("deleted_at", null),
          admin.from("quizzes").select("status").eq("id", quizId).maybeSingle(),
          admin.from("study_plan_items").select("id", { count: "exact", head: true }).eq("course_id", courseId),
        ]);
        if (!emitted.has("Notes")) { emitted.add("Notes"); await broadcastJobEvent(courseId, { stage: "tool", tool: "Notes" }); }
        if ((cardCount ?? 0) > 0 && !emitted.has("Flashcards")) {
          emitted.add("Flashcards");
          await broadcastJobEvent(courseId, { stage: "tool", tool: "Flashcards" });
        }
        if (quiz?.status === "ready" && !emitted.has("Quiz")) {
          emitted.add("Quiz");
          await broadcastJobEvent(courseId, { stage: "tool", tool: "Quiz" });
        }
        if (!emitted.has("Tutor")) { emitted.add("Tutor"); await broadcastJobEvent(courseId, { stage: "tool", tool: "Tutor" }); }

        const cardsDone = (cardCount ?? 0) > 0;
        const quizDone = quiz?.status === "ready" || quiz?.status === "failed";
        const planDone = (planCount ?? 0) > 0;
        if ((cardsDone && quizDone && planDone) || Date.now() > deadline) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      return "done";
    });

    await step.run("finish", async () => {
      await broadcastJobEvent(courseId, { stage: "done", done: true, warmupQuizId: quizId, noteId });
    });

    return { ok: true, noteId, quizId };
  }
);
