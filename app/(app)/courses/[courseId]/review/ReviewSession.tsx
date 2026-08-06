"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SourceChip, type SourceChipData } from "@/components/ui/SourceChip";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { cn } from "@/lib/cn";
import { previewIntervals, type ReviewRating } from "@/lib/fsrs";
import type { Course, Flashcard } from "@/lib/types";
import { completeReviewSession, reviewCard } from "./actions";

const RATINGS: { rating: ReviewRating; label: string; key: string }[] = [
  { rating: 1, label: "Again", key: "1" },
  { rating: 2, label: "Hard", key: "2" },
  { rating: 3, label: "Good", key: "3" },
  { rating: 4, label: "Easy", key: "4" },
];

interface FailedSave {
  cardId: string;
  rating: ReviewRating;
  elapsedMs: number;
  index: number;
}

function nextSessionLabel(iso: string): string {
  const due = new Date(iso);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "later today";
  if (days === 1) return "tomorrow";
  return due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Full-screen focus mode (docs/05 §7.3): sidebar hidden behind a fixed overlay,
 * 3D flip on Space/click, ratings on 1–4, and a save after EVERY rating — a
 * closed tab loses nothing (docs/00 trust rule).
 */
export function ReviewSession({
  course,
  cards,
  chipsByChunk,
}: {
  course: Course;
  cards: Flashcard[];
  chipsByChunk: Record<string, SourceChipData>;
}) {
  const router = useRouter();

  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [ratings, setRatings] = React.useState<ReviewRating[]>([]);
  const [nextDue, setNextDue] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<FailedSave[]>([]);
  const [saving, setSaving] = React.useState(0);
  const [exitOpen, setExitOpen] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  const shownAtRef = React.useRef<number>(Date.now());
  const startedAtRef = React.useRef<number>(Date.now());
  const summarySentRef = React.useRef(false);
  const cardRef = React.useRef<HTMLDivElement | null>(null);

  const total = cards.length;
  const done = total > 0 && index >= total;
  const current = index < total ? cards[index] : undefined;

  const previews = React.useMemo(
    () => (current ? previewIntervals(current) : null),
    [current]
  );

  const chip = React.useMemo<SourceChipData | null>(() => {
    const first = current?.source_chunk_ids?.[0];
    return first ? (chipsByChunk[first] ?? null) : null;
  }, [current, chipsByChunk]);

  React.useEffect(() => {
    shownAtRef.current = Date.now();
    // Keep focus on the card so the whole session stays keyboard-driven.
    cardRef.current?.focus();
  }, [index]);

  const exit = React.useCallback(() => {
    router.push(`/courses/${course.id}/cards`);
  }, [router, course.id]);

  const recordDue = React.useCallback((due: string) => {
    setNextDue((prev) => (prev === null || due < prev ? due : prev));
  }, []);

  const rate = React.useCallback(
    (rating: ReviewRating) => {
      const card = current;
      if (!card) return;
      const elapsedMs = Math.min(3_600_000, Math.max(0, Date.now() - shownAtRef.current));
      const sessionLengthSoFar = ratings.length;

      setRatings((prev) => [...prev, rating]);
      setFlipped(false);
      setIndex((i) => i + 1);

      // Per-rating persistence — never batched (docs/05 §7.3).
      setSaving((n) => n + 1);
      void reviewCard(card.id, rating, elapsedMs, sessionLengthSoFar)
        .then((res) => {
          if (res.ok && res.data) recordDue(res.data.due);
          else
            setFailed((f) => [
              ...f,
              { cardId: card.id, rating, elapsedMs, index: sessionLengthSoFar },
            ]);
        })
        .catch(() => {
          setFailed((f) => [
            ...f,
            { cardId: card.id, rating, elapsedMs, index: sessionLengthSoFar },
          ]);
        })
        .finally(() => setSaving((n) => n - 1));
    },
    [current, ratings.length, recordDue]
  );

  const retryFailed = React.useCallback(() => {
    const queue = failed;
    if (queue.length === 0) return;
    setRetrying(true);
    setFailed([]);
    void Promise.all(
      queue.map(async (item) => {
        const res = await reviewCard(item.cardId, item.rating, item.elapsedMs, item.index);
        if (res.ok && res.data) recordDue(res.data.due);
        else setFailed((f) => [...f, item]);
      })
    ).finally(() => setRetrying(false));
  }, [failed, recordDue]);

  // Session summary analytics once the last card is rated.
  React.useEffect(() => {
    if (!done || summarySentRef.current) return;
    summarySentRef.current = true;
    const minutes = Math.round(((Date.now() - startedAtRef.current) / 60_000) * 10) / 10;
    void completeReviewSession({ courseId: course.id, cards: ratings.length, minutes });
  }, [done, course.id, ratings.length]);

  // Keyboard: Space/Enter flips, 1–4 rate, Esc exits (confirm if mid-session).
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (exitOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (!done && ratings.length > 0) setExitOpen(true);
        else exit();
        return;
      }
      if (done || !current) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      if (flipped) {
        const match = RATINGS.find((r) => r.key === e.key);
        if (match) {
          e.preventDefault();
          rate(match.rating);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitOpen, done, current, flipped, ratings.length, rate, exit]);

  const onTrack = ratings.filter((r) => r >= 3).length;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      {/* Top bar: progress + exit */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-3 md:px-6">
        <span className="text-small font-medium text-ink tabular-nums" aria-live="polite">
          {total === 0 ? "0 / 0" : `${Math.min(index + (done ? 0 : 1), total)} / ${total}`}
        </span>
        <div className="max-w-[420px] flex-1">
          <ProgressBar value={index} max={Math.max(1, total)} ariaLabel="Review progress" />
        </div>
        <span className="text-small ml-auto hidden text-ink-3 sm:inline">
          Space to flip · 1–4 to rate · Esc to exit
        </span>
        <button
          onClick={() => (!done && ratings.length > 0 ? setExitOpen(true) : exit())}
          aria-label="Exit review session"
          className="focus-ring rounded-ctl p-1.5 text-ink-2 transition-colors duration-150 hover:bg-bg-subtle hover:text-ink active:scale-95"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {/* Save failures — factual + recoverable (docs/03 §8.10) */}
      {failed.length > 0 && (
        <div className="fade-in flex items-center gap-3 border-b border-border bg-danger-soft px-4 py-2.5 md:px-6">
          <AlertCircle className="size-4 shrink-0 text-danger" aria-hidden />
          <p className="text-small text-ink">
            {failed.length === 1 ? "1 rating didn't save" : `${failed.length} ratings didn't save`} —
            check your connection.
          </p>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={retryFailed} loading={retrying}>
            <RotateCcw className="size-3.5" aria-hidden /> Retry
          </Button>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 md:px-6">
        {total === 0 ? (
          <EmptyState
            ollie={<OllieAnimated mode="idle" size={80} />}
            message="Nothing's due right now. Ollie will line up your next batch when it's time."
            action={<Button onClick={() => router.push(`/courses/${course.id}/cards`)}>Back to course</Button>}
          />
        ) : done ? (
          /* Session end summary (docs/05 §7.3) */
          <div className="fade-in-up flex w-full max-w-[520px] flex-col items-center gap-5 rounded-card border border-border bg-surface p-8 text-center shadow-xs">
            <OllieAnimated mode="success" size={88} />
            <h1 className="text-h1">Session done.</h1>
            <p className="text-body text-ink-2 tabular-nums">
              {ratings.length} reviewed · {onTrack} on track
              {nextDue ? ` · next session ${nextSessionLabel(nextDue)}` : ""}
            </p>
            {saving > 0 && (
              <p className="text-small text-ink-3">Saving your last rating…</p>
            )}
            <Button onClick={() => router.push(`/courses/${course.id}`)}>Back to course</Button>
          </div>
        ) : current ? (
          <div className="flex w-full max-w-[640px] flex-col items-center gap-6">
            {/* Card — 300ms 3D flip on Y (docs/03 §5) */}
            <div className="flip-container w-full">
              {/* role=button rather than <button> — the back face holds the SourceChip,
                  and a button inside a button is invalid HTML. */}
              <div
                ref={cardRef}
                role="button"
                tabIndex={0}
                onClick={() => setFlipped((f) => !f)}
                aria-label={flipped ? "Answer — click or press Space to show the question" : "Question — click or press Space to show the answer"}
                aria-pressed={flipped}
                className={cn(
                  "focus-ring flip-inner block h-[320px] w-full cursor-pointer rounded-card text-left",
                  flipped && "flipped"
                )}
              >
                <div className="flip-face flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface p-8 shadow-xs">
                  <span className="text-micro uppercase text-ink-3">Question</span>
                  <p className="text-h2 max-w-[52ch] text-center text-ink">{current.front}</p>
                  <span className="text-small text-ink-3">Space or click to flip</span>
                </div>
                <div className="flip-face back flex flex-col items-center justify-center gap-3 rounded-card border border-primary-border bg-surface p-8 shadow-xs">
                  <span className="text-micro uppercase text-ink-3">Answer</span>
                  <p className="text-body max-w-[60ch] text-center text-ink">{current.back}</p>
                  {chip && (
                    <span className="mt-1 flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <SourceChip source={chip} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Rating bar — only after the flip, with next-due previews */}
            <div
              className={cn(
                "grid w-full grid-cols-2 gap-2 transition-opacity duration-150 sm:grid-cols-4",
                flipped ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              aria-hidden={!flipped}
            >
              {RATINGS.map((r) => (
                <button
                  key={r.rating}
                  onClick={() => rate(r.rating)}
                  disabled={!flipped}
                  className="focus-ring flex flex-col items-center gap-0.5 rounded-ctl border border-border bg-surface px-3 py-2.5 transition-all duration-150 hover:border-primary-border hover:shadow-md active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="text-body-strong text-ink">
                    {r.label} <span className="text-ink-3">{r.key}</span>
                  </span>
                  <span className="text-small text-ink-2 tabular-nums">
                    {previews ? previews[r.rating] : "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Esc mid-session confirm — nothing is lost, so nothing here is red. */}
      <Modal
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="End this session?"
        description={`${ratings.length} of ${total} reviewed. Everything you've rated is already saved.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setExitOpen(false)}>
            Keep reviewing
          </Button>
          <Button variant="secondary" onClick={exit}>
            End session
          </Button>
        </div>
      </Modal>
    </div>
  );
}
