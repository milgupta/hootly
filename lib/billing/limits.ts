import type { Plan, UsageMetric } from "@/lib/types";

// Single source of truth for plan limits (docs/04 §5 — verbatim).
export const LIMITS = {
  free: { courses: 1, uploads: 3, cards_generated: 50, quizzes_generated: 2, tutor_messages: { limit: 20, per: 'month' } },
  plus: { courses: Infinity, uploads: Infinity, cards_generated: Infinity, quizzes_generated: Infinity, tutor_messages: { limit: Infinity, per: 'month' } },
} as const;

/** Free audio/video uploads capped at 30 minutes (docs/04 §5, published on /pricing). */
export const FREE_AUDIO_MAX_SECONDS = 30 * 60;

/** Per-metric semantics (docs/04 §5, normative):
 *  - courses: LIVE count (non-deleted, non-archived) — deleting frees the slot.
 *  - uploads / cards_generated / quizzes_generated: LIFETIME counters, never decremented.
 *    Manual cards don't count; Quizlet-imported cards DO count.
 *  - tutor_messages: monthly bucket (period_start = first of month). */
export function limitFor(plan: Plan, metric: UsageMetric): number {
  const entry = LIMITS[plan][metric];
  return typeof entry === "number" ? entry : entry.limit;
}

export function isMonthly(metric: UsageMetric): boolean {
  return metric === "tutor_messages";
}

/** period_start bucket key: first of current month for monthly metrics, epoch for lifetime. */
export function periodStart(metric: UsageMetric, now = new Date()): string {
  if (isMonthly(metric)) {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  return "1970-01-01";
}

export function remaining(plan: Plan, metric: UsageMetric, used: number): number {
  const limit = limitFor(plan, metric);
  return Number.isFinite(limit) ? Math.max(0, limit - used) : Infinity;
}
