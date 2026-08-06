import "server-only";
import { createClient } from "@/lib/supabase/server";
import { periodStart } from "@/lib/billing/limits";
import type {
  Course,
  Plan,
  Profile,
  Subscription,
  UsageMetric,
} from "@/lib/types";

/** Server-side reads (RLS as the signed-in user). All return safe fallbacks
 *  when Supabase env is missing so screens still render. */

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data as Profile | null;
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as Subscription | null;
}

export async function getPlan(userId: string): Promise<Plan> {
  const sub = await getSubscription(userId);
  return sub?.plan === "plus" ? "plus" : "free";
}

export async function getLiveCourses(userId: string): Promise<Course[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as Course[];
}

export async function getUsage(userId: string, metric: UsageMetric): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  if (metric === "courses") {
    const { count } = await supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("archived_at", null);
    return count ?? 0;
  }
  const { data } = await supabase
    .from("usage_counters")
    .select("count")
    .eq("user_id", userId)
    .eq("metric", metric)
    .eq("period_start", periodStart(metric))
    .maybeSingle();
  return data?.count ?? 0;
}

export async function getAllUsage(userId: string): Promise<Record<UsageMetric, number>> {
  const [courses, uploads, cards, quizzes, tutor] = await Promise.all([
    getUsage(userId, "courses"),
    getUsage(userId, "uploads"),
    getUsage(userId, "cards_generated"),
    getUsage(userId, "quizzes_generated"),
    getUsage(userId, "tutor_messages"),
  ]);
  return {
    courses,
    uploads,
    cards_generated: cards,
    quizzes_generated: quizzes,
    tutor_messages: tutor,
  };
}

export interface TodayPlanItem {
  id: string;
  course_id: string;
  title: string;
  kind: string;
  topic: string | null;
  target_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  course_name: string;
  course_emoji: string;
}

/** Today's plan: incomplete items due today or earlier, across live courses. */
export async function getTodayPlanItems(userId: string, limit = 3): Promise<TodayPlanItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("study_plan_items")
    .select("id, course_id, title, kind, topic, target_id, due_date, completed_at, courses!inner(name, emoji, deleted_at, archived_at)")
    .eq("user_id", userId)
    .is("completed_at", null)
    .lte("due_date", today)
    .is("courses.deleted_at", null)
    .is("courses.archived_at", null)
    .order("due_date", { ascending: true })
    .order("idx", { ascending: true })
    .limit(limit);
  return (data ?? []).map((row) => {
    const course = row.courses as unknown as { name: string; emoji: string };
    return {
      id: row.id as string,
      course_id: row.course_id as string,
      title: row.title as string,
      kind: row.kind as string,
      topic: (row.topic ?? null) as string | null,
      target_id: (row.target_id ?? null) as string | null,
      due_date: (row.due_date ?? null) as string | null,
      completed_at: (row.completed_at ?? null) as string | null,
      course_name: course?.name ?? "",
      course_emoji: course?.emoji ?? "📚",
    };
  });
}

/** Cards due for review right now: total + distinct course names. */
export async function getDueCards(userId: string): Promise<{ count: number; courseNames: string[] }> {
  const supabase = await createClient();
  if (!supabase) return { count: 0, courseNames: [] };
  const { data } = await supabase
    .from("flashcards")
    .select("course_id, courses!inner(name, deleted_at, archived_at)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("suspended", false)
    .lte("fsrs_due", new Date().toISOString())
    .is("courses.deleted_at", null)
    .is("courses.archived_at", null);
  const rows = data ?? [];
  const names = new Set<string>();
  for (const row of rows) {
    const course = row.courses as unknown as { name: string };
    if (course?.name) names.add(course.name);
  }
  return { count: rows.length, courseNames: [...names] };
}

/** Per-course plan completion ratio + due-card count for the dashboard grid. */
export async function getCourseDashboardStats(
  userId: string,
  courseIds: string[]
): Promise<Record<string, { planTotal: number; planDone: number; cardsDue: number }>> {
  const supabase = await createClient();
  const stats: Record<string, { planTotal: number; planDone: number; cardsDue: number }> = {};
  for (const id of courseIds) stats[id] = { planTotal: 0, planDone: 0, cardsDue: 0 };
  if (!supabase || courseIds.length === 0) return stats;
  const [{ data: planRows }, { data: dueRows }] = await Promise.all([
    supabase
      .from("study_plan_items")
      .select("course_id, completed_at")
      .eq("user_id", userId)
      .in("course_id", courseIds),
    supabase
      .from("flashcards")
      .select("course_id")
      .eq("user_id", userId)
      .in("course_id", courseIds)
      .is("deleted_at", null)
      .eq("suspended", false)
      .lte("fsrs_due", new Date().toISOString()),
  ]);
  for (const row of planRows ?? []) {
    const s = stats[row.course_id as string];
    if (!s) continue;
    s.planTotal += 1;
    if (row.completed_at) s.planDone += 1;
  }
  for (const row of dueRows ?? []) {
    const s = stats[row.course_id as string];
    if (s) s.cardsDue += 1;
  }
  return stats;
}
