import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { Flashcard } from "@/lib/types";

/** ts-fsrs wrapper (docs/04 §1) — full Card round-trip against the fsrs_* columns. */

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export type FsrsColumns = Pick<
  Flashcard,
  | "fsrs_due"
  | "fsrs_stability"
  | "fsrs_difficulty"
  | "fsrs_elapsed_days"
  | "fsrs_scheduled_days"
  | "fsrs_learning_steps"
  | "fsrs_reps"
  | "fsrs_lapses"
  | "fsrs_state"
  | "fsrs_last_review"
>;

export function rowToCard(row: FsrsColumns): FsrsCard {
  if (row.fsrs_reps === 0 && row.fsrs_state === 0) {
    const empty = createEmptyCard(new Date(row.fsrs_due));
    return empty;
  }
  return {
    due: new Date(row.fsrs_due),
    stability: row.fsrs_stability ?? 0,
    difficulty: row.fsrs_difficulty ?? 0,
    elapsed_days: row.fsrs_elapsed_days,
    scheduled_days: row.fsrs_scheduled_days,
    learning_steps: row.fsrs_learning_steps,
    reps: row.fsrs_reps,
    lapses: row.fsrs_lapses,
    state: row.fsrs_state,
    last_review: row.fsrs_last_review ? new Date(row.fsrs_last_review) : undefined,
  } as FsrsCard;
}

export function cardToRow(card: FsrsCard): FsrsColumns {
  return {
    fsrs_due: card.due.toISOString(),
    fsrs_stability: card.stability,
    fsrs_difficulty: card.difficulty,
    fsrs_elapsed_days: card.elapsed_days,
    fsrs_scheduled_days: card.scheduled_days,
    fsrs_learning_steps: card.learning_steps,
    fsrs_reps: card.reps,
    fsrs_lapses: card.lapses,
    fsrs_state: card.state,
    fsrs_last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export type ReviewRating = 1 | 2 | 3 | 4; // Again / Hard / Good / Easy

/** Apply a rating; returns the updated column values. */
export function scheduleReview(row: FsrsColumns, rating: ReviewRating, now = new Date()): FsrsColumns {
  const card = rowToCard(row);
  const result = scheduler.repeat(card, now)[rating as Grade];
  return cardToRow(result.card);
}

/** Human next-due previews for the rating bar ("<10m · 2d · 4d · 8d"). */
export function previewIntervals(row: FsrsColumns, now = new Date()): Record<ReviewRating, string> {
  const card = rowToCard(row);
  const log = scheduler.repeat(card, now);
  const out = {} as Record<ReviewRating, string>;
  for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
    const due = log[rating].card.due;
    out[rating as ReviewRating] = humanInterval(due.getTime() - now.getTime());
  }
  return out;
}

export function humanInterval(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  // Sub-10-minute steps all render as "<10m" (docs/05 §7.3 rating-bar copy);
  // anything longer gets its real magnitude — never "<30m".
  if (minutes < 10) return "<10m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(months / 12)}y`;
}
