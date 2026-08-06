"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { cn } from "@/lib/cn";
import type { Course, Plan } from "@/lib/types";
import type { TodayPlanItem } from "@/lib/data";
import { completePlanItem, createCourse } from "../actions";
import { LIMITS } from "@/lib/billing/limits";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function planItemHref(item: TodayPlanItem): string {
  const base = `/courses/${item.course_id}`;
  switch (item.kind) {
    case "review_cards":
      return `${base}/review`;
    case "take_quiz":
      return item.target_id ? `${base}/quiz/${item.target_id}` : `${base}/plan`;
    case "take_exam":
      return item.target_id ? `${base}/exam/${item.target_id}` : `${base}/plan`;
    case "read_note":
      return item.target_id ? `${base}/notes/${item.target_id}` : `${base}/plan`;
    default:
      return `${base}/plan`;
  }
}

export function HomeDashboard({
  firstName,
  courses,
  plan,
  todayItems = [],
  dueCards = { count: 0, courseNames: [] },
  courseStats = {},
}: {
  firstName: string;
  courses: Course[];
  plan: Plan;
  todayItems?: TodayPlanItem[];
  dueCards?: { count: number; courseNames: string[] };
  courseStats?: Record<string, { planTotal: number; planDone: number; cardsDue: number }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [newCourseOpen, setNewCourseOpen] = React.useState(false);
  const [courseName, setCourseName] = React.useState("");
  const [examDate, setExamDate] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  const atCourseLimit = plan === "free" && courses.length >= LIMITS.free.courses;

  const nextExam = courses
    .filter((c) => c.exam_date)
    .map((c) => ({ c, days: daysUntil(c.exam_date as string) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  const nextItem = todayItems.find((i) => !i.completed_at && !checked[i.id]);
  const todaySummary =
    todayItems.length > 0
      ? todayItems.map((i) => i.title).slice(0, 2).join(" + ")
      : null;

  function submitNewCourse() {
    startTransition(async () => {
      const res = await createCourse({ name: courseName, examDate: examDate || null });
      if (res.ok && res.data) {
        setNewCourseOpen(false);
        router.push(`/courses/${res.data.courseId}?tab=materials&add=1`);
      } else if (res.code === "limit_reached") {
        setNewCourseOpen(false);
        router.push("/settings?tab=billing&paywall=limit:courses");
      } else {
        toast(res.error ?? "Something went wrong.", { kind: "error" });
      }
    });
  }

  function toggleItem(item: TodayPlanItem, value: boolean) {
    setChecked((c) => ({ ...c, [item.id]: value }));
    startTransition(async () => {
      const res = await completePlanItem(item.id, value);
      if (!res.ok) {
        setChecked((c) => ({ ...c, [item.id]: !value }));
        toast(res.error ?? "Couldn't save — try again.", { kind: "error" });
      }
    });
  }

  return (
    <div>
      <h1 className="text-h1">
        Good {greeting()}, {firstName}.
      </h1>
      <p className="text-body mt-1 text-ink-2">
        {nextExam
          ? `Exam in ${nextExam.days} ${nextExam.days === 1 ? "day" : "days"}${todaySummary ? ` — today: ${todaySummary}` : ""}`
          : "No exam dates yet."}
      </p>

      {courses.length === 0 ? (
        <Card className="mt-8 p-0">
          <EmptyState
            ollie={<OllieAnimated mode="idle" size={80} />}
            message="It's quiet in here. Add your first course and Ollie gets to work."
            action={<Button onClick={() => setNewCourseOpen(true)}>Add a course</Button>}
          />
        </Card>
      ) : (
        <>
          {nextItem && (
            <div className="mt-5">
              <Button onClick={() => router.push(planItemHref(nextItem))}>
                Continue studying
              </Button>
            </div>
          )}

          {todayItems.length > 0 && (
            <Card className="mt-6">
              <h2 className="text-h3 mb-3">Today's plan</h2>
              <ul className="flex flex-col gap-2">
                {todayItems.map((item) => {
                  const done = checked[item.id] ?? Boolean(item.completed_at);
                  return (
                    <li key={item.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`plan-${item.id}`}
                        checked={done}
                        onChange={(e) => toggleItem(item, e.target.checked)}
                        className="focus-ring size-4 accent-[#7C3AED]"
                      />
                      <label
                        htmlFor={`plan-${item.id}`}
                        className={cn("text-body flex-1", done && "text-ink-3 line-through")}
                      >
                        {item.title}
                      </label>
                      <Link
                        href={planItemHref(item)}
                        className="focus-ring text-small rounded font-medium text-primary hover:text-primary-hover"
                      >
                        Open
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {dueCards.count > 0 && (
            <Link
              href={
                courses.length === 1
                  ? `/courses/${courses[0]?.id}/review`
                  : "/home#courses"
              }
              className="focus-ring mt-6 flex items-center justify-between rounded-card border border-primary-border bg-primary-soft px-5 py-4 transition-all duration-150 hover:shadow-md"
            >
              <span className="text-body font-medium text-ink">
                Due for review: {dueCards.count} {dueCards.count === 1 ? "card" : "cards"} across{" "}
                {dueCards.courseNames.length === 1
                  ? dueCards.courseNames[0]
                  : `${dueCards.courseNames.length} courses`}
              </span>
              <span className="text-small font-semibold text-primary">Start session →</span>
            </Link>
          )}

          <div id="courses" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const stats = courseStats[c.id] ?? { planTotal: 0, planDone: 0, cardsDue: 0 };
              const days = c.exam_date ? daysUntil(c.exam_date) : null;
              const pct = stats.planTotal > 0 ? stats.planDone / stats.planTotal : 0;
              return (
                <Link key={c.id} href={`/courses/${c.id}`} className="focus-ring rounded-card">
                  <Card clickable className="h-full">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-[28px] leading-none" aria-hidden>{c.emoji}</span>
                      {days != null && days >= 0 && (
                        <span
                          className={cn(
                            "text-micro rounded-full px-2 py-0.5 font-medium tabular-nums",
                            days <= 7 ? "bg-warning-soft text-warning" : "bg-bg-subtle text-ink-2"
                          )}
                        >
                          Exam in {days}d
                        </span>
                      )}
                    </div>
                    <h3 className="text-h3 truncate" title={c.name}>{c.name}</h3>
                    <div className="mt-3 flex items-center gap-3">
                      <svg width="28" height="28" viewBox="0 0 28 28" aria-label={`Plan ${Math.round(pct * 100)}% complete`}>
                        <circle cx="14" cy="14" r="11" fill="none" stroke="#F3EEFD" strokeWidth="4" />
                        <circle
                          cx="14" cy="14" r="11" fill="none" stroke="#7C3AED" strokeWidth="4"
                          strokeDasharray={`${pct * 69.1} 69.1`}
                          strokeLinecap="round"
                          transform="rotate(-90 14 14)"
                        />
                      </svg>
                      <span className="text-small text-ink-2 tabular-nums">
                        {stats.planTotal > 0 ? `${stats.planDone}/${stats.planTotal} plan items` : "No plan yet"}
                        {stats.cardsDue > 0 && ` · ${stats.cardsDue} cards due`}
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}

            <button
              onClick={() =>
                atCourseLimit
                  ? router.push("/settings?tab=billing&paywall=limit:courses")
                  : setNewCourseOpen(true)
              }
              className="focus-ring flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border bg-bg text-ink-2 transition-all duration-150 hover:border-primary-border hover:text-primary"
            >
              {atCourseLimit ? (
                <>
                  <Lock className="size-5" aria-hidden />
                  <span className="text-small flex items-center gap-1.5 font-medium">
                    New course
                    <span className="text-micro rounded-full bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">Plus</span>
                  </span>
                </>
              ) : (
                <>
                  <Plus className="size-5" aria-hidden />
                  <span className="text-small font-medium">New course</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      <Modal
        open={newCourseOpen}
        onOpenChange={setNewCourseOpen}
        title="New course"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Course name"
            placeholder="e.g. BIO 172 — Human Physiology"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            maxLength={120}
            autoFocus
          />
          <Input
            label="When's the exam? (optional)"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewCourseOpen(false)}>Cancel</Button>
            <Button onClick={submitNewCourse} loading={pending} disabled={!courseName.trim()}>
              Create course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
