"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { softDeleteResource } from "@/lib/trash";
import type { ActionResult } from "@/app/(app)/actions";

/** Flashcards manage screen (docs/05 §7.2). Manually created cards do NOT count
 *  toward cards_generated — only AI generation costs quota (docs/04 §5). */

const idSchema = z.string().uuid();

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function assertCourseOwned(courseId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

const cardTextSchema = z.object({
  front: z.string().trim().min(1).max(2000),
  back: z.string().trim().min(1).max(4000),
});

/** "New card" (manual) — no quota charge (docs/04 §5). */
export async function createCard(input: {
  courseId: string;
  front: string;
  back: string;
  kind?: "basic" | "reversed" | "cloze";
}): Promise<ActionResult<{ cardId: string }>> {
  const parsed = cardTextSchema
    .extend({
      courseId: idSchema,
      kind: z.enum(["basic", "reversed", "cloze"]).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Front and back can't be empty." };

  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!(await assertCourseOwned(parsed.data.courseId, user.id)))
    return { ok: false, error: "Course not found." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "This deployment isn't connected to a database yet." };

  const { data, error } = await supabase
    .from("flashcards")
    .insert({
      course_id: parsed.data.courseId,
      user_id: user.id,
      kind: parsed.data.kind ?? "basic",
      front: parsed.data.front,
      back: parsed.data.back,
      source_chunk_ids: [],
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't save the card — try again." };

  revalidatePath(`/courses/${parsed.data.courseId}/cards`);
  return { ok: true, data: { cardId: data.id as string } };
}

/** Inline edit modal. */
export async function updateCard(input: {
  cardId: string;
  front: string;
  back: string;
}): Promise<ActionResult> {
  const parsed = cardTextSchema.extend({ cardId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Front and back can't be empty." };

  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "This deployment isn't connected to a database yet." };

  const { data, error } = await supabase
    .from("flashcards")
    .update({ front: parsed.data.front, back: parsed.data.back })
    .eq("id", parsed.data.cardId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("course_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't save the card — try again." };

  revalidatePath(`/courses/${data.course_id as string}/cards`);
  return { ok: true };
}

/** Suspend keeps the card but takes it out of the review queue. */
export async function suspendCard(cardId: string, suspended: boolean): Promise<ActionResult> {
  const parsed = z
    .object({ cardId: idSchema, suspended: z.boolean() })
    .safeParse({ cardId, suspended });
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "This deployment isn't connected to a database yet." };

  const { data, error } = await supabase
    .from("flashcards")
    .update({ suspended: parsed.data.suspended })
    .eq("id", parsed.data.cardId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("course_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't update the card — try again." };

  revalidatePath(`/courses/${data.course_id as string}/cards`);
  return { ok: true };
}

export async function favoriteCard(cardId: string, favorited: boolean): Promise<ActionResult> {
  const parsed = z
    .object({ cardId: idSchema, favorited: z.boolean() })
    .safeParse({ cardId, favorited });
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "This deployment isn't connected to a database yet." };

  const { data, error } = await supabase
    .from("flashcards")
    .update({ favorited: parsed.data.favorited })
    .eq("id", parsed.data.cardId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("course_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't update the card — try again." };

  revalidatePath(`/courses/${data.course_id as string}/cards`);
  return { ok: true };
}

/** Single + bulk delete → soft-delete into Trash for 30 days (docs/04 §4). */
export async function deleteCards(
  cardIds: string[]
): Promise<ActionResult<{ deleted: number }>> {
  const parsed = z.array(idSchema).min(1).max(500).safeParse(cardIds);
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const user = await requireUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "This deployment isn't connected to a database yet." };

  // Ownership check up front so a partial failure can't half-delete someone else's rows.
  const { data: owned } = await supabase
    .from("flashcards")
    .select("id, course_id")
    .in("id", parsed.data)
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const rows = (owned ?? []) as { id: string; course_id: string }[];
  if (rows.length === 0) return { ok: false, error: "Those cards are already gone." };

  let deleted = 0;
  for (const row of rows) {
    const res = await softDeleteResource("flashcard", row.id, user.id);
    if (res.ok) deleted += 1;
  }
  if (deleted === 0) return { ok: false, error: "Couldn't delete — try again." };

  const courseId = rows[0]!.course_id;
  revalidatePath(`/courses/${courseId}/cards`);
  revalidatePath("/trash");
  return { ok: true, data: { deleted } };
}
