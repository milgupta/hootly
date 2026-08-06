"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { OPTION_KEYS, optionsFor } from "@/lib/quiz-grading";
import type { AnswerFeedback, AttemptResults, Quiz, QuizQuestionTake } from "@/lib/types";
import { FeedbackCard, QuestionView, ResultsView, QuizSkeletonBody } from "./QuizShared";
import {
  completeAttempt,
  selfAssessAnswer,
  setAutoAddMisses,
  startQuizAttempt,
  submitAnswer,
} from "./actions";

/**
 * Quiz take (docs/05 §7.4): one question per screen, progress bar, MCQ options as
 * full-width cards with A–D keys, and INSTANT feedback on submit. The correct
 * answer is always revealed with a why-explanation citing the source — StudyFetch
 * hides it, we never do. Enter submits, then Enter continues.
 */
export function QuizEngine({
  courseId,
  quiz,
  questions,
  initialAttempt,
  answeredCount,
}: {
  courseId: string;
  quiz: Pick<Quiz, "id" | "title" | "kind" | "topic_mode">;
  questions: QuizQuestionTake[];
  initialAttempt: { id: string; autoAddMisses: boolean } | null;
  answeredCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const total = questions.length;

  const [attemptId, setAttemptId] = React.useState<string | null>(initialAttempt?.id ?? null);
  const [autoAdd, setAutoAdd] = React.useState(initialAttempt?.autoAddMisses ?? true);
  const [index, setIndex] = React.useState(Math.min(answeredCount, Math.max(0, total - 1)));
  const [selected, setSelected] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<AnswerFeedback | null>(null);
  const [results, setResults] = React.useState<AttemptResults | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [retaking, setRetaking] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const bootstrapped = React.useRef(false);

  const question = questions[index];
  const options = question ? optionsFor(question.qtype, question.options) : null;
  const isLast = index >= total - 1;

  const finish = React.useCallback(
    async (id: string) => {
      setBusy(true);
      const res = await completeAttempt(id);
      setBusy(false);
      if (!res.ok || !res.data) {
        toast(res.error ?? "Couldn't score this attempt — try again.", { kind: "error" });
        return;
      }
      setResults(res.data);
      router.refresh();
    },
    [router, toast]
  );

  // Resume or open an attempt (a closed tab loses nothing).
  React.useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      let id = attemptId;
      if (!id) {
        const res = await startQuizAttempt(quiz.id);
        if (!res.ok || !res.data) {
          toast(res.error ?? "Couldn't start this quiz — try again.", { kind: "error" });
          return;
        }
        id = res.data.attemptId;
        setAttemptId(id);
        setAutoAdd(res.data.autoAddMisses);
      }
      if (answeredCount >= total && total > 0) await finish(id);
    })();
  }, [answeredCount, attemptId, finish, quiz.id, toast, total]);

  async function onSubmit() {
    if (!attemptId || !question || busy || feedback) return;
    const answer = selected?.trim() ?? "";
    if (answer.length === 0) return;
    setBusy(true);
    const res = await submitAnswer(attemptId, question.id, answer);
    setBusy(false);
    if (!res.ok || !res.data?.feedback) {
      toast(res.error ?? "Couldn't save that answer — try again.", { kind: "error" });
      return;
    }
    setFeedback(res.data.feedback);
  }

  async function onContinue() {
    if (!attemptId || busy) return;
    if (isLast) {
      await finish(attemptId);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
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
    setFeedback((current) =>
      current && current.questionId === questionId ? { ...current, isCorrect } : current
    );
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
    setAutoAdd(res.data.autoAddMisses);
    setResults(null);
    setFeedback(null);
    setSelected(null);
    setIndex(0);
  }

  // Keyboard: A–D pick an option, Enter submits then continues (docs/03 §8 rule 15).
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (results || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "Enter") {
        event.preventDefault();
        void (feedback ? onContinue() : onSubmit());
        return;
      }
      if (typing || !options) return;
      const slot = OPTION_KEYS.indexOf(
        event.key.toUpperCase() as (typeof OPTION_KEYS)[number]
      );
      const choice = slot >= 0 ? options[slot] : undefined;
      if (choice !== undefined && !feedback) {
        event.preventDefault();
        setSelected(choice);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  React.useEffect(() => {
    if (!feedback && !options) inputRef.current?.focus();
  }, [feedback, index, options]);

  if (results) {
    return (
      <ResultsView
        results={results}
        kind="quiz"
        courseId={courseId}
        onRetake={onRetake}
        onSelfAssess={onSelfAssess}
        retaking={retaking}
      />
    );
  }

  if (!question) return <QuizSkeletonBody />;

  return (
    <div className="mx-auto max-w-[780px]">
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-h3 truncate text-ink-2">{quiz.title}</h2>
          <div className="flex items-center gap-2">
            {quiz.topic_mode && (
              <span className="text-micro rounded-full bg-bg-subtle px-2 py-0.5 text-ink-2">
                📖 From general knowledge
              </span>
            )}
            <span className="text-small text-ink-2 tabular-nums">
              {index + 1} / {total}
            </span>
          </div>
        </div>
        <ProgressBar
          value={feedback ? index + 1 : index}
          max={total}
          ariaLabel={`Question ${index + 1} of ${total}`}
        />
      </div>

      <QuestionView
        question={question}
        index={index}
        total={total}
        selected={selected}
        onSelect={(value) => !feedback && setSelected(value)}
        feedback={feedback}
        locked={feedback !== null}
        inputRef={inputRef}
        onEnter={() => void onSubmit()}
      />

      {feedback && (
        <FeedbackCard
          feedback={feedback}
          autoAddMisses={autoAdd}
          onToggleAutoAdd={onToggleAutoAdd}
          onSelfAssess={(isCorrect) => void onSelfAssess(feedback.questionId, isCorrect)}
          selfAssessing={busy}
        />
      )}

      <div className="mt-6 flex items-center gap-3">
        {feedback ? (
          <Button onClick={() => void onContinue()} loading={busy} disabled={!attemptId}>
            {isLast ? "See results" : "Continue"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button
            onClick={() => void onSubmit()}
            loading={busy}
            disabled={!attemptId || !selected?.trim()}
          >
            Submit answer
          </Button>
        )}
        <span className="text-small text-ink-3">
          {options ? "Press A–D to pick · Enter to " : "Press Enter to "}
          {feedback ? "continue" : "submit"}
        </span>
      </div>
    </div>
  );
}
