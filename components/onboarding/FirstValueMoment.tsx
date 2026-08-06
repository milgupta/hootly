"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { cn } from "@/lib/cn";
import { captureEvent } from "@/lib/analytics/posthog";
import {
  completeOnboarding, setReferralSource, trackWarmupQuiz,
} from "@/app/onboarding/actions";
import { getWarmupQuestions, type WarmupQuestion } from "@/app/onboarding/warmup-actions";

const TOUR = [
  { title: "Your plan", body: "Ollie schedules what to study each day. Start here when you're not sure what's next." },
  { title: "Your toolkit", body: "Notes, flashcards, quizzes, and practice exams — all built from your materials." },
  { title: "Ask Ollie", body: "Questions about the material? Ollie answers and shows you the exact page it came from." },
];

const REFERRAL_SOURCES = ["Google", "TikTok", "Instagram", "Friend", "YouTube", "Reddit", "ChatGPT", "Other"];

type Phase = "tour" | "warmup" | "success" | "paywall" | "survey" | "done";

/** 4.7 First-value moment (docs/05 §4.7): spotlight tour (3 tooltips max) →
 *  pre-opened 3-question warm-up quiz → success moment → paywall (skippable) →
 *  one-tap referral survey. VALUE BEFORE PAYWALL is a non-negotiable rule. */
export function FirstValueMoment({
  courseId,
  warmupQuizId,
}: {
  courseId: string;
  warmupQuizId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<Phase>("tour");
  const [tourStep, setTourStep] = React.useState(0);
  const [questions, setQuestions] = React.useState<WarmupQuestion[] | null>(null);
  const [qIndex, setQIndex] = React.useState(0);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [revealed, setRevealed] = React.useState(false);
  const [score, setScore] = React.useState(0);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (phase !== "warmup" || questions || !warmupQuizId) return;
    void getWarmupQuestions(warmupQuizId).then((res) => {
      if (res.ok && res.data) setQuestions(res.data.questions);
      else setPhase("paywall");
    });
  }, [phase, questions, warmupQuizId]);

  function finishTour() {
    if (warmupQuizId) setPhase("warmup");
    else setPhase("paywall");
  }

  function answer(option: string) {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);
    const q = questions?.[qIndex];
    if (q && option === q.answer) setScore((s) => s + 1);
  }

  function nextQuestion() {
    const total = questions?.length ?? 0;
    if (qIndex + 1 < total) {
      setQIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
      return;
    }
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    void trackWarmupQuiz(pct);
    captureEvent("warmup_quiz_completed", { score: pct });
    setPhase("success");
  }

  function openPaywall() {
    setPhase("paywall");
    window.dispatchEvent(new CustomEvent("hootly:paywall", { detail: { context: "onboarding" } }));
  }

  // The survey follows the paywall whether it was dismissed or purchased
  // (purchase navigates away to Stripe, so only dismissal reaches this).
  React.useEffect(() => {
    if (phase !== "paywall") return;
    const onClosed = () => setPhase("survey");
    window.addEventListener("hootly:paywall-closed", onClosed);
    return () => window.removeEventListener("hootly:paywall-closed", onClosed);
  }, [phase]);

  function finish(source?: string) {
    startTransition(async () => {
      if (source) await setReferralSource(source);
      await completeOnboarding();
      setPhase("done");
      router.replace(`/courses/${courseId}`);
      router.refresh();
    });
  }

  const question = questions?.[qIndex];

  return (
    <>
      {/* Spotlight tour — 3 tooltips max */}
      <Modal
        open={phase === "tour"}
        onOpenChange={(o) => !o && finishTour()}
        ariaTitle="Quick tour"
        hideClose
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <OllieAnimated mode="idle" size={56} />
            <div>
              <h2 className="text-h2 mb-1">{TOUR[tourStep]?.title}</h2>
              <p className="text-body text-ink-2">{TOUR[tourStep]?.body}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden>
              {TOUR.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-150",
                    i === tourStep ? "w-5 bg-primary" : "w-1.5 bg-primary-soft"
                  )}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={finishTour}>Skip tour</Button>
              <Button
                onClick={() => (tourStep + 1 < TOUR.length ? setTourStep((s) => s + 1) : finishTour())}
              >
                {tourStep + 1 < TOUR.length ? "Next" : "Let's go"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Warm-up quiz — one real action before any paywall */}
      <Modal
        open={phase === "warmup"}
        onOpenChange={(o) => !o && openPaywall()}
        ariaTitle="Quick warm-up"
        wide
        className="p-6"
      >
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-h2">Quick warm-up</h2>
            <p className="text-small text-ink-2 tabular-nums">
              {questions ? `Question ${qIndex + 1} of ${questions.length}` : "Loading your questions…"}
            </p>
          </div>

          {!questions ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : question ? (
            <>
              <p className="text-body-strong">{question.prompt}</p>
              <div className="flex flex-col gap-2">
                {(question.options ?? ["True", "False"]).map((option) => {
                  const isCorrect = option === question.answer;
                  const isChosen = option === selected;
                  return (
                    <button
                      key={option}
                      onClick={() => answer(option)}
                      disabled={revealed}
                      className={cn(
                        "focus-ring rounded-card border px-4 py-3 text-left text-[15px] transition-all duration-150",
                        !revealed && "border-border bg-surface hover:border-primary-border hover:shadow-xs",
                        revealed && isCorrect && "border-success bg-success-soft font-medium text-ink",
                        revealed && isChosen && !isCorrect && "border-danger bg-danger-soft text-ink",
                        revealed && !isChosen && !isCorrect && "border-border bg-surface text-ink-3"
                      )}
                    >
                      {option}
                      {revealed && isCorrect && (
                        <span className="text-micro ml-2 font-semibold text-success">Correct answer</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className="fade-in-up rounded-card border border-border bg-bg-subtle p-4">
                  <p className="text-small text-ink-2">{question.explanation}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={openPaywall}>Skip</Button>
                <Button disabled={!revealed} onClick={nextQuestion}>
                  {questions && qIndex + 1 < questions.length ? "Next question" : "Finish"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      {/* Success moment — confetti-free (brand rule) */}
      <Modal open={phase === "success"} onOpenChange={(o) => !o && openPaywall()} ariaTitle="Nice work" hideClose>
        <div className="flex flex-col items-center gap-4 text-center">
          <OllieAnimated mode="success" size={88} />
          <p className="text-h2">Nice. That's 3 questions down.</p>
          <p className="text-body text-ink-2">Here's your plan for the week.</p>
          <Button onClick={openPaywall}>See my plan</Button>
        </div>
      </Modal>

      {/* Referral survey — after first value, one tap, skippable */}
      <Modal
        open={phase === "survey"}
        onOpenChange={(o) => !o && finish()}
        title="Where'd you hear about us?"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {REFERRAL_SOURCES.map((source) => (
              <button
                key={source}
                onClick={() => finish(source)}
                disabled={pending}
                className="focus-ring rounded-ctl border border-border bg-surface px-3 py-2.5 text-[14px] font-medium text-ink transition-all duration-150 hover:border-primary-border hover:bg-primary-soft disabled:opacity-50"
              >
                {source}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => finish()} loading={pending}>
            Skip
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** Fallback card shown in-course if the warm-up quiz isn't ready yet. */
export function WarmupPendingCard() {
  return (
    <Card className="mb-5 border-l-4 border-l-primary">
      <div className="flex items-center gap-3">
        <OllieAnimated mode="thinking" size={40} />
        <div>
          <p className="text-body-strong">Your warm-up quiz is still being written.</p>
          <p className="text-small text-ink-2">It'll appear on the Quizzes tab in a moment.</p>
        </div>
      </div>
    </Card>
  );
}
