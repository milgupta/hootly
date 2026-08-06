"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInngestEvent } from "@/lib/inngest-send";
import { suggestCourseEmoji } from "@/lib/ai/emoji";
import { capturePostHog } from "@/lib/analytics/server";
import { LIMITS } from "@/lib/billing/limits";
import { getUsage } from "@/lib/data";
import type { ActionResult } from "@/app/(app)/actions";

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** 4.1 who → profiles.user_type */
export async function setUserType(userType: "student" | "teacher" | "professional"): Promise<ActionResult> {
  if (!z.enum(["student", "teacher", "professional"]).safeParse(userType).success)
    return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ user_type: userType })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  return { ok: true };
}

/** 4.2 level → profiles.study_level */
export async function setStudyLevel(level: string): Promise<ActionResult> {
  const parsed = z
    .enum(["college", "grad", "high_school", "med", "professional_cert", "standardized_test", "other"])
    .safeParse(level);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const { error } = await ctx.supabase
    .from("profiles")
    .update({ study_level: parsed.data })
    .eq("id", ctx.user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  return { ok: true };
}

/** 4.3 course → create the first course (or update it if the step is revisited). */
export async function createOnboardingCourse(input: {
  courseId?: string | null;
  name: string;
  examDate?: string | null;
}): Promise<ActionResult<{ courseId: string }>> {
  const parsed = z
    .object({
      courseId: z.string().uuid().nullable().optional(),
      name: z.string().trim().min(1).max(120),
      examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Course names are 1–120 characters." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };

  if (parsed.data.courseId) {
    const { data, error } = await ctx.supabase
      .from("courses")
      .update({ name: parsed.data.name, exam_date: parsed.data.examDate ?? null })
      .eq("id", parsed.data.courseId)
      .eq("user_id", ctx.user.id)
      .select("id")
      .maybeSingle();
    if (!error && data) return { ok: true, data: { courseId: data.id } };
  }

  const liveCourses = await getUsage(ctx.user.id, "courses");
  if (liveCourses >= LIMITS.free.courses) {
    const { data: existing } = await ctx.supabase
      .from("courses")
      .select("id")
      .eq("user_id", ctx.user.id)
      .is("deleted_at", null)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, data: { courseId: existing.id } };
  }

  const emoji = await suggestCourseEmoji(parsed.data.name);
  const { data, error } = await ctx.supabase
    .from("courses")
    .insert({
      user_id: ctx.user.id,
      name: parsed.data.name,
      emoji,
      exam_date: parsed.data.examDate ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't create the course — try again." };
  return { ok: true, data: { courseId: data.id } };
}

/** 4.5 calibrate → courses.familiarity */
export async function setFamiliarity(
  courseId: string,
  familiarity: "new" | "some" | "well"
): Promise<ActionResult> {
  const parsed = z
    .object({ courseId: z.string().uuid(), familiarity: z.enum(["new", "some", "well"]) })
    .safeParse({ courseId, familiarity });
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const { error } = await ctx.supabase
    .from("courses")
    .update({ familiarity: parsed.data.familiarity })
    .eq("id", parsed.data.courseId)
    .eq("user_id", ctx.user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  return { ok: true };
}

/** 4.6 building → kick off the build-course orchestrator. */
export async function startCourseBuild(courseId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(courseId).success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const { data: course } = await ctx.supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!course) return { ok: false, error: "Course not found." };

  const { count } = await ctx.supabase
    .from("materials")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .is("deleted_at", null);

  await capturePostHog(ctx.user.id, "onboarding_finished", {
    had_materials: (count ?? 0) > 0,
    material_count: count ?? 0,
  });

  const sent = await sendInngestEvent({ name: "course/build", data: { courseId } });
  if (!sent) return { ok: false, error: "Generation isn't configured yet on this deployment." };
  return { ok: true };
}

/** Step completion analytics (docs/07 §2.2). */
export async function trackStep(
  step: "who" | "level" | "course" | "materials" | "calibrate" | "building",
  secondsOnStep: number
): Promise<void> {
  const ctx = await requireUser();
  if (!ctx) return;
  await capturePostHog(ctx.user.id, "onboarding_step_completed", {
    step,
    seconds_on_step: Math.round(secondsOnStep),
  });
}

/** 4.7 referral survey → profiles.referral_source */
export async function setReferralSource(source: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(1).max(60).safeParse(source);
  if (!parsed.success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  await ctx.supabase
    .from("profiles")
    .update({ referral_source: parsed.data })
    .eq("id", ctx.user.id);
  await capturePostHog(ctx.user.id, "referral_source_answered", { source: parsed.data });
  return { ok: true };
}

/** Marks onboarding complete so /auth/callback routes to /home from now on. */
export async function completeOnboarding(): Promise<ActionResult> {
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const admin = createAdminClient();
  const client = admin ?? ctx.supabase;
  await client
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", ctx.user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Warm-up quiz completion (docs/05 §4.7). */
export async function trackWarmupQuiz(score: number): Promise<void> {
  const ctx = await requireUser();
  if (!ctx) return;
  await capturePostHog(ctx.user.id, "warmup_quiz_completed", { score });
}
