"use client";

import * as React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * FAQ accordion (docs/05 §1 and §2). Consistent +/− icons on every row — StudyFetch
 * mixes chevrons and carets; we never do. Native buttons, so Enter/Space work; state
 * exposed via aria-expanded/aria-controls. Height is not animated (transform/opacity
 * only, docs/03 §5) — the answer fades in.
 */

export type FaqItem = {
  q: string;
  /** Rendered as-is so copy can carry emphasis; keep the wording verbatim. */
  a: React.ReactNode;
};

export function Faq({ items, className }: { items: FaqItem[]; className?: string }) {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <div className={cn("divide-y divide-border rounded-card border border-border bg-surface shadow-xs", className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="focus-ring flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-bg-subtle active:bg-bg-subtle md:px-6"
              >
                <span className="text-body-strong text-ink">{item.q}</span>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                    isOpen
                      ? "border-primary-border bg-primary-soft text-primary"
                      : "border-border text-ink-2"
                  )}
                  aria-hidden
                >
                  {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
                </span>
              </button>
            </h3>
            {isOpen && (
              <div
                id={`faq-a-${i}`}
                role="region"
                aria-labelledby={`faq-q-${i}`}
                className="fade-in px-5 pb-5 md:px-6"
              >
                <p className="text-body reading-measure text-ink-2">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
