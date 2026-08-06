import * as React from "react";
import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max = 100,
  className,
  ariaLabel,
}: {
  value: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-primary-soft", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
