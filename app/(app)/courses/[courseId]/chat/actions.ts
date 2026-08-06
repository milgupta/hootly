"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI } from "@/lib/ai/openai";
import { env } from "@/lib/env";
import { softDeleteResource } from "@/lib/trash";
import type { ActionResult } from "@/app/(app)/actions";

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function createThread(
  courseId: string
): Promise<ActionResult<{ threadId: string; suggestions: string[] }>> {
  if (!z.string().uuid().safeParse(courseId).success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const { supabase, user } = ctx;

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!course) return { ok: false, error: "Course not found." };

  const { data: thread, error } = await supabase
    .from("chat_threads")
    .insert({ course_id: courseId, user_id: user.id })
    .select("id")
    .single();
  if (error || !thread) return { ok: false, error: "Couldn't start a chat — try again." };

  const suggestions = await suggestQuestions(courseId, course.name);
  revalidatePath(`/courses/${courseId}/chat`);
  return { ok: true, data: { threadId: thread.id, suggestions } };
}

/** Suggested-question chips: 3 questions generated from note headings at thread
 *  creation, cached on the thread (docs/04 §7 mechanism notes). */
async function suggestQuestions(courseId: string, courseName: string): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data: sections } = await admin
    .from("note_sections")
    .select("heading, notes!inner(course_id)")
    .eq("notes.course_id", courseId)
    .limit(12);
  const headings = (sections ?? []).map((s) => s.heading as string);
  if (headings.length === 0) return [];

  const openai = getOpenAI();
  if (!openai) {
    // TODO(key-needed): fall back to heading-derived questions without the model.
    return headings.slice(0, 3).map((h) => `Explain ${h} in simple terms`);
  }
  try {
    const res = await openai.chat.completions.create({
      model: env.modelBulk,
      temperature: 0.4,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `Course: "${courseName}". Topics: ${headings.join(", ")}.
Write 3 short questions a student would ask a tutor about these topics. Each ≤ 60 characters.
Reply JSON: { "questions": ["…","…","…"] }`,
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}") as { questions?: unknown };
    if (Array.isArray(parsed.questions)) {
      return parsed.questions.filter((q): q is string => typeof q === "string").slice(0, 3);
    }
  } catch {
    // Fall through to heading-derived defaults.
  }
  return headings.slice(0, 3).map((h) => `Explain ${h} in simple terms`);
}

export async function setSocratic(threadId: string, socratic: boolean): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(threadId).success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const { error } = await ctx.supabase
    .from("chat_threads")
    .update({ socratic })
    .eq("id", threadId)
    .eq("user_id", ctx.user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  return { ok: true };
}

export async function deleteThread(threadId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(threadId).success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const res = await softDeleteResource("thread", threadId, ctx.user.id);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Citation chip popover content: the cited chunk's excerpt. */
export async function getCitationExcerpt(
  chunkId: string
): Promise<ActionResult<{ excerpt: string }>> {
  if (!z.string().uuid().safeParse(chunkId).success) return { ok: false, error: "Bad request." };
  const ctx = await requireUser();
  if (!ctx) return { ok: false, error: "Sign in first." };
  const { data } = await ctx.supabase.from("chunks").select("content").eq("id", chunkId).maybeSingle();
  if (!data) return { ok: false, error: "That source is no longer available." };
  const content = data.content as string;
  return { ok: true, data: { excerpt: content.length > 400 ? `${content.slice(0, 400)}…` : content } };
}
