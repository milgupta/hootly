"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileQuestion, Layers, GraduationCap, Circle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { cn } from "@/lib/cn";
import type { Course, StudyPlanItem } from "@/lib/types";
import { requestPlan } from "../generate-actions";
import { resolvePlanTarget, togglePlanItem } from "./actions";

type Item = StudyPlanItem & { moved_from?: string | null };

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  read_note: BookOpen,
  review_cards: Layers,
  take_quiz: FileQuestion,
  take_exam: GraduationCap,
  custom: Circle,
};

function weekKey(dateStr: string | null): string {
  if (!dateStr) return "Someday";
  const d = new Date(`${dateStr}T00:00:00`);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function weekLabel(key: string, index: number): string {
  if (key === "Someday") return "Someday";
  const monday = new Date(`${key}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const thisMonday = new Date();
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
  const isThisWeek = monday.getTime() === thisMonday.getTime();
  return `${isThisWeek ? "This week" : `Week ${index + 1}`} · ${fmt(monday)}–${fmt(sunday)}`;
}

export function PlanScreen({
  course,
  items,
}: {
  course: Course;
  items: Item[];
  notes?: { id: string; title: string }[];
  quizzes?: { id: string; title: string; kind: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [rebuildOpen, setRebuildOpen] = React.useState(false);
  const [celebrateWeek, setCelebrateWeek] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const isDone = React.useCallback(
    (item: Item) => checked[item.id] ?? Boolean(item.completed_at),
    [checked]
  );

  const weeks = React.useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const key = weekKey(item.due_date);
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].sort((a, b) => (a[0] === "Someday" ? 1 : b[0] === "Someday" ? -1 : a[0] < b[0] ? -1 : 1));
  }, [items]);

  function toggle(item: Item, value: boolean) {
    setChecked((c) => ({ ...c, [item.id]: value }));
    startTransition(async () => {
      const res = await togglePlanItem(item.id, value);
      if (!res.ok) {
        setChecked((c) => ({ ...c, [item.id]: !value }));
        toast(res.error ?? "Couldn't save — try again.", { kind: "error" });
        return;
      }
      if (value) {
        // Completing all items in a week: Ollie sparkle + message (docs/05 §7.7).
        const key = weekKey(item.due_date);
        const week = weeks.find(([k]) => k === key);
        if (week && week[1].every((i) => (i.id === item.id ? true : isDone(i)))) {
          setCelebrateWeek(key);
          setTimeout(() => setCelebrateWeek(null), 4000);
        }
      }
    });
  }

  function open(item: Item) {
    setResolving(item.id);
    startTransition(async () => {
      const res = await resolvePlanTarget(item.id);
      setResolving(null);
      if (res.ok && res.data) {
        router.push(res.data.href);
      } else if (res.code === "limit_reached") {
        window.dispatchEvent(
          new CustomEvent("hootly:paywall", {
            detail: { context: item.kind === "take_exam" || item.kind === "take_quiz" ? "limit:quizzes_generated" : "limit:cards_generated" },
          })
        );
      } else {
        toast(res.error ?? "Couldn't open that.", { kind: "error" });
      }
    });
  }

  if (items.length === 0) {
    return (
      <Card className="mx-auto max-w-[520px] p-0">
        <EmptyState
          message="No study plan yet. Ollie builds one from your topics and exam date."
          action={
            <Button
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await requestPlan(course.id);
                  if (res.ok) { toast("Building your plan…", { kind: "info" }); router.refresh(); }
                  else toast(res.error ?? "Couldn't build the plan.", { kind: "error" });
                })
              }
            >
              Build my plan
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-h1">Study plan</h1>
        <Button variant="secondary" size="sm" onClick={() => setRebuildOpen(true)}>
          <RefreshCw className="size-3.5" aria-hidden /> Rebuild plan
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {weeks.map(([key, weekItems], weekIndex) => {
          const allDone = weekItems.every(isDone);
          return (
            <section key={key}>
              <h2 className="text-micro mb-2 uppercase text-ink-3">{weekLabel(key, weekIndex)}</h2>
              <Card className="p-0">
                <ul>
                  {weekItems.map((item, i) => {
                    const Icon = KIND_ICON[item.kind] ?? Circle;
                    const done = isDone(item);
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 px-5 py-3.5",
                          i < weekItems.length - 1 && "border-b border-border"
                        )}
                      >
                        <input
                          type="checkbox"
                          id={`item-${item.id}`}
                          checked={done}
                          onChange={(e) => toggle(item, e.target.checked)}
                          className="focus-ring size-4 shrink-0 accent-[#7C3AED]"
                        />
                        <Icon className={cn("size-4 shrink-0", done ? "text-ink-3" : "text-primary")} aria-hidden />
                        <label
                          htmlFor={`item-${item.id}`}
                          className={cn("text-body min-w-0 flex-1", done && "text-ink-3 line-through")}
                        >
                          {item.title}
                          {item.moved_from && (
                            <span className="text-micro ml-2 text-ink-3">
                              moved from{" "}
                              {new Date(`${item.moved_from}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
                            </span>
                          )}
                        </label>
                        {item.due_date && (
                          <span className="text-small hidden shrink-0 text-ink-3 tabular-nums sm:inline">
                            {new Date(`${item.due_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={resolving === item.id}
                          onClick={() => open(item)}
                        >
                          Open
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {allDone && celebrateWeek === key && (
                <div className="fade-in-up mt-3 flex items-center gap-3 rounded-card border border-primary-border bg-primary-soft px-4 py-3">
                  <OllieAnimated mode="success" size={44} />
                  <p className="text-body font-medium text-ink">
                    Week {weekIndex + 1} done. You're ahead of most of your class.
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Modal
        open={rebuildOpen}
        onOpenChange={setRebuildOpen}
        title="Rebuild your plan?"
        description="Ollie re-plans around your current materials and exam date. Items you've already completed stay completed."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRebuildOpen(false)}>Cancel</Button>
          <Button
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await requestPlan(course.id);
                setRebuildOpen(false);
                if (res.ok) { toast("Rebuilding your plan…", { kind: "info" }); router.refresh(); }
                else toast(res.error ?? "Couldn't rebuild.", { kind: "error" });
              })
            }
          >
            Rebuild plan
          </Button>
        </div>
      </Modal>
    </div>
  );
}
