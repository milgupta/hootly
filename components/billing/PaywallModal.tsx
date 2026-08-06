"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { OllieStory } from "@/components/ollie/OllieStory";
import { cn } from "@/lib/cn";
import { PRICE_COPY } from "@/lib/billing/plans";
import { captureEvent } from "@/lib/analytics/posthog";
import type { Metric } from "@/lib/analytics/events";

/** Paywall context (docs/05 §9): onboarding | limit:{metric} | feature:{name}. */
export type PaywallContext = string;

const METRIC_COPY: Record<Metric, { n: number; label: string }> = {
  courses: { n: 1, label: "course" },
  uploads: { n: 3, label: "uploads" },
  cards_generated: { n: 50, label: "AI flashcards" },
  quizzes_generated: { n: 2, label: "AI quizzes" },
  tutor_messages: { n: 20, label: "tutor messages" },
};

/** Only SHIPPED features may appear here — update when P1 features launch. */
const HIGHLIGHTS = [
  "Unlimited uploads — your whole semester in one place.",
  "Unlimited flashcards, quizzes, and tutor messages.",
  "Every answer shows its source. No AI guessing.",
];

const TICKS = [
  "Unlimited courses and uploads",
  "Unlimited AI flashcards and quizzes",
  "Unlimited tutor messages",
  "PDF export of your notes",
];

function headlineFor(context: PaywallContext): string {
  if (context === "onboarding") return "Keep the momentum.";
  if (context.startsWith("limit:")) {
    const metric = context.slice("limit:".length) as Metric;
    const copy = METRIC_COPY[metric];
    if (copy) return `You've used your ${copy.n} free ${copy.label}.`;
    return "You've hit a free-plan limit.";
  }
  if (context.startsWith("feature:")) {
    return `${context.slice("feature:".length)} is a Plus feature.`;
  }
  return "Keep the momentum.";
}

export function PaywallModal({
  open,
  context,
  onOpenChange,
}: {
  open: boolean;
  context: PaywallContext;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [interval, setInterval] = React.useState<"year" | "month">("year");
  const [highlight, setHighlight] = React.useState(0);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) captureEvent("paywall_viewed", { context });
  }, [open, context]);

  // Rotating feature highlights (not testimonials — none exist yet).
  React.useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setHighlight((h) => (h + 1) % HIGHLIGHTS.length), 4000);
    return () => window.clearInterval(t);
  }, [open]);

  async function checkout() {
    captureEvent("plan_selected", { interval });
    setPending(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast(
        data.error === "billing_not_configured"
          ? "Checkout isn't connected on this deployment yet."
          : "Couldn't start checkout — try again.",
        { kind: "error" }
      );
    } catch {
      toast("Couldn't start checkout — try again.", { kind: "error" });
    } finally {
      setPending(false);
    }
  }

  function dismiss() {
    captureEvent("paywall_dismissed", {});
    onOpenChange(false);
    // Lets flows that gate on the paywall (onboarding 4.7 → referral survey)
    // continue without inspecting the DOM.
    window.dispatchEvent(new CustomEvent("hootly:paywall-closed", { detail: { context } }));
  }

  const highlightText = HIGHLIGHTS[highlight] ?? HIGHLIGHTS[0]!;

  return (
    <Modal open={open} onOpenChange={(o) => (o ? onOpenChange(true) : dismiss())} wide ariaTitle="Upgrade to Plus">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
        {/* Left: storybook Ollie + rotating highlights */}
        <div className="gradient-card-sheen hidden flex-col items-center justify-center gap-5 rounded-l-modal p-6 md:flex">
          <OllieStory width={220} />
          <p key={highlight} className="fade-in text-body text-center font-medium text-ink">
            {highlightText}
          </p>
        </div>

        {/* Right: context + plans */}
        <div className="p-6">
          <h2 className="text-h2 mb-1">{headlineFor(context)}</h2>
          <p className="text-body mb-5 text-ink-2">
            Plus removes every limit — and you can leave in two clicks.
          </p>

          <div className="mb-4 flex flex-col gap-2">
            <button
              onClick={() => setInterval("year")}
              aria-pressed={interval === "year"}
              className={cn(
                "focus-ring flex items-center justify-between rounded-card border px-4 py-3 text-left transition-all duration-150",
                interval === "year"
                  ? "border-primary-border bg-primary-soft"
                  : "border-border bg-surface hover:border-primary-border"
              )}
            >
              <span>
                <span className="text-body-strong block text-ink">
                  Annual · {PRICE_COPY.annualPerMonth}
                </span>
                <span className="text-small text-ink-2 tabular-nums">{PRICE_COPY.annualBilled}</span>
              </span>
              <span className="text-micro rounded-full bg-primary px-2 py-0.5 font-semibold text-white">
                Save {PRICE_COPY.annualSavingsPct}%
              </span>
            </button>
            <button
              onClick={() => setInterval("month")}
              aria-pressed={interval === "month"}
              className={cn(
                "focus-ring flex items-center justify-between rounded-card border px-4 py-3 text-left transition-all duration-150",
                interval === "month"
                  ? "border-primary-border bg-primary-soft"
                  : "border-border bg-surface hover:border-primary-border"
              )}
            >
              <span>
                <span className="text-body-strong block text-ink">
                  Monthly · {PRICE_COPY.monthly}
                </span>
                <span className="text-small text-ink-2 tabular-nums">
                  {PRICE_COPY.monthlyYearTotal} a year at this rate
                </span>
              </span>
            </button>
          </div>

          <ul className="mb-5 flex flex-col gap-1.5">
            {TICKS.map((tick) => (
              <li key={tick} className="text-small flex items-center gap-2 text-ink-2">
                <Check className="size-3.5 shrink-0 text-success" aria-hidden />
                {tick}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <Button onClick={checkout} loading={pending} className="w-full">
              Get Plus
            </Button>
            {/* Always present, never shrunken or grayed (docs/05 §9) */}
            <Button variant="ghost" onClick={dismiss} className="w-full">
              Maybe later
            </Button>
          </div>

          <p className="text-small mt-4 text-ink-2">
            ✓ Cancel in 2 clicks ✓ 7-day refund ✓ Limits never surprise you
          </p>
        </div>
      </div>
    </Modal>
  );
}

/** Any surface can open the paywall by dispatching:
 *  window.dispatchEvent(new CustomEvent("hootly:paywall", { detail: { context } })) */
export function PaywallHost() {
  const [state, setState] = React.useState<{ open: boolean; context: PaywallContext }>({
    open: false,
    context: "onboarding",
  });

  React.useEffect(() => {
    function onPaywall(e: Event) {
      const detail = (e as CustomEvent<{ context?: string }>).detail;
      setState({ open: true, context: detail?.context ?? "onboarding" });
    }
    window.addEventListener("hootly:paywall", onPaywall);
    return () => window.removeEventListener("hootly:paywall", onPaywall);
  }, []);

  return (
    <PaywallModal
      open={state.open}
      context={state.context}
      onOpenChange={(open) => setState((s) => ({ ...s, open }))}
    />
  );
}
