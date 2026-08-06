"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { captureEvent } from "@/lib/analytics/posthog";
import type { Metric } from "@/lib/analytics/events";

/**
 * Trust UI (docs/03 §4): thin purple usage meter with "{used} of {limit} {label} used",
 * shown in context BEFORE the gated action. Never a surprise wall.
 * Fires limit_meter_viewed when rendered at ≤20% remaining (docs/07 §2.2).
 */
export function Meter({
  used,
  limit,
  label,
  metric,
  className,
  showLabel = true,
}: {
  used: number;
  limit: number;
  label?: string;
  /** Enables the limit_meter_viewed event; omit for decorative meters. */
  metric?: Metric;
  className?: string;
  showLabel?: boolean;
}) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100);
  const nearLimit = !unlimited && limit - used <= Math.max(1, limit * 0.2);
  const reported = React.useRef(false);

  React.useEffect(() => {
    if (!metric || unlimited || reported.current) return;
    const remainingPct = (limit - used) / limit;
    if (remainingPct <= 0.2) {
      reported.current = true;
      captureEvent("limit_meter_viewed", { metric });
    }
  }, [metric, unlimited, limit, used]);

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {showLabel && (
        <span
          className={cn(
            "text-small tabular-nums",
            nearLimit ? "text-warning" : "text-ink-2"
          )}
        >
          {unlimited
            ? `Unlimited ${label ?? ""}`.trim()
            : `${used} of ${limit}${label ? ` ${label}` : ""} used`}
        </span>
      )}
      {!unlimited && (
        <div
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
          className="h-1.5 w-full overflow-hidden rounded-full bg-primary-soft"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
