"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Switch from "@radix-ui/react-switch";
import { AlertCircle, BookOpen, Check, Flag, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { SourceChip } from "@/components/ui/SourceChip";
import { useToast } from "@/components/ui/Toast";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { useJobChannel } from "@/lib/useJobChannel";
import { cn } from "@/lib/cn";
import { OPTION_KEYS, optionsFor } from "@/lib/quiz-grading";
import type {
  AnswerFeedback,
  AttemptResults,
  QuizKind,
  QuizQuestionTake,
} from "@/lib/types";
import { addQuestionToFlashcards, retryQuizGeneration } from "./actions";

/** Pieces shared by the quiz engine (docs/05 §7.4) and the exam engine (§7.5).
 *  One engine, two shells — the exam shell simply never passes `feedback`. */

const kindLabel = (kind: QuizKind) => (kind === "exam" ? "exam" : "quiz");

/* ── Question ─────────────────────────────────────────────────────────────── */

export function QuestionView({
  question,
  index,
  total,
  selected,
  onSelect,
  feedback,
  locked,
  inputRef,
  onEnter,
}: {
  question: QuizQuestionTake;
  index: number;
  total: number;
  selected: string | null;
  onSelect: (value: string) => void;
  feedback: AnswerFeedback | null;
  locked: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
}) {
  const options = optionsFor(question.qtype, question.options);
  const revealed = feedback !== null;

  return (
    <div>
      <p className="text-micro mb-2 uppercase text-ink-3 tabular-nums">
        Question {index + 1} of {total}
        {question.topic ? ` · ${question.topic}` : ""}
      </p>
      <h1 className="text-h1 mb-6 max-w-[68ch] text-balance">{question.prompt}</h1>

      {options ? (
        <div role="radiogroup" aria-label="Answer options" className="flex flex-col gap-3">
          {options.map((option, i) => {
            const key = OPTION_KEYS[i] ?? String(i + 1);
            const isChosen = selected === option;
            const isKey = revealed && feedback.correctAnswer === option;
            const chosenWrong = revealed && isChosen && !isKey;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={locked}
                onClick={() => onSelect(option)}
                className={cn(
                  "focus-ring group flex w-full items-center gap-3 rounded-card border bg-surface p-4 text-left shadow-xs transition-all duration-150",
                  "disabled:cursor-default",
                  !revealed &&
                    (isChosen
                      ? "border-primary-border bg-primary-soft"
                      : "border-border hover:border-primary-border hover:shadow-md active:scale-[0.995] disabled:hover:border-border disabled:hover:shadow-xs"),
                  revealed && isKey && isChosen && "border-success bg-success-soft",
                  revealed && isKey && !isChosen && "border-success bg-surface",
                  chosenWrong && "border-danger bg-danger-soft",
                  revealed && !isKey && !isChosen && "border-border opacity-60"
                )}
              >
                <span
                  className={cn(
                    "text-small flex size-7 shrink-0 items-center justify-center rounded-ctl border font-semibold tabular-nums transition-colors duration-150",
                    !revealed && isChosen && "border-primary bg-primary text-white",
                    !revealed && !isChosen && "border-border text-ink-2 group-hover:border-primary-border",
                    revealed && isKey && "border-success bg-success text-white",
                    revealed && chosenWrong && "border-danger bg-danger text-white",
                    revealed && !isKey && !isChosen && "border-border text-ink-3"
                  )}
                  aria-hidden
                >
                  {revealed && isKey ? (
                    <Check className="size-4" />
                  ) : revealed && chosenWrong ? (
                    <X className="size-4" />
                  ) : (
                    key
                  )}
                </span>
                <span className="text-body flex-1 text-ink">{option}</span>
                {revealed && isKey && (
                  <span className="text-micro shrink-0 rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">
                    {isChosen ? "Correct" : "Correct answer"}
                  </span>
                )}
                {chosenWrong && (
                  <span className="text-micro shrink-0 rounded-full bg-danger-soft px-2 py-0.5 font-semibold text-danger">
                    Your answer
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="max-w-[52ch]">
          <Input
            ref={inputRef}
            value={selected ?? ""}
            disabled={locked}
            onChange={(e) => onSelect(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter?.();
              }
            }}
            placeholder="Type your answer"
            aria-label="Your answer"
            autoComplete="off"
          />
        </div>
      )}

      {revealed && !options && (
        <div className="mt-4 flex flex-col gap-2">
          <div
            className={cn(
              "rounded-card border p-4",
              feedback.isCorrect === true
                ? "border-success bg-success-soft"
                : feedback.isCorrect === false
                  ? "border-danger bg-danger-soft"
                  : "border-border bg-bg-subtle"
            )}
          >
            <p className="text-micro mb-1 uppercase text-ink-3">Your answer</p>
            <p className="text-body text-ink">{selected?.trim() ? selected : "— left blank"}</p>
          </div>
          <div className="rounded-card border border-success bg-surface p-4">
            <p className="text-micro mb-1 uppercase text-success">Correct answer</p>
            <p className="text-body text-ink">{feedback.correctAnswer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Feedback (quiz only — instant reveal) ────────────────────────────────── */

export function FeedbackCard({
  feedback,
  autoAddMisses,
  onToggleAutoAdd,
  onSelfAssess,
  selfAssessing,
}: {
  feedback: AnswerFeedback;
  autoAddMisses: boolean;
  onToggleAutoAdd: (value: boolean) => void;
  onSelfAssess?: (isCorrect: boolean) => void;
  selfAssessing?: boolean;
}) {
  const { toast } = useToast();
  const [adding, startAdding] = React.useTransition();

  return (
    <Card className="fade-in-up mt-6">
      <div className="mb-2 flex items-center gap-2">
        {feedback.isCorrect === true ? (
          <>
            <span className="flex size-6 items-center justify-center rounded-full bg-success text-white check-pop">
              <Check className="size-4" aria-hidden />
            </span>
            <p className="text-h3 text-success">Correct</p>
          </>
        ) : feedback.isCorrect === false ? (
          <>
            <span className="flex size-6 items-center justify-center rounded-full bg-danger text-white">
              <X className="size-4" aria-hidden />
            </span>
            <p className="text-h3 text-danger">Not quite</p>
          </>
        ) : (
          <>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-primary">
              <AlertCircle className="size-4" aria-hidden />
            </span>
            <p className="text-h3 text-ink">Close enough? You decide</p>
          </>
        )}
      </div>

      <p className="text-body reading-measure text-ink-2">{feedback.explanation}</p>

      {feedback.isCorrect === null && onSelfAssess && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-small text-ink-2">
            We couldn&rsquo;t match your wording — did you get it right?
          </p>
          <Button size="sm" variant="secondary" disabled={selfAssessing} onClick={() => onSelfAssess(true)}>
            <Check className="size-3.5" aria-hidden /> I got it
          </Button>
          <Button size="sm" variant="ghost" disabled={selfAssessing} onClick={() => onSelfAssess(false)}>
            I missed it
          </Button>
        </div>
      )}

      {feedback.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {feedback.citations.map((citation) => (
            <SourceChip
              key={citation.chunk_id}
              source={{
                chunkId: citation.chunk_id,
                materialTitle: citation.material_title,
                page: citation.page,
                startSeconds: citation.start_seconds,
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          loading={adding}
          onClick={() =>
            startAdding(async () => {
              const res = await addQuestionToFlashcards(feedback.questionId);
              if (!res.ok) toast(res.error ?? "Couldn't add that card.", { kind: "error" });
              else if (res.data?.added) toast("Added to your flashcards", { kind: "success" });
              else toast("Already in your flashcards", { kind: "info" });
            })
          }
        >
          <Plus className="size-3.5" aria-hidden /> Add to flashcards
        </Button>
        <AutoAddToggle value={autoAddMisses} onChange={onToggleAutoAdd} />
      </div>
    </Card>
  );
}

export function AutoAddToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-small select-none text-ink-2">
        Auto-add misses
      </label>
      <Switch.Root
        id={id}
        checked={value}
        onCheckedChange={onChange}
        className={cn(
          "focus-ring relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150",
          value ? "border-primary bg-primary" : "border-border bg-bg-subtle hover:border-primary-border"
        )}
      >
        <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-xs transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
    </div>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */

export function ScoreRing({ pct }: { pct: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * circumference;
  return (
    <div className="relative size-[128px] shrink-0">
      <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden>
        <circle cx="64" cy="64" r={radius} fill="none" stroke="#F3EEFD" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#7C3AED"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-h1 tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

export function ResultsView({
  results,
  kind,
  courseId,
  onRetake,
  onSelfAssess,
  retaking,
}: {
  results: AttemptResults;
  kind: QuizKind;
  courseId: string;
  onRetake: () => void;
  onSelfAssess: (questionId: string, isCorrect: boolean) => void;
  retaking: boolean;
}) {
  const router = useRouter();
  const [showMisses, setShowMisses] = React.useState(false);
  const misses = results.questions.filter((q) => q.isCorrect !== true);
  const unresolved = results.questions.filter((q) => q.isCorrect === null);

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center gap-6">
        <ScoreRing pct={results.scorePct} />
        <div className="min-w-[220px] flex-1">
          <h1 className="text-h1 mb-1">
            {results.correct} of {results.total} correct
          </h1>
          <p className="text-body text-ink-2">
            {results.missesAddedToCards > 0
              ? `${results.missesAddedToCards} missed ${
                  results.missesAddedToCards === 1 ? "question is" : "questions are"
                } now in your flashcard queue.`
              : misses.length === 0
                ? "Clean sweep. Ollie has nothing to add to your cards."
                : "Review the misses below — every answer shows where it came from."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => setShowMisses(true)}
              disabled={misses.length === 0}
              title={misses.length === 0 ? "Nothing missed" : undefined}
            >
              <BookOpen className="size-4" aria-hidden /> Review misses
            </Button>
            <Button variant="ghost" onClick={onRetake} loading={retaking}>
              <RotateCcw className="size-4" aria-hidden /> Retake
            </Button>
            <Button variant="ghost" onClick={() => router.push(`/courses/${courseId}`)}>
              Back to course
            </Button>
          </div>
        </div>
        <OllieAnimated mode={results.scorePct >= 80 ? "success" : "idle"} size={88} />
      </Card>

      {unresolved.length > 0 && (
        <Card>
          <h2 className="text-h3 mb-1">
            {unresolved.length} answer{unresolved.length === 1 ? "" : "s"} need your call
          </h2>
          <p className="text-small mb-3 text-ink-2">
            We couldn&rsquo;t match your wording to the answer key. You know what you meant.
          </p>
          <div className="flex flex-col gap-3">
            {unresolved.map((question) => (
              <div key={question.questionId} className="rounded-card border border-border p-4">
                <p className="text-body-strong mb-1">{question.prompt}</p>
                <p className="text-small text-ink-2">
                  You wrote: <span className="text-ink">{question.given?.trim() || "— left blank"}</span>
                </p>
                <p className="text-small mb-2 text-ink-2">
                  Correct answer: <span className="text-ink">{question.correctAnswer}</span>
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onSelfAssess(question.questionId, true)}>
                    <Check className="size-3.5" aria-hidden /> I got it
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onSelfAssess(question.questionId, false)}>
                    I missed it
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-h3 mb-3">By topic</h2>
        <div className="flex flex-col gap-3">
          {results.topics.map((topic) => {
            const pct = Math.round((topic.correct / topic.total) * 100);
            return (
              <div key={topic.topic}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-body truncate">{topic.topic}</span>
                  <span className="text-small shrink-0 text-ink-2 tabular-nums">
                    {topic.correct}/{topic.total}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-soft">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${pct}%`, opacity: 0.4 + (pct / 100) * 0.6 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {kind === "exam" && results.insights.length > 0 && (
        <Card>
          <h2 className="text-h3 mb-3">What to reread</h2>
          <ul className="flex flex-col gap-2">
            {results.insights.map((insight) => (
              <li key={insight.materialTitle} className="text-body flex items-start gap-2 text-ink">
                <BookOpen className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="tabular-nums">{insight.questions}</span>{" "}
                  {insight.questions === 1 ? "question" : "questions"} came from{" "}
                  <span className="font-semibold">{insight.materialTitle}</span>
                  {insight.pageFrom != null && (
                    <>
                      {" "}
                      — reread{" "}
                      <span className="tabular-nums">
                        {insight.pageTo != null && insight.pageTo !== insight.pageFrom
                          ? `p.${insight.pageFrom}–${insight.pageTo}`
                          : `p.${insight.pageFrom}`}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showMisses && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h2">
              Misses <span className="text-ink-3 tabular-nums">({misses.length})</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowMisses(false)}>
              Hide
            </Button>
          </div>
          {misses.map((question) => (
            <MissCard key={question.questionId} question={question} />
          ))}
        </div>
      )}
    </div>
  );
}

function MissCard({ question }: { question: AttemptResults["questions"][number] }) {
  const { toast } = useToast();
  const [adding, startAdding] = React.useTransition();
  const options = optionsFor(question.qtype, question.options);

  return (
    <Card className="fade-in-up">
      <div className="mb-2 flex items-start gap-2">
        {question.flagged && <Flag className="mt-1 size-4 shrink-0 text-warning" aria-hidden />}
        <p className="text-body-strong">{question.prompt}</p>
      </div>
      {options ? (
        <div className="mb-3 flex flex-col gap-2">
          {options.map((option) => {
            const isKey = option === question.correctAnswer;
            const isChosen = option === question.given;
            return (
              <div
                key={option}
                className={cn(
                  "text-body flex items-center justify-between gap-3 rounded-ctl border px-3 py-2",
                  isKey && "border-success bg-success-soft",
                  isChosen && !isKey && "border-danger bg-danger-soft",
                  !isKey && !isChosen && "border-border text-ink-2"
                )}
              >
                <span>{option}</span>
                {isKey && (
                  <span className="text-micro shrink-0 font-semibold text-success">Correct answer</span>
                )}
                {isChosen && !isKey && (
                  <span className="text-micro shrink-0 font-semibold text-danger">Your answer</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-3 flex flex-col gap-2">
          <p className="text-small text-ink-2">
            You wrote: <span className="text-ink">{question.given?.trim() || "— left blank"}</span>
          </p>
          <div className="rounded-ctl border border-success bg-success-soft px-3 py-2">
            <span className="text-micro mr-2 font-semibold text-success">Correct answer</span>
            <span className="text-body text-ink">{question.correctAnswer}</span>
          </div>
        </div>
      )}
      <p className="text-body reading-measure text-ink-2">{question.explanation}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {question.citations.map((citation) => (
            <SourceChip
              key={citation.chunk_id}
              source={{
                chunkId: citation.chunk_id,
                materialTitle: citation.material_title,
                page: citation.page,
                startSeconds: citation.start_seconds,
              }}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={adding}
          onClick={() =>
            startAdding(async () => {
              const res = await addQuestionToFlashcards(question.questionId);
              if (!res.ok) toast(res.error ?? "Couldn't add that card.", { kind: "error" });
              else if (res.data?.added) toast("Added to your flashcards", { kind: "success" });
              else toast("Already in your flashcards", { kind: "info" });
            })
          }
        >
          <Plus className="size-3.5" aria-hidden /> Add to flashcards
        </Button>
      </div>
    </Card>
  );
}

/* ── Async states: generating · failed · empty (docs/03 §8 rule 10) ───────── */

export function QuizGenerating({ courseId, kind }: { courseId: string; kind: QuizKind }) {
  const router = useRouter();
  // Real job events (docs/04 §8) on the course channel, plus a slow poll so a
  // dropped socket still lands the user on their questions.
  useJobChannel(courseId, (event) => {
    if (event.stage === kind || event.stage === "failed") router.refresh();
  });
  React.useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <OllieAnimated mode="thinking" size={64} />
        <div>
          <h1 className="text-h1">Ollie is writing your questions…</h1>
          <p className="text-body text-ink-2">
            Every question gets checked against your materials before it reaches you.
          </p>
        </div>
      </div>
      <QuizSkeletonBody />
    </div>
  );
}

/** Shared by loading.tsx and the generating state — matches the final layout exactly. */
export function QuizSkeletonBody() {
  return (
    <div>
      <Skeleton className="mb-6 h-1.5 w-full" />
      <Skeleton className="mb-2 h-4 w-40" />
      <Skeleton className="mb-6 h-9 w-3/4" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="mt-6 h-10 w-32 rounded-ctl" />
    </div>
  );
}

export function QuizFailed({
  quizId,
  kind,
  courseId,
}: {
  quizId: string;
  kind: QuizKind;
  courseId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [retrying, startRetry] = React.useTransition();
  return (
    <Card className="border-danger bg-danger-soft">
      <div className="flex flex-wrap items-start gap-3">
        <AlertCircle className="mt-1 size-5 shrink-0 text-danger" aria-hidden />
        <div className="flex-1">
          <h1 className="text-h2 mb-1">Generation hiccuped — retry.</h1>
          <p className="text-body mb-4 text-ink-2">
            Ollie couldn&rsquo;t finish this {kindLabel(kind)}. Nothing else was touched.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={retrying}
              onClick={() =>
                startRetry(async () => {
                  const res = await retryQuizGeneration(quizId);
                  if (!res.ok) toast(res.error ?? "Couldn't retry.", { kind: "error" });
                  else {
                    toast("Retrying…", { kind: "info" });
                    router.refresh();
                  }
                })
              }
            >
              <RotateCcw className="size-4" aria-hidden /> Retry
            </Button>
            <Button variant="ghost" onClick={() => router.push(`/courses/${courseId}`)}>
              Back to course
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function QuizNoQuestions({ courseId, kind }: { courseId: string; kind: QuizKind }) {
  const router = useRouter();
  return (
    <Card className="p-0">
      <EmptyState
        ollie={<OllieAnimated mode="idle" size={72} />}
        message={`This ${kindLabel(kind)} came back empty — add materials and Ollie will write questions worth answering.`}
        action={
          <Button onClick={() => router.push(`/courses/${courseId}?tab=materials&add=1`)}>
            Add materials
          </Button>
        }
      />
    </Card>
  );
}
