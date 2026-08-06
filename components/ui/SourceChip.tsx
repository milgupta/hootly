"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface SourceChipData {
  chunkId: string;
  materialTitle: string;
  page?: number | null;
  startSeconds?: number | null;
}

export function formatTimestamp(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Source chip (docs/05 §7.1): "📄 {material} · p.{page}" or "🎧 {material} · {mm:ss}".
 * Click opens the source split-pane with the chunk highlighted.
 */
export function SourceChip({
  source,
  onOpen,
  className,
  compact,
}: {
  source: SourceChipData;
  onOpen?: (source: SourceChipData) => void;
  className?: string;
  compact?: boolean;
}) {
  const isAudio = source.startSeconds != null;
  const locator = isAudio
    ? formatTimestamp(source.startSeconds as number)
    : source.page != null
      ? `p.${source.page}`
      : null;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(source)}
      className={cn(
        "focus-ring inline-flex max-w-full items-center gap-1 rounded-full border border-primary-border bg-primary-soft px-2.5 py-0.5 text-[12px] font-medium text-primary transition-all duration-150 hover:border-primary hover:shadow-xs",
        className
      )}
      title={`Open source: ${source.materialTitle}`}
    >
      <span aria-hidden>{isAudio ? "🎧" : "📄"}</span>
      <span className={cn("truncate", compact ? "max-w-[12ch]" : "max-w-[24ch]")}>
        {source.materialTitle}
      </span>
      {locator && <span className="shrink-0 tabular-nums">· {locator}</span>}
    </button>
  );
}
