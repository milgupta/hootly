import * as React from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Skeleton matching the standard card layout (no layout shift on load). */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-5 shadow-xs", className)}>
      <Skeleton className="mb-3 h-5 w-2/5" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}
