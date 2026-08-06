"use client";

import * as React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";
import { PlanCards } from "./PlanCards";
import { PRICE, type Interval } from "./plans";

/**
 * Monthly/Annual toggle (docs/05 §2) — annual is the default. The "Save 46%" badge
 * shows its own arithmetic on hover *and* on keyboard focus (Radix tooltip), because
 * a saving you can't check isn't an honest saving.
 */
export function PricingPlans() {
  const [interval, setInterval] = React.useState<Interval>("annual");
  const annual = interval === "annual";

  const option = (value: Interval, label: string) => (
    <button
      type="button"
      aria-pressed={interval === value}
      onClick={() => setInterval(value)}
      className={cn(
        "focus-ring h-9 rounded-[7px] px-4 text-[14px] font-semibold transition-all duration-150 active:scale-[0.98]",
        interval === value
          ? "bg-surface text-ink shadow-xs"
          : "text-ink-2 hover:text-ink"
      )}
    >
      {label}
    </button>
  );

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div
          role="group"
          aria-label="Billing interval"
          className="inline-flex gap-1 rounded-ctl border border-border bg-bg-subtle p-1"
        >
          {option("monthly", "Monthly")}
          {option("annual", "Annual")}
        </div>

        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              aria-label={`Save ${PRICE.savePct} percent on annual billing — how the math works`}
              className="focus-ring text-micro cursor-help rounded-full border border-primary-border bg-primary-soft px-2.5 py-1.5 uppercase tabular-nums text-primary transition-colors duration-150 hover:bg-surface"
            >
              Save {PRICE.savePct}%
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              sideOffset={6}
              className="fade-in-up text-small z-50 max-w-[280px] rounded-ctl border border-border bg-surface px-3 py-2 tabular-nums text-ink shadow-md"
            >
              ${PRICE.annualTotal} a year, versus ${PRICE.monthlyYearlyTotal} if you
              paid the ${PRICE.monthlyPerMonth} monthly rate for 12 months. You keep $
              {PRICE.annualSavings}.
              <Tooltip.Arrow className="fill-white" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>

      <div className="mt-8">
        <PlanCards interval={interval} />
      </div>

      <p className="text-small mx-auto mt-6 max-w-[52ch] text-center text-ink-2">
        {annual
          ? "Annual is one charge today, and you can still get every cent back for 7 days."
          : "Monthly renews on the same date each month. Switch to annual any time from the billing portal."}
      </p>
    </Tooltip.Provider>
  );
}
