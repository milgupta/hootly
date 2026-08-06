"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestQuiz, requestNotes } from "../generate-actions";
import type { ActionResult } from "@/app/(app)/actions";

/** Lazy target resolution (docs/04 §4): a plan item's target_id is filled when a
 *  matching artifact exists, or the artifact is generated on first click —
 *  respecting limits (limit_reached opens the paywall, never a dead error). */
export async function resolvePlanTarget(
  itemId: string
): Promise<ActionResult<{ href: string }>> {
  if (!z.string().uuid().safeParse(itemId).success) return { ok: false, error: "Bad request." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data: item } = await supabase
    .from("study_plan_items")
    .select("*")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return { ok: false, error: "Plan item not found." };

  const courseId = item.course_id as string;
  const base = `/courses/${courseId}`;

  if (item.kind === "review_cards") return { ok: true, data: { href: `${base}/review` } };
  if (item.kind === "custom") return { ok: true, data: { href: base } };

  // Already resolved?
  if (item.target_id) {
    const href =
      item.kind === "read_note"
        ? `${base}/notes/${item.target_id}`
        : item.kind === "take_exam"
          ? `${base}/exam/${item.target_id}`
          : `${base}/quiz/${item.target_id}`;
    return { ok: true, data: { href } };
  }

  const admin = createAdminClient();

  if (item.kind === "read_note") {
    // Match an existing note by topic, else generate one.
    const { data: notes } = await supabase
      .from("notes")
      .select("id, title")
      .eq("course_id", courseId)
      .is("deleted_at", null)
      .eq("status", "ready");
    const topic = ((item.topic as string | null) ?? "").toLowerCase();
    const match =
      (notes ?? []).find((n) => topic && (n.title as string).toLowerCase().includes(topic)) ??
      (notes ?? [])[0];
    if (match) {
      await admin?.from("study_plan_items").update({ target_id: match.id }).eq("id", itemId);
      return { ok: true, data: { href: `${base}/notes/${match.id}` } };
    }
    const res = await requestNotes({ courseId, depth: "standard" });
    if (!res.ok || !res.data) return { ok: false, code: res.code, error: res.error };
    await admin?.from("study_plan_items").update({ target_id: res.data.noteId }).eq("id", itemId);
    return { ok: true, data: { href: `${base}/notes/${res.data.noteId}` } };
  }

  // take_quiz / take_exam
  const isExam = item.kind === "take_exam";
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, topic")
    .eq("course_id", courseId)
    .eq("kind", isExam ? "exam" : "quiz")
    .eq("status", "ready")
    .is("deleted_at", null);
  const topic = ((item.topic as string | null) ?? "").toLowerCase();
  const match = (quizzes ?? []).find(
    (q) => topic && ((q.topic as string | null)?.toLowerCase() === topic || (q.title as string).toLowerCase().includes(topic))
  );
  if (match) {
    await admin?.from("study_plan_items").update({ target_id: match.id }).eq("id", itemId);
    return { ok: true, data: { href: `${base}/${isExam ? "exam" : "quiz"}/${match.id}` } };
  }

  const res = await requestQuiz({
    courseId,
    kind: isExam ? "exam" : "quiz",
    topic: (item.topic as string | null) ?? null,
  });
  if (!res.ok || !res.data) return { ok: false, code: res.code, error: res.error };
  await admin?.from("study_plan_items").update({ target_id: res.data.quizId }).eq("id", itemId);
  return { ok: true, data: { href: `${base}/${isExam ? "exam" : "quiz"}/${res.data.quizId}` } };
}

export async function togglePlanItem(itemId: string, completed: boolean): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(itemId).success) return { ok: false, error: "Bad request." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { data: item, error } = await supabase
    .from("study_plan_items")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("course_id")
    .maybeSingle();
  if (error || !item) return { ok: false, error: "Couldn't save — try again." };
  revalidatePath(`/courses/${item.course_id}/plan`);
  revalidatePath("/home");
  return { ok: true };
}
