"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { scheduleReview, type FsrsColumns, type ReviewRating } from "@/lib/fsrs";
import { capturePostHog } from "@/lib/analytics/server";
import type { ActionResult } from "@/app/(app)/actions";

/** Review session (docs/05 §7.3). Persistence is PER RATING, never batched —
 *  a closed tab loses nothing (docs/00 trust rule). */

const ratingSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export async function reviewCard(
  cardId: string,
  rating: number,
  elapsedMs: number,
  sessionLengthSoFar = 0
): Promise<ActionResult<{ due: string; scheduledDays: number; state: number }>> {
  const parsed = z
    .object({
      cardId: z.string().uuid(),
      rating: ratingSchema,
      elapsedMs: z.number().int().min(0).max(3_600_000),
      sessionLengthSoFar: z.number().int().min(0).max(10_000),
    })
    .safeParse({ cardId, rating, elapsedMs, sessionLengthSoFar });
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "This deployment isn't connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data: card } = await supabase
    .from("flashcards")
    .select(
      "id, course_id, fsrs_due, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_learning_steps, fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review"
    )
    .eq("id", parsed.data.cardId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!card) return { ok: false, error: "Card not found." };

  const next = scheduleReview(card as unknown as FsrsColumns, parsed.data.rating as ReviewRating);

  const { error: updateError } = await supabase
    .from("flashcards")
    .update(next)
    .eq("id", parsed.data.cardId)
    .eq("user_id", user.id);
  if (updateError) return { ok: false, error: "Couldn't save that rating — try again." };

  // Review log row (powers streaks/insights + honest history).
  const { error: logError } = await supabase.from("card_reviews").insert({
    card_id: parsed.data.cardId,
    user_id: user.id,
    rating: parsed.data.rating,
    elapsed_ms: parsed.data.elapsedMs,
  });
  if (logError) return { ok: false, error: "Couldn't save that rating — try again." };

  await capturePostHog(user.id, "card_reviewed", {
    rating: parsed.data.rating,
    course_id: card.course_id as string,
    session_length_so_far: parsed.data.sessionLengthSoFar,
  });

  return {
    ok: true,
    data: {
      due: next.fsrs_due,
      scheduledDays: next.fsrs_scheduled_days,
      state: next.fsrs_state,
    },
  };
}

/** Session summary analytics + cache invalidation. Ratings are already saved. */
export async function completeReviewSession(input: {
  courseId: string;
  cards: number;
  minutes: number;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      courseId: z.string().uuid(),
      cards: z.number().int().min(0).max(10_000),
      minutes: z.number().min(0).max(1_440),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "This deployment isn't connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  await capturePostHog(user.id, "review_session_completed", {
    cards: parsed.data.cards,
    minutes: parsed.data.minutes,
  });

  revalidatePath(`/courses/${parsed.data.courseId}/cards`);
  revalidatePath(`/courses/${parsed.data.courseId}`);
  revalidatePath("/home");
  return { ok: true };
}
