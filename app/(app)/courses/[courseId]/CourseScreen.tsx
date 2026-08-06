"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive, FileText, FileQuestion, Layers, MessageCircle, MoreHorizontal,
  Pencil, Plus, RotateCcw, Sparkles, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { UploadPanel } from "@/components/upload/UploadPanel";
import { FirstValueMoment } from "@/components/onboarding/FirstValueMoment";
import { cn } from "@/lib/cn";
import { masteryState } from "@/lib/types";
import type { Course, Flashcard, Material, Note, Quiz, StudyPlanItem } from "@/lib/types";
import { softDelete, restore } from "@/app/(app)/trash/actions";
import { archiveCourse, retryMaterial, updateCourse } from "./actions";

const TABS = ["overview", "notes", "flashcards", "quizzes", "tutor", "plan", "materials"] as const;
type Tab = (typeof TABS)[number];

const KIND_ICONS: Record<string, string> = {
  pdf: "📄", pptx: "📊", docx: "📝", txt: "📃", image: "🖼️", audio: "🎧",
  video: "🎬", youtube: "▶️", pasted: "📋", topic: "💡", quizlet: "🃏",
};

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function CourseScreen({
  course,
  materials,
  notes,
  quizzes,
  cards,
  planItems,
  plan,
  uploadsUsed,
  initialTab,
  autoOpenAdd,
  firstValue,
  warmupQuizId,
}: {
  course: Course;
  materials: Material[];
  notes: Note[];
  quizzes: Quiz[];
  cards: Pick<Flashcard, "id" | "fsrs_state" | "fsrs_scheduled_days" | "fsrs_due" | "suspended">[];
  planItems: StudyPlanItem[];
  plan: "free" | "plus";
  uploadsUsed: number;
  initialTab?: string;
  autoOpenAdd?: boolean;
  firstValue?: boolean;
  warmupQuizId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview"
  );
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(course.name);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(Boolean(autoOpenAdd));
  const [deleteMaterial, setDeleteMaterial] = React.useState<Material | null>(null);
  const [pending, startTransition] = React.useTransition();

  const quizList = quizzes.filter((q) => q.kind === "quiz");
  const examList = quizzes.filter((q) => q.kind === "exam");
  const mastery = { learning: 0, reviewing: 0, mastered: 0 };
  for (const c of cards) mastery[masteryState(c)] += 1;
  const dueCount = cards.filter(
    (c) => !c.suspended && new Date(c.fsrs_due).getTime() <= Date.now()
  ).length;
  const examDays = course.exam_date ? daysUntil(course.exam_date) : null;
  const nextPlanItem = planItems.find((i) => !i.completed_at);

  function selectTab(t: Tab) {
    // Route-backed surfaces live on their own URLs (docs/04 §2 repo layout).
    if (t === "flashcards") return router.push(`/courses/${course.id}/cards`);
    if (t === "tutor") return router.push(`/courses/${course.id}/chat`);
    if (t === "plan") return router.push(`/courses/${course.id}/plan`);
    setTab(t);
    router.replace(`/courses/${course.id}?tab=${t}`, { scroll: false });
  }

  function saveRename() {
    setRenaming(false);
    if (name.trim() === course.name || !name.trim()) return setName(course.name);
    startTransition(async () => {
      const res = await updateCourse({ courseId: course.id, name: name.trim() });
      if (!res.ok) {
        setName(course.name);
        toast(res.error ?? "Couldn't rename.", { kind: "error" });
      } else {
        router.refresh();
      }
    });
  }

  function onDeleteCourse() {
    setDeleteOpen(false);
    startTransition(async () => {
      const res = await softDelete("course", course.id);
      if (res.ok) {
        toast("Course moved to Trash", {
          kind: "success",
          actionLabel: "Undo",
          onAction: () => void restore("course", course.id).then(() => router.refresh()),
        });
        router.push("/home");
      } else {
        toast(res.error ?? "Couldn't delete.", { kind: "error" });
      }
    });
  }

  function onDeleteMaterial(m: Material) {
    setDeleteMaterial(null);
    startTransition(async () => {
      const res = await softDelete("material", m.id);
      if (res.ok) {
        toast("Material moved to Trash", {
          kind: "success",
          actionLabel: "Undo",
          onAction: () => void restore("material", m.id).then(() => router.refresh()),
        });
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't delete.", { kind: "error" });
      }
    });
  }

  return (
    <div>
      {firstValue && (
        <FirstValueMoment courseId={course.id} warmupQuizId={warmupQuizId ?? null} />
      )}

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-[32px] leading-none" aria-hidden>{course.emoji}</span>
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") { setName(course.name); setRenaming(false); }
            }}
            maxLength={120}
            className="focus-ring text-h1 min-w-0 flex-1 rounded-ctl border border-primary-border bg-surface px-2"
            aria-label="Course name"
          />
        ) : (
          <button
            className="focus-ring text-h1 rounded-ctl text-left hover:bg-bg-subtle"
            onClick={() => setRenaming(true)}
            title="Click to rename"
          >
            {course.name}
          </button>
        )}
        {course.exam_date && examDays != null && (
          <span
            className={cn(
              "text-small rounded-full px-2.5 py-1 font-medium tabular-nums",
              examDays <= 7 && examDays >= 0 ? "bg-warning-soft text-warning" : "bg-bg-subtle text-ink-2"
            )}
          >
            {new Date(`${course.exam_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {examDays >= 0 && ` · ${examDays} days`}
          </span>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="focus-ring ml-auto rounded-ctl p-2 text-ink-2 hover:bg-bg-subtle" aria-label="Course menu">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="fade-in-up z-50 min-w-[170px] rounded-card border border-border bg-surface p-1.5 shadow-md">
              <DropdownMenu.Item asChild>
                <button onClick={() => setRenaming(true)} className="focus-ring flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-[14px] text-ink outline-none data-[highlighted]:bg-bg-subtle">
                  <Pencil className="size-4" aria-hidden /> Rename
                </button>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      const res = await archiveCourse(course.id);
                      if (res.ok) { toast("Course archived", { kind: "success" }); router.push("/home"); }
                      else toast(res.error ?? "Couldn't archive.", { kind: "error" });
                    })
                  }
                  className="focus-ring flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-[14px] text-ink outline-none data-[highlighted]:bg-bg-subtle"
                >
                  <Archive className="size-4" aria-hidden /> Archive
                </button>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                {/* Delete is the ONLY red item (docs/05 §6) */}
                <button onClick={() => setDeleteOpen(true)} className="focus-ring flex w-full items-center gap-2 rounded-ctl px-3 py-2 text-left text-[14px] text-danger outline-none data-[highlighted]:bg-danger-soft">
                  <Trash2 className="size-4" aria-hidden /> Delete
                </button>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Course sections">
        {([
          ["overview", "Overview"], ["notes", "Notes"], ["flashcards", "Flashcards"],
          ["quizzes", "Quizzes"], ["tutor", "Tutor"], ["plan", "Plan"], ["materials", "Materials"],
        ] as [Tab, string][]).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={cn(
              "focus-ring relative -mb-px whitespace-nowrap rounded-t-[8px] px-3.5 py-2 text-[14px] font-medium transition-colors duration-150",
              tab === value
                ? "font-semibold text-primary after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
                : "text-ink-2 hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="flex flex-col gap-5">
          {nextPlanItem && (
            <Card className="border-l-4 border-l-primary">
              <p className="text-micro mb-1 uppercase text-ink-3">Up next</p>
              <div className="flex items-center justify-between gap-4">
                <p className="text-body-strong">{nextPlanItem.title}</p>
                <Button size="sm" onClick={() => router.push(`/courses/${course.id}/plan`)}>Start</Button>
              </div>
            </Card>
          )}

          {cards.length > 0 && (
            <Card>
              <h2 className="text-h3 mb-3">Mastery</h2>
              <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-bg-subtle">
                {mastery.mastered > 0 && <div className="bg-success" style={{ width: `${(mastery.mastered / cards.length) * 100}%` }} />}
                {mastery.reviewing > 0 && <div className="bg-primary" style={{ width: `${(mastery.reviewing / cards.length) * 100}%` }} />}
                {mastery.learning > 0 && <div className="bg-warning" style={{ width: `${(mastery.learning / cards.length) * 100}%` }} />}
              </div>
              <p className="text-small text-ink-2 tabular-nums">
                <span className="text-success">●</span> {mastery.mastered} mastered ·{" "}
                <span className="text-primary">●</span> {mastery.reviewing} reviewing ·{" "}
                <span className="text-warning">●</span> {mastery.learning} learning
                {dueCount > 0 && ` · ${dueCount} due now`}
              </p>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Notes", icon: FileText, count: notes.length, href: `?tab=notes`, tab: "notes" as Tab },
              { label: "Flashcards", icon: Layers, count: cards.length, href: `/courses/${course.id}/cards` },
              { label: "Quizzes", icon: FileQuestion, count: quizList.length + examList.length, href: `?tab=quizzes`, tab: "quizzes" as Tab },
              { label: "Tutor", icon: MessageCircle, count: null, href: `/courses/${course.id}/chat` },
            ].map((tool) => (
              <Card
                key={tool.label}
                clickable
                onClick={() => (tool.tab ? selectTab(tool.tab) : router.push(tool.href))}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (tool.tab ? selectTab(tool.tab) : router.push(tool.href))}
              >
                <tool.icon className="mb-2 size-5 text-primary" aria-hidden />
                <p className="text-h3">{tool.label}</p>
                <p className="text-small text-ink-2 tabular-nums">
                  {tool.count == null ? "Ask Ollie" : tool.count === 0 ? "None yet" : tool.count}
                </p>
              </Card>
            ))}
          </div>

          {materials.length === 0 && (
            <Card className="p-0">
              <EmptyState
                ollie={<OllieAnimated mode="idle" size={72} />}
                message="Feed Ollie your materials and the notes, cards, and quizzes build themselves."
                action={<Button onClick={() => { setTab("materials"); setAddOpen(true); }}>Add materials</Button>}
              />
            </Card>
          )}
        </div>
      )}

      {/* NOTES / QUIZZES tab lists arrive with generation (M6) — reachable placeholders now. */}
      {tab === "notes" && (
        <NotesTabPlaceholder notes={notes} courseId={course.id} />
      )}
      {tab === "quizzes" && (
        <QuizzesTabPlaceholder quizzes={quizzes} courseId={course.id} />
      )}

      {/* MATERIALS */}
      {tab === "materials" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h2">Materials</h2>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" aria-hidden /> Add materials
            </Button>
          </div>
          {materials.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                message="Nothing here yet. Drop in slides, notes, or a lecture recording."
                action={<Button onClick={() => setAddOpen(true)}>Add materials</Button>}
              />
            </Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-bg-subtle">
                    {["", "Title", "Kind", "Size / duration", "Status", "Added", ""].map((h, i) => (
                      <th key={i} className="text-small px-4 py-3 font-medium text-ink-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-[18px]" aria-hidden>{KIND_ICONS[m.kind] ?? "📄"}</td>
                      <td className="text-body max-w-[26ch] truncate px-4 py-3" title={m.title}>{m.title}</td>
                      <td className="text-small px-4 py-3 uppercase text-ink-2">{m.kind}</td>
                      <td className="text-small px-4 py-3 text-ink-2 tabular-nums">
                        {m.duration_seconds
                          ? `${Math.floor(m.duration_seconds / 60)}:${String(m.duration_seconds % 60).padStart(2, "0")}`
                          : m.byte_size
                            ? `${(m.byte_size / 1024 / 1024).toFixed(1)}MB`
                            : m.page_count
                              ? `${m.page_count} pages`
                              : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {m.status === "failed" ? (
                          <span className="text-small text-danger" title={m.error_detail ?? undefined}>
                            {m.error_detail ?? "Failed"}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "text-micro rounded-full px-2 py-0.5 font-medium",
                              m.status === "ready" && "bg-success-soft text-success",
                              m.status === "processing" && "bg-primary-soft text-primary",
                              m.status === "queued" && "bg-bg-subtle text-ink-2"
                            )}
                          >
                            {m.status}
                          </span>
                        )}
                      </td>
                      <td className="text-small px-4 py-3 text-ink-2 tabular-nums">
                        {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex justify-end gap-1">
                          {m.status === "failed" && (
                            <Button
                              size="sm" variant="ghost"
                              onClick={() =>
                                startTransition(async () => {
                                  const res = await retryMaterial(m.id);
                                  if (res.ok) { toast("Retrying…", { kind: "info" }); router.refresh(); }
                                  else toast(res.error ?? "Couldn't retry.", { kind: "error" });
                                })
                              }
                            >
                              <RotateCcw className="size-3.5" aria-hidden /> Retry
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" aria-label={`Delete ${m.title}`} onClick={() => setDeleteMaterial(m)}>
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Add materials modal (reuses the onboarding dropzone — docs/05 §6) */}
      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add materials" wide className="p-6">
        <UploadPanel courseId={course.id} plan={plan} uploadsUsed={uploadsUsed} />
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => { setAddOpen(false); router.refresh(); }}>Done</Button>
        </div>
      </Modal>

      {/* Delete course modal (docs/05 §6 verbatim copy) */}
      <Modal open={deleteOpen} onOpenChange={setDeleteOpen} ariaTitle="Delete course">
        <div className="mb-4 flex items-start gap-3">
          <OllieAnimated mode="concerned" size={56} />
          <div>
            <h2 className="text-h2 mb-1">Delete {course.name}?</h2>
            <p className="text-body text-ink-2">
              Everything inside — notes, {cards.length} cards, {quizList.length + examList.length} quizzes — moves
              to Trash for 30 days.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={pending} onClick={onDeleteCourse}>Delete course</Button>
        </div>
      </Modal>

      {/* Delete material warning (docs/05 §6) */}
      <Modal
        open={deleteMaterial !== null}
        onOpenChange={(o) => !o && setDeleteMaterial(null)}
        title={`Delete ${deleteMaterial?.title ?? "material"}?`}
        description="Notes and cards made from it stay. New generations won't use it."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteMaterial(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMaterial && onDeleteMaterial(deleteMaterial)}>
            Delete material
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function NotesTabPlaceholder({ notes, courseId }: { notes: Note[]; courseId: string }) {
  const router = useRouter();
  return notes.length === 0 ? (
    <Card className="p-0">
      <EmptyState
        message="No notes yet. Generate a set from your materials."
        action={
          <Button onClick={() => router.push(`/courses/${courseId}?tab=notes&generate=1`)}>
            <Sparkles className="size-4" aria-hidden /> Generate notes
          </Button>
        }
      />
    </Card>
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {notes.map((n) => (
        <Link key={n.id} href={`/courses/${courseId}/notes/${n.id}`} className="focus-ring rounded-card">
          <Card clickable>
            <h3 className="text-h3 mb-1">{n.title}</h3>
            <p className="text-small text-ink-2 capitalize">{n.depth} · {n.status}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function QuizzesTabPlaceholder({ quizzes, courseId }: { quizzes: Quiz[]; courseId: string }) {
  const router = useRouter();
  return quizzes.length === 0 ? (
    <Card className="p-0">
      <EmptyState
        message="No quizzes yet. Ollie writes them from your materials — answers always shown."
        action={
          <Button onClick={() => router.push(`/courses/${courseId}?tab=quizzes&generate=1`)}>
            <Sparkles className="size-4" aria-hidden /> Generate a quiz
          </Button>
        }
      />
    </Card>
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {quizzes.map((q) => (
        <Link
          key={q.id}
          href={`/courses/${courseId}/${q.kind === "exam" ? "exam" : "quiz"}/${q.id}`}
          className="focus-ring rounded-card"
        >
          <Card clickable>
            <h3 className="text-h3 mb-1">{q.title}</h3>
            <p className="text-small text-ink-2 capitalize">{q.kind} · {q.status}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
