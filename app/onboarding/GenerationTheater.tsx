"use client";

import * as React from "react";
import { Check, FileText, Layers, FileQuestion, MessageCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { cn } from "@/lib/cn";
import { useJobChannel, type JobEvent } from "@/lib/useJobChannel";

/** 4.6 GENERATION THEATER (docs/05 §4.6). Driven ENTIRELY by real build-course
 *  events on the Realtime channel — no fake timers anywhere (docs/04 §8). If a
 *  job outruns the animation, events queue and play at ≤150ms intervals. */

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Notes: FileText,
  Flashcards: Layers,
  Quiz: FileQuestion,
  Tutor: MessageCircle,
};

interface TheaterState {
  topics: string[];
  planItems: string[];
  tools: string[];
  topicsDone: boolean;
  planDone: boolean;
  toolsDone: boolean;
  done: boolean;
  failures: Record<string, string>;
  noteId?: string;
  warmupQuizId?: string;
}

const EMPTY: TheaterState = {
  topics: [], planItems: [], tools: [],
  topicsDone: false, planDone: false, toolsDone: false, done: false, failures: {},
};

export function GenerationTheater({
  courseId,
  onOpenCourse,
  onRetry,
}: {
  courseId: string;
  onOpenCourse: (state: { noteId?: string; warmupQuizId?: string }) => void;
  onRetry: () => void;
}) {
  const [state, setState] = React.useState<TheaterState>(EMPTY);
  const queue = React.useRef<JobEvent[]>([]);
  const draining = React.useRef(false);

  // Events queue and play at ≤150ms intervals so the animation reads cleanly
  // even when the backend finishes faster than the eye can follow.
  const apply = React.useCallback((e: JobEvent) => {
    setState((s) => {
      const next = { ...s, failures: { ...s.failures } };
      switch (e.stage) {
        case "topics": {
          const headings = (e.headings as string[] | undefined) ?? [];
          next.topics = headings;
          next.topicsDone = headings.length > 0;
          break;
        }
        case "notes_section":
          next.topicsDone = true;
          break;
        case "plan_item": {
          const title = e.title as string | undefined;
          if (title && !next.planItems.includes(title)) next.planItems = [...next.planItems, title];
          break;
        }
        case "plan":
          if (e.status === "ready") next.planDone = true;
          break;
        case "tool": {
          const tool = e.tool as string | undefined;
          if (tool && !next.tools.includes(tool)) next.tools = [...next.tools, tool];
          if (next.tools.length >= 4) next.toolsDone = true;
          break;
        }
        case "done":
          next.done = true;
          next.topicsDone = true;
          next.planDone = true;
          next.toolsDone = true;
          if (typeof e.noteId === "string") next.noteId = e.noteId;
          if (typeof e.warmupQuizId === "string") next.warmupQuizId = e.warmupQuizId;
          break;
        case "failed": {
          const artifact = (e.artifact as string | undefined) ?? "build";
          next.failures[artifact] =
            (e.error_detail as string | undefined) ?? "Generation hiccuped — retry.";
          break;
        }
        default:
          break;
      }
      return next;
    });
  }, []);

  const drain = React.useCallback(() => {
    if (draining.current) return;
    draining.current = true;
    const tick = () => {
      const e = queue.current.shift();
      if (!e) {
        draining.current = false;
        return;
      }
      apply(e);
      window.setTimeout(tick, 150);
    };
    tick();
  }, [apply]);

  useJobChannel(courseId, (e) => {
    queue.current.push(e);
    drain();
  });

  const cards = [
    {
      key: "topics",
      title: "Topics",
      done: state.topicsDone,
      failure: state.failures.notes,
      body:
        state.topics.length === 0 ? (
          <PendingRows label="Finding your topics…" />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {state.topics.map((t, i) => (
              <li key={t} className="fade-in-up flex items-center gap-2" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="check-pop flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white">
                  <Check className="size-2.5" aria-hidden />
                </span>
                <span className="text-small text-ink">{t}</span>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: "plan",
      title: "Study plan",
      done: state.planDone,
      failure: state.failures.plan,
      body:
        state.planItems.length === 0 ? (
          <PendingRows label="Planning your week…" />
        ) : (
          <ol className="flex flex-col gap-1.5">
            {state.planItems.map((item, i) => (
              <li key={item} className="flex gap-2">
                <span className="text-small shrink-0 text-ink-3 tabular-nums">{i + 1}.</span>
                <Typewriter text={item} />
              </li>
            ))}
          </ol>
        ),
    },
    {
      key: "tools",
      title: "Your toolkit",
      done: state.toolsDone,
      failure: state.failures.cards ?? state.failures.quiz,
      body: (
        <div className="grid grid-cols-2 gap-2">
          {["Notes", "Flashcards", "Quiz", "Tutor"].map((tool) => {
            const Icon = TOOL_ICONS[tool] ?? FileText;
            const ready = state.tools.includes(tool);
            return (
              <div
                key={tool}
                className={cn(
                  "flex items-center gap-2 rounded-ctl border px-3 py-2.5 transition-all duration-200",
                  ready
                    ? "fade-in-up border-primary-border bg-primary-soft"
                    : "border-border bg-bg-subtle opacity-50"
                )}
              >
                <Icon className={cn("size-4 shrink-0", ready ? "text-primary" : "text-ink-3")} aria-hidden />
                <span className={cn("text-small font-medium", ready ? "text-ink" : "text-ink-3")}>{tool}</span>
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <OllieAnimated mode={state.done ? "success" : "thinking"} size={88} />
        <h1 className="text-h1">
          {state.done ? "Ready when you are." : <Typewriter text="Building your study set…" as="span" />}
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        {cards.map((card) => (
          <Card key={card.key}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-h3">{card.title}</h2>
              {card.done && !card.failure && (
                <span className="check-pop text-micro flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">
                  <Check className="size-3" aria-hidden /> Done
                </span>
              )}
            </div>
            {card.failure ? (
              <div className="flex items-center justify-between gap-3 rounded-ctl bg-danger-soft px-3 py-2.5">
                <span className="text-small text-ink">{card.failure}</span>
                <Button size="sm" variant="ghost" onClick={onRetry}>
                  <RotateCcw className="size-3.5" aria-hidden /> Retry
                </Button>
              </div>
            ) : (
              card.body
            )}
          </Card>
        ))}
      </div>

      {state.done && (
        <div className="fade-in-up mt-6 flex justify-center">
          <Button onClick={() => onOpenCourse({ noteId: state.noteId, warmupQuizId: state.warmupQuizId })}>
            Open my course →
          </Button>
        </div>
      )}
    </div>
  );
}

/** Never a blank screen between steps (docs/05 §4.6) — placeholder rows. */
function PendingRows({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-small text-ink-3">{label}</p>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${70 - i * 12}%` }} />
      ))}
    </div>
  );
}

/** Typewriter at ~25ms/char (docs/03 §5), reduced-motion safe. */
function Typewriter({ text, as = "p" }: { text: string; as?: "p" | "span" }) {
  const [shown, setShown] = React.useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? text.length
      : 0
  );

  React.useEffect(() => {
    if (shown >= text.length) return;
    const t = window.setTimeout(() => setShown((s) => s + 1), 25);
    return () => window.clearTimeout(t);
  }, [shown, text.length]);

  const Tag = as;
  return (
    <Tag className={cn("text-small text-ink", shown < text.length && "typewriter-caret")}>
      {text.slice(0, shown)}
    </Tag>
  );
}
