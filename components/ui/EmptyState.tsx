import * as React from "react";
import { cn } from "@/lib/cn";
import { OllieMark } from "@/components/ollie/OllieMark";

/**
 * Every empty screen = small Ollie illustration + one sentence + one primary action
 * (docs/03 §4). No dead ends anywhere.
 */
export function EmptyState({
  message,
  action,
  ollie = <OllieMark size={64} />,
  className,
}: {
  message: string;
  action?: React.ReactNode;
  ollie?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-14 text-center",
        className
      )}
    >
      {ollie}
      <p className="text-body max-w-[40ch] text-ink-2">{message}</p>
      {action}
    </div>
  );
}
