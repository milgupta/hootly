"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Flag, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { OPTION_KEYS, optionsFor } from "@/lib/quiz-grading";
import type { AttemptResults, Quiz, QuizQuestionTake } from "@/lib/types";
import {
  AutoAddToggle,
  QuestionView,
  ResultsView,
  QuizSkeletonBody,
} from "../../quiz/[quizId]/QuizShared";
import {
  completeAttempt,
  selfAssessAnswer,
  setAutoAddMisses,
  setFlagged,
  startQuizAttempt,
  submitAnswer,
} from "../../quiz/[quizId]/actions";

/**
 * Practice exam (docs/05 §7.5): the quiz engine plus a timer chip, a question
 * palette, "Flag for review", and a submit confirm — and NO per-question feedback
 * until submission. Integrity is enforced server-side: this component only ever
 * holds `quiz_questions_take` rows, and answers arrive from `completeAttempt`.
 */
export function ExamEngine({
  courseId,
  quiz,
  questions,
  initialAttempt,
  initialAnswers,
}: {
  courseId: string;
  quiz: Pick<Quiz, "id" | "title" | "kind" | "topic_mode" | "time_limit_seconds">;
  questions: QuizQuestionTake[];
  initialAttempt: { id: string; autoAddMisses: boolean; startedAt: string } | null;
  initialAnswers: { questionId: string; answer: string | null; flagged: boolean }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const total = questions.length;

  const [attemptId, setAttemptId] = React.useState<string | null>(initialAttempt?.id ?? null);
  const [startedAt, setStartedAt] = React.useState<string | null>(initialAttempt?.startedAt ?? null);
  const [autoAdd, setAutoAdd] = React.useState(initialAttempt?.autoAddMisses ?? true);
  const [index, setIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string | null>>(() =>
    Object.fromEntries(initialAnswers.map((a) => [a.questionId, a.answer]))
  );
  const [flags, setFlags] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialAnswers.map((a) => [a.questionId, a.flagged]))
  );
  const [draft, setDraft] = React.useState<string>("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [results, setResults] = React.useState<AttemptResults | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [retaking, setRetaking] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const bootstrapped = React.useRef(false);
  const submitting = React.useRef(false);

  const question = questions[index];
  const options = question ? optionsFor(question.qtype, question.options) : null;
  const answeredIds = React.useMemo(
    () => new Set(Object.entries(answers).filter(([, v]) => (v ?? "").trim().length > 0).map(([k]) => k)),
    [answers]
  );
  const unanswered = total - questions.filter((q) => answeredIds.has(q.id)).length;

  React.useEffect(() => {
    setDraft(question ? (answers[question.id] ?? "") : "");
    // Only when the visible question changes — the draft owns the field meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, question?.id]);

  const finish = React.useCallback(
    async (id: string) => {
      if (submitting.current) return;
      submitting.current = true;
      setBusy(true);
      const res = await completeAttempt(id);
      setBusy(false);
      submitting.current = false;
      if (!res.ok || !res.data) {
        toast(res.error ?? "Couldn't score this exam — try again.", { kind: "error" });
        return;
      }
      setConfirmOpen(false);
      setResults(res.data);
      router.refresh();
    },
    [router, toast]
  );

  React.useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (attemptId) return;
    void (async () => {
      const res = await startQuizAttempt(quiz.id);
      if (!res.ok || !res.data) {
        toast(res.error ?? "Couldn't start this exam — try again.", { kind: "error" });
        return;
      }
      setAttemptId(res.data.attemptId);
      setStartedAt(res.data.startedAt);
      setAutoAdd(res.data.autoAddMisses);
    })();
  }, [attemptId, quiz.id, toast]);

  /* ── Timer ─────────────────────────────────────────────────────────────── */
  React.useEffect(() => {
    if (!quiz.time_limit_seconds || !startedAt || results) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [quiz.time_limit_seconds, results, startedAt]);

  const limit = quiz.time_limit_seconds ?? 0;
  const remaining =
    limit > 0 && startedAt
      ? Math.max(0, Math.round((new Date(startedAt).getTime() + limit * 1000 - now) / 1000))
      : null;
  const lowOnTime = remaining !== null && limit > 0 && remaining <= limit * 0.2;

  React.useEffect(() => {
    if (remaining === 0 && attemptId && !results) {
      toast("Time's up — your exam was submitted.", { kind: "warning" });
      void finish(attemptId);
    }
  }, [attemptId, finish, remaining, results, toast]);

  /* ── Saving ────────────────────────────────────────────────────────────── */
  const save = React.useCallback(
    async (questionId: string, value: string | null) => {
      if (!attemptId) return;
      const res = await submitAnswer(attemptId, questionId, value, flags[questionId] ?? false);
      if (!res.ok) toast(res.error ?? "Couldn't save that answer — try again.", { kind: "error" });
    },
    [attemptId, flags, toast]
  );

  const commitDraft = React.useCallback(async () => {
    if (!question) return;
    const value = draft.trim().length > 0 ? draft : null;
    if ((answers[question.id] ?? null) === value) return;
    setAnswers((current) => ({ ...current, [question.id]: value }));
    await save(question.id, value);
  }, [answers, draft, question, save]);

  function chooseOption(value: string) {
    if (!question) return;
    setDraft(value);
    setAnswers((current) => ({ ...current, [question.id]: value }));
    void save(question.id, value);
  }

  async function goTo(next: number) {
    if (next < 0 || next >= total) return;
    await commitDraft();
    setIndex(next);
  }

  function toggleFlag() {
    if (!question || !attemptId) return;
    const value = !(flags[question.id] ?? false);
    setFlags((current) => ({ ...current, [question.id]: value }));
    void setFlagged(attemptId, question.id, value).then((res) => {
      if (!res.ok) {
        setFlags((current) => ({ ...current, [question.id]: !value }));
        toast(res.error ?? "Couldn't flag that question.", { kind: "error" });
      }
    });
  }

  async function openConfirm() {
    await commitDraft();
    setConfirmOpen(true);
  }

  function onToggleAutoAdd(value: boolean) {
    setAutoAdd(value);
    if (!attemptId) return;
    void setAutoAddMisses(attemptId, value).then((res) => {
      if (!res.ok) {
        setAutoAdd(!value);
        toast(res.error ?? "Couldn't save that.", { kind: "error" });
      }
    });
  }

  async function onSelfAssess(questionId: string, isCorrect: boolean) {
    if (!attemptId) return;
    const res = await selfAssessAnswer(attemptId, questionId, isCorrect);
    if (!res.ok || !res.data) {
      toast(res.error ?? "Couldn't save that.", { kind: "error" });
      return;
    }
    setResults((current) =>
      current
        ? {
            ...current,
            scorePct: res.data?.scorePct ?? current.scorePct,
            correct: res.data?.correct ?? current.correct,
            questions: current.questions.map((q) =>
              q.questionId === questionId ? { ...q, isCorrect } : q
            ),
          }
        : current
    );
  }

  async function onRetake() {
    setRetaking(true);
    const res = await startQuizAttempt(quiz.id, { restart: true });
    setRetaking(false);
    if (!res.ok || !res.data) {
      toast(res.error ?? "Couldn't start a new attempt — try again.", { kind: "error" });
      return;
    }
    setAttemptId(res.data.attemptId);
    setStartedAt(res.data.startedAt);
    setAutoAdd(res.data.autoAddMisses);
    setAnswers({});
    setFlags({});
    setResults(null);
    setDraft("");
    setIndex(0);
    setNow(Date.now());
  }

  // Keyboard: A–D pick, Enter advances, F flags (docs/03 §8 rule 15).
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (results || confirmOpen || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "Enter") {
        event.preventDefault();
        void (index >= total - 1 ? openConfirm() : goTo(index + 1));
        return;
      }
      if (typing) return;
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFlag();
        return;
      }
      if (!options) return;
      const slot = OPTION_KEYS.indexOf(
        event.key.toUpperCase() as (typeof OPTION_KEYS)[number]
      );
      const choice = slot >= 0 ? options[slot] : undefined;
      if (choice !== undefined) {
        event.preventDefault();
        chooseOption(choice);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (results) {
    return (
      <ResultsView
        results={results}
        kind="exam"
        courseId={courseId}
        onRetake={onRetake}
        onSelfAssess={onSelfAssess}
        retaking={retaking}
      />
    );
  }

  if (!question) return <QuizSkeletonBody />;

  const answeredCount = total - unanswered;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-h3 truncate text-ink-2">{quiz.title}</h2>
            <div className="flex items-center gap-2">
              {quiz.topic_mode && (
                <span className="text-micro rounded-full bg-bg-subtle px-2 py-0.5 text-ink-2">
                  📖 From general knowledge
                </span>
              )}
              {remaining !== null && (
                <span
                  className={cn(
                    "text-small inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium tabular-nums transition-colors duration-150",
                    lowOnTime ? "bg-warning-soft text-warning" : "bg-bg-subtle text-ink-2"
                  )}
                  role="timer"
                  aria-live="off"
                  title={lowOnTime ? "Under 20% of your time left" : "Time remaining"}
                >
                  <Timer className="size-3.5" aria-hidden />
                  {formatClock(remaining)}
                </span>
              )}
              <span className="text-small text-ink-2 tabular-nums">
                {index + 1} / {total}
              </span>
            </div>
          </div>
          <ProgressBar
            value={answeredCount}
            max={total}
            ariaLabel={`${answeredCount} of ${total} answered`}
          />
        </div>

        <QuestionView
          question={question}
          index={index}
          total={total}
          selected={draft.length > 0 ? draft : null}
          onSelect={(value) => (options ? chooseOption(value) : setDraft(value))}
          feedback={null}
          locked={false}
          inputRef={inputRef}
          onEnter={() => void goTo(index + 1)}
        />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => void goTo(index - 1)} disabled={index === 0}>
            <ArrowLeft className="size-4" aria-hidden /> Previous
          </Button>
          <Button
            variant={flags[question.id] ? "secondary" : "ghost"}
            onClick={toggleFlag}
            aria-pressed={Boolean(flags[question.id])}
            className={cn(flags[question.id] && "border-warning text-warning")}
          >
            <Flag className="size-4" aria-hidden />
            {flags[question.id] ? "Flagged" : "Flag for review"}
          </Button>
          {index < total - 1 ? (
            <Button onClick={() => void goTo(index + 1)}>
              Next <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button onClick={() => void openConfirm()} disabled={!attemptId}>
              Submit exam
            </Button>
          )}
          <span className="text-small ml-auto text-ink-3">
            {options ? "A–D to pick · " : ""}F to flag · Enter for next
          </span>
        </div>

        {index < total - 1 && (
          <div className="mt-4">
            <Button variant="ghost" onClick={() => void openConfirm()} disabled={!attemptId}>
              Submit exam
            </Button>
          </div>
        )}
      </div>

      {/* Question palette (docs/05 §7.5) */}
      <Card className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[248px]">
        <h2 className="text-h3 mb-1">Questions</h2>
        <p className="text-small mb-3 text-ink-2 tabular-nums">
          {answeredCount} answered · {unanswered} left
        </p>
        <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-6">
          {questions.map((q, i) => {
            const isAnswered = answeredIds.has(q.id);
            const isFlagged = flags[q.id] ?? false;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => void goTo(i)}
                aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", unanswered"}${
                  isFlagged ? ", flagged" : ""
                }`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "focus-ring relative flex size-8 items-center justify-center rounded-ctl border text-[13px] font-medium tabular-nums transition-all duration-150 hover:shadow-xs active:scale-95",
                  i === index
                    ? "border-primary bg-primary text-white"
                    : isAnswered
                      ? "border-primary-border bg-primary-soft text-primary"
                      : "border-border bg-surface text-ink-2 hover:border-primary-border"
                )}
              >
                {i + 1}
                {isFlagged && (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning ring-2 ring-surface"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="text-small mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-ink-2">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-[4px] border border-primary-border bg-primary-soft" aria-hidden />
            Answered
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-warning" aria-hidden />
            Flagged for review
          </span>
        </div>
        <div className="mt-4">
          <Button className="w-full" onClick={() => void openConfirm()} disabled={!attemptId}>
            Submit exam
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          unanswered > 0 ? `${unanswered} unanswered — submit anyway?` : "Submit your exam?"
        }
        description={
          unanswered > 0
            ? "Unanswered questions count as misses. Every answer and explanation unlocks as soon as you submit."
            : `You answered all ${total} questions. Every answer and explanation unlocks as soon as you submit.`
        }
      >
        <div className="mb-4 rounded-card border border-border bg-bg-subtle p-3">
          <AutoAddToggle value={autoAdd} onChange={onToggleAutoAdd} />
          <p className="text-small mt-1 text-ink-2">
            Missed questions become flashcards — they never count against your AI card limit.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Keep working
          </Button>
          <Button
            loading={busy}
            onClick={() => attemptId && void finish(attemptId)}
            disabled={!attemptId}
          >
            Submit exam
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
