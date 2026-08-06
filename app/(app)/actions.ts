"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/billing/limits";
import { getPlan, getUsage } from "@/lib/data";
import { suggestCourseEmoji } from "@/lib/ai/emoji";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  /** 'limit_reached' opens the paywall (never a dead error — trust rule). */
  code?: string;
  data?: T;
}

const notConfigured: ActionResult<never> = {
  ok: false,
  error: "This deployment isn't connected to a database yet.",
};

const createCourseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  examDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function createCourse(input: {
  name: string;
  examDate?: string | null;
}): Promise<ActionResult<{ courseId: string }>> {
  const parsed = createCourseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Course names are 1–120 characters." };

  const supabase = await createClient();
  if (!supabase) return notConfigured;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  // Server-side limit check BEFORE creating (docs/04 §5) — courses = live count.
  const plan = await getPlan(user.id);
  const liveCourses = await getUsage(user.id, "courses");
  if (liveCourses >= LIMITS[plan].courses) {
    return { ok: false, code: "limit_reached", error: "Course limit reached." };
  }

  const emoji = await suggestCourseEmoji(parsed.data.name);
  const { data, error } = await supabase
    .from("courses")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      emoji,
      exam_date: parsed.data.examDate ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't create the course — try again." };

  revalidatePath("/home");
  return { ok: true, data: { courseId: data.id } };
}

export async function completePlanItem(
  itemId: string,
  completed: boolean
): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(itemId).success) return { ok: false, error: "Bad id." };
  const supabase = await createClient();
  if (!supabase) return notConfigured;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { error } = await supabase
    .from("study_plan_items")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  revalidatePath("/home");
  return { ok: true };
}
