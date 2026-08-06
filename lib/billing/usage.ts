import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS, limitFor, periodStart } from "@/lib/billing/limits";
import type { Plan, UsageMetric } from "@/lib/types";

/** Server-side usage counters (Class B table — service role writes only).
 *  Lifetime metrics never decrement (docs/04 §5). */

export async function incrementUsage(
  userId: string,
  metric: Exclude<UsageMetric, "courses">,
  by = 1
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return; // TODO(key-needed)
  const bucket = periodStart(metric);
  const { data: existing } = await admin
    .from("usage_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("metric", metric)
    .eq("period_start", bucket)
    .maybeSingle();
  if (existing) {
    await admin
      .from("usage_counters")
      .update({ count: existing.count + by })
      .eq("user_id", userId)
      .eq("metric", metric)
      .eq("period_start", bucket);
  } else {
    await admin
      .from("usage_counters")
      .insert({ user_id: userId, metric, period_start: bucket, count: by });
  }
}

export async function getUsageAdmin(
  userId: string,
  metric: Exclude<UsageMetric, "courses">
): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const { data } = await admin
    .from("usage_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("metric", metric)
    .eq("period_start", periodStart(metric))
    .maybeSingle();
  return data?.count ?? 0;
}

export async function getPlanAdmin(userId: string): Promise<Plan> {
  const admin = createAdminClient();
  if (!admin) return "free";
  const { data } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.plan === "plus" ? "plus" : "free";
}

/** Server-side gate BEFORE any metered action/job enqueue (docs/04 §5).
 *  Returns remaining quota; blocked === limit already reached. */
export async function checkQuota(
  userId: string,
  metric: Exclude<UsageMetric, "courses">,
  needed = 1
): Promise<{ allowed: boolean; used: number; limit: number; plan: Plan }> {
  const plan = await getPlanAdmin(userId);
  const limit = limitFor(plan, metric);
  if (!Number.isFinite(limit)) return { allowed: true, used: 0, limit, plan };
  const used = await getUsageAdmin(userId, metric);
  return { allowed: used + needed <= limit, used, limit, plan };
}

export { LIMITS };
