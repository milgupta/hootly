"use client";

import * as React from "react";
import {
  Check,
  FileText,
  Layers,
  ClipboardCheck,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Feature tabs (docs/05 §1): Notes · Flashcards · Practice exams · Tutor.
 *
 * Crossfade is 200ms and — unlike StudyFetch's — never overlaps two blocks of text:
 * it runs in two 100ms halves (fade the old panel out, swap the content, fade the
 * new panel in), so exactly one panel is ever painted. Opacity only, ≤400ms total.
 * Keyboard: roving tabindex with Arrow/Home/End per the WAI-ARIA tabs pattern.
 */

type Feature = {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  body: string;
  points: [string, string, string];
};

const FEATURES: Feature[] = [
  {
    id: "notes",
    label: "Notes",
    icon: FileText,
    headline: "Notes that show their receipts.",
    body: "Ollie reads what you uploaded and writes structured notes — and puts a source chip at the end of every section. Click one and the exact PDF page or recording timestamp opens beside your notes.",
    points: [
      "Page numbers for documents, timestamps for audio and video",
      "Regenerate a single section without touching the rest",
      "Anything Ollie can’t verify against your materials gets flagged, not buried",
    ],
  },
  {
    id: "flashcards",
    label: "Flashcards",
    icon: Layers,
    headline: "Cards that come back right before you’d forget them.",
    body: "Every card is scheduled with FSRS spaced repetition. You rate a card Again, Hard, Good, or Easy — and you see the next due date under each option before you choose.",
    points: [
      "Each rating saves the instant you make it, so a closed tab loses nothing",
      "Write your own cards too — manual cards never count against the free plan",
      "The card back carries the source chip it was made from",
    ],
  },
  {
    id: "exams",
    label: "Practice exams",
    icon: ClipboardCheck,
    headline: "Practice under exam conditions, then see exactly what you missed.",
    body: "Timed exams built from your own material. No feedback until you submit, a question palette for flagging and jumping around, and afterwards the correct answer is always shown — with the reason and the page to reread.",
    points: [
      "Flag questions and navigate them from the palette",
      "Correct answers are never hidden after you submit",
      "Misses can be added straight to your flashcards",
    ],
  },
  {
    id: "tutor",
    label: "Tutor",
    icon: MessagesSquare,
    headline: "A tutor that answers from your course, not the internet.",
    body: "Ask anything about your material. Ollie answers with inline citations you can hover to preview and click to open. If the answer isn’t in your materials, the message says so instead of guessing.",
    points: [
      "Socratic mode guides you to the answer instead of handing it over",
      "A banner appears whenever an answer comes from general knowledge",
      "Won’t write work you’d submit as your own — on purpose",
    ],
  },
];

const FIRST = FEATURES[0] as Feature;

export function FeatureTabs() {
  const [active, setActive] = React.useState<string>(FIRST.id);
  const [shown, setShown] = React.useState<string>(FIRST.id);
  const [visible, setVisible] = React.useState(true);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function select(id: string) {
    if (id === active) return;
    setActive(id);
    setVisible(false); // fade out (100ms) — old text leaves before new text arrives
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setShown(id);
      setVisible(true); // fade in (100ms)
    }, 100);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % FEATURES.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + FEATURES.length) % FEATURES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = FEATURES.length - 1;
    if (next === -1) return;
    e.preventDefault();
    const feature = FEATURES[next];
    if (!feature) return;
    select(feature.id);
    tabRefs.current[next]?.focus();
  }

  const panel = FEATURES.find((f) => f.id === shown) ?? FIRST;
  const PanelIcon = panel.icon;

  return (
    <div>
      <div
        role="tablist"
        aria-label="What Hootly builds"
        className="flex flex-wrap justify-center gap-2"
      >
        {FEATURES.map((f, i) => {
          const selected = f.id === active;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`feature-tab-${f.id}`}
              aria-selected={selected}
              aria-controls="feature-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => select(f.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "focus-ring inline-flex h-10 items-center gap-2 rounded-ctl border px-3.5 text-[14px] font-semibold transition-all duration-150 active:scale-[0.98] md:px-4",
                selected
                  ? "border-primary-border bg-primary-soft text-primary"
                  : "border-border bg-surface text-ink-2 hover:border-primary-border hover:text-ink"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {f.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="feature-panel"
        aria-labelledby={`feature-tab-${panel.id}`}
        tabIndex={0}
        className="focus-ring mt-6 rounded-card border border-border bg-surface p-6 shadow-xs md:mt-8 md:p-8"
      >
        <div
          className={cn(
            "transition-opacity duration-100 ease-out md:min-h-[224px]",
            visible ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex flex-col gap-6 md:flex-row md:gap-10">
            <div className="md:w-1/2">
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-ctl bg-primary-soft text-primary">
                <PanelIcon className="size-5" aria-hidden />
              </span>
              <h3 className="text-h2 text-ink">{panel.headline}</h3>
              <p className="text-body reading-measure mt-3 text-ink-2">{panel.body}</p>
            </div>
            <ul className="flex flex-col gap-3 md:w-1/2">
              {panel.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-body text-ink-2">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
