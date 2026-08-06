"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInngestEvent } from "@/lib/inngest-send";
import { checkQuota } from "@/lib/billing/usage";
import { capturePostHog } from "@/lib/analytics/server";
import type { ActionResult } from "@/app/(app)/actions";

async function requireOwnedCourse(courseId: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: course } = await supabase
    .from("courses")
    .select("id, name, user_id")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  return course ? { user, course } : null;
}

/** "Generate all" on an empty course + onboarding "Build my study set". */
export async function buildCourse(courseId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(courseId).success) return { ok: false, error: "Bad request." };
  const owned = await requireOwnedCourse(courseId);
  if (!owned) return { ok: false, error: "Course not found." };
  const sent = await sendInngestEvent({ name: "course/build", data: { courseId } });
  if (!sent) return { ok: false, error: "Generation isn't configured yet on this deployment." };
  return { ok: true };
}

export async function requestNotes(input: {
  courseId: string;
  depth: "quick" | "standard" | "comprehensive";
  title?: string;
}): Promise<ActionResult<{ noteId: string }>> {
  const parsed = z
    .object({
      courseId: z.string().uuid(),
      depth: z.enum(["quick", "standard", "comprehensive"]),
      title: z.string().trim().max(200).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const owned = await requireOwnedCourse(input.courseId);
  if (!owned) return { ok: false, error: "Course not found." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };

  const { data: note, error } = await admin
    .from("notes")
    .insert({
      course_id: input.courseId,
      user_id: owned.user.id,
      title: parsed.data.title || `${owned.course.name} — Notes`,
      depth: parsed.data.depth,
    })
    .select("id")
    .single();
  if (error || !note) return { ok: false, error: "Couldn't start generation — try again." };

  await sendInngestEvent({ name: "notes/requested", data: { noteId: note.id } });
  revalidatePath(`/courses/${input.courseId}`);
  return { ok: true, data: { noteId: note.id } };
}

export async function regenerateNoteSection(sectionId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(sectionId).success) return { ok: false, error: "Bad request." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { data: section } = await supabase
    .from("note_sections")
    .select("id, note_id")
    .eq("id", sectionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!section) return { ok: false, error: "Section not found." };
  const sent = await sendInngestEvent({
    name: "notes/section-regenerate",
    data: { sectionId, noteId: section.note_id },
  });
  if (!sent) return { ok: false, error: "Generation isn't configured yet on this deployment." };
  return { ok: true };
}

export async function requestCards(input: {
  courseId: string;
  count: number;
  customFocus?: string | null;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      courseId: z.string().uuid(),
      count: z.number().int().min(1).max(50),
      customFocus: z.string().trim().max(300).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const owned = await requireOwnedCourse(input.courseId);
  if (!owned) return { ok: false, error: "Course not found." };

  const quota = await checkQuota(owned.user.id, "cards_generated", parsed.data.count);
  if (!quota.allowed) {
    await capturePostHog(owned.user.id, "limit_hit", { metric: "cards_generated" });
    return { ok: false, code: "limit_reached", error: "Free flashcard limit reached." };
  }

  const sent = await sendInngestEvent({
    name: "cards/requested",
    data: {
      courseId: input.courseId,
      count: parsed.data.count,
      customFocus: parsed.data.customFocus ?? null,
    },
  });
  if (!sent) return { ok: false, error: "Generation isn't configured yet on this deployment." };
  revalidatePath(`/courses/${input.courseId}/cards`);
  return { ok: true };
}

export async function requestQuiz(input: {
  courseId: string;
  kind: "quiz" | "exam";
  topic?: string | null;
  n?: number;
}): Promise<ActionResult<{ quizId: string }>> {
  const parsed = z
    .object({
      courseId: z.string().uuid(),
      kind: z.enum(["quiz", "exam"]),
      topic: z.string().trim().max(200).nullable().optional(),
      n: z.number().int().min(1).max(60).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const owned = await requireOwnedCourse(input.courseId);
  if (!owned) return { ok: false, error: "Course not found." };

  const quota = await checkQuota(owned.user.id, "quizzes_generated");
  if (!quota.allowed) {
    await capturePostHog(owned.user.id, "limit_hit", { metric: "quizzes_generated" });
    return { ok: false, code: "limit_reached", error: "Free quiz limit reached." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };
  const isExam = parsed.data.kind === "exam";
  const { data: quiz, error } = await admin
    .from("quizzes")
    .insert({
      course_id: input.courseId,
      user_id: owned.user.id,
      kind: parsed.data.kind,
      title: parsed.data.topic
        ? `${parsed.data.topic} ${isExam ? "practice exam" : "quiz"}`
        : `${owned.course.name} ${isExam ? "practice exam" : "quiz"}`,
      topic: parsed.data.topic ?? null,
    })
    .select("id")
    .single();
  if (error || !quiz) return { ok: false, error: "Couldn't start generation — try again." };

  await sendInngestEvent({
    name: isExam ? "exam/requested" : "quiz/requested",
    data: { quizId: quiz.id, n: parsed.data.n ?? (isExam ? 40 : 10) },
  });
  revalidatePath(`/courses/${input.courseId}`);
  return { ok: true, data: { quizId: quiz.id } };
}

export async function requestPlan(courseId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(courseId).success) return { ok: false, error: "Bad request." };
  const owned = await requireOwnedCourse(courseId);
  if (!owned) return { ok: false, error: "Course not found." };
  const sent = await sendInngestEvent({ name: "plan/requested", data: { courseId } });
  if (!sent) return { ok: false, error: "Generation isn't configured yet on this deployment." };
  revalidatePath(`/courses/${courseId}/plan`);
  return { ok: true };
}

/** insufficient_material recovery: "Generate from general knowledge instead"
 *  re-runs the request in topic mode (docs/04 §9, 06 §1.1). */
export async function retryInTopicMode(input: {
  courseId: string;
  artifact: "notes" | "cards" | "quiz";
  topic: string;
}): Promise<ActionResult<{ noteId: string } | { quizId: string } | undefined>> {
  const parsed = z
    .object({
      courseId: z.string().uuid(),
      artifact: z.enum(["notes", "cards", "quiz"]),
      topic: z.string().trim().min(1).max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const owned = await requireOwnedCourse(input.courseId);
  if (!owned) return { ok: false, error: "Course not found." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };

  // A topic marker material makes the course topic-mode for this generation.
  await admin.from("materials").insert({
    course_id: input.courseId,
    user_id: owned.user.id,
    kind: "topic",
    title: parsed.data.topic,
    status: "ready",
  });

  if (parsed.data.artifact === "notes") {
    return await requestNotes({ courseId: input.courseId, depth: "standard" });
  }
  if (parsed.data.artifact === "cards") {
    return await requestCards({ courseId: input.courseId, count: 20 });
  }
  return await requestQuiz({ courseId: input.courseId, kind: "quiz" });
}
