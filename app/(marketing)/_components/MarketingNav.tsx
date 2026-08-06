"use client";

import * as React from "react";
import Link from "next/link";
import { OllieMark } from "@/components/ollie/OllieMark";
import { cn } from "@/lib/cn";

/**
 * Marketing nav (docs/05 §1): wordmark · "Pricing" · "Log in" (ghost) · "Start free".
 * Sticky; blurs + gains a hairline border once the page scrolls.
 *
 * Ship-gate note (docs/03 §8 rule 2 — "exactly one purple primary action above the
 * fold"): at scroll position 0 the hero's "Start studying free" is the single purple
 * primary, so the nav CTA renders in the secondary style. Once the hero CTA has
 * scrolled away (>240px) the nav CTA takes over the primary treatment.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [pastHero, setPastHero] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      setPastHero(y > 240);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-150",
        scrolled
          ? "border-b border-border bg-bg/80 backdrop-blur"
          : "border-b border-transparent bg-bg"
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 md:h-16 md:px-6"
      >
        <Link
          href="/"
          className="focus-ring flex items-center gap-2 rounded-ctl py-1 pr-1"
        >
          <OllieMark size={26} title="Hootly" />
          <span className="text-[17px] font-bold tracking-[-0.01em] text-ink">
            hootly
          </span>
        </Link>

        <div className="flex items-center gap-1 md:gap-2">
          <Link
            href="/pricing"
            className="focus-ring rounded-ctl px-2.5 py-2 text-[14px] font-medium text-ink-2 transition-colors duration-150 hover:bg-bg-subtle hover:text-ink active:scale-[0.98] md:px-3"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="focus-ring rounded-ctl px-2.5 py-2 text-[14px] font-semibold text-primary transition-colors duration-150 hover:bg-primary-soft active:scale-[0.98] md:px-3"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(
              "focus-ring inline-flex h-10 items-center justify-center rounded-ctl px-3.5 text-[14px] font-semibold whitespace-nowrap transition-all duration-150 hover:shadow-md hover:-translate-y-px active:translate-y-0 active:scale-[0.98] md:px-4",
              pastHero
                ? "gradient-button-depth text-white"
                : "border border-border bg-surface text-ink hover:border-primary-border"
            )}
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}
