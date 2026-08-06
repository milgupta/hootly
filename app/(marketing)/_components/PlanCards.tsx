import Link from "next/link";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FREE_BULLETS, PLUS_BULLETS, PRICE, type Interval } from "./plans";

/**
 * The two plan cards (docs/05 §2). Shared by /pricing and the landing teaser so the
 * two surfaces can never drift. No hooks — renders on the server on the landing page
 * and inside the client toggle on /pricing.
 */
export function PlanCards({ interval }: { interval: Interval }) {
  const annual = interval === "annual";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Free */}
      <Card className="flex flex-col p-6 md:p-8">
        <h3 className="text-h3 text-ink">Free</h3>
        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="text-h1 tabular-nums text-ink">$0</span>
          <span className="text-small text-ink-2">forever</span>
        </p>
        <p className="text-small mt-2 text-ink-2">
          Real limits, printed here — not discovered later.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {FREE_BULLETS.map((b) => (
            <li key={b.label} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="text-body text-ink">{b.label}</span>
                <span className="text-small block text-ink-2">{b.note}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-8">
          <Link
            href="/signup"
            className="focus-ring flex h-10 items-center justify-center rounded-ctl border border-border bg-surface px-4 text-[15px] font-semibold text-ink transition-all duration-150 hover:border-primary-border hover:shadow-md active:scale-[0.98]"
          >
            Start free
          </Link>
        </div>
      </Card>

      {/* Plus */}
      <Card className="flex flex-col border-primary-border p-6 md:p-8">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-h3 text-ink">Plus</h3>
          <span className="text-micro rounded-full bg-primary-soft px-2.5 py-1 uppercase text-primary">
            Most popular
          </span>
        </div>
        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="text-h1 tabular-nums text-ink">
            ${annual ? PRICE.annualPerMonth : PRICE.monthlyPerMonth}
          </span>
          <span className="text-small text-ink-2">/mo</span>
        </p>
        <p className="text-small mt-2 tabular-nums text-ink-2">
          {annual
            ? `Billed annually ($${PRICE.annualTotal}/yr)`
            : "Billed monthly"}
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {PLUS_BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-body text-ink">{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-8">
          <Link
            href={`/signup?plan=plus&interval=${interval}`}
            className="gradient-button-depth focus-ring flex h-10 items-center justify-center rounded-ctl px-4 text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            Get Plus
          </Link>
        </div>
      </Card>
    </div>
  );
}
