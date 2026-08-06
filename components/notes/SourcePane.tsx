"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatTimestamp } from "@/components/ui/SourceChip";
import { getSourceForChunk, type SourceView } from "@/app/(app)/courses/[courseId]/source-actions";
import { cn } from "@/lib/cn";

/** Split-pane source viewer (docs/05 §7.1): opens the cited source with the
 *  chunk highlighted primary-soft. PDF/slide sources render the page's extracted
 *  text with the page number; audio/video render the transcript scrolled to the
 *  timestamp. Signed URL to the original file is offered as "Open original". */
export function SourcePane({
  chunkId,
  onClose,
}: {
  chunkId: string | null;
  onClose: () => void;
}) {
  const [view, setView] = React.useState<SourceView | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const highlightRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!chunkId) {
      setView(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getSourceForChunk(chunkId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data) setView(res.data);
      else setError(res.error ?? "Couldn't open that source.");
    });
    return () => {
      cancelled = true;
    };
  }, [chunkId]);

  React.useEffect(() => {
    if (view && highlightRef.current) {
      highlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [view]);

  if (!chunkId) return null;

  return (
    <aside
      className="fade-in flex h-full flex-col border-l border-border bg-bg-subtle"
      aria-label="Source"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-small truncate font-semibold text-ink">
            {loading ? "Opening source…" : (view?.materialTitle ?? "Source")}
          </p>
          {view && (
            <p className="text-micro text-ink-3 tabular-nums">
              {view.kind === "media"
                ? "Transcript"
                : view.page != null
                  ? `Page ${view.page}`
                  : "Full text"}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close source"
          className="focus-ring shrink-0 rounded-full p-1.5 text-ink-3 transition-colors duration-150 hover:bg-bg hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-body mb-3 text-ink">{error}</p>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {view && !loading && (
          <div className="flex flex-col gap-2">
            {view.segments.map((seg) => (
              <div
                key={seg.id}
                ref={seg.id === chunkId ? highlightRef : undefined}
                className={cn(
                  "rounded-ctl px-3 py-2 text-[14px] leading-6 transition-colors duration-150",
                  seg.id === chunkId
                    ? "bg-primary-soft text-ink ring-1 ring-primary-border"
                    : "text-ink-2"
                )}
              >
                {seg.startSeconds != null && (
                  <span className="text-micro mr-2 text-primary tabular-nums">
                    {formatTimestamp(seg.startSeconds)}
                  </span>
                )}
                {seg.page != null && seg.page !== view.page && (
                  <span className="text-micro mr-2 text-ink-3">p.{seg.page}</span>
                )}
                {seg.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {view?.originalUrl && (
        <div className="border-t border-border px-4 py-3">
          <a
            href={view.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring text-small rounded font-semibold text-primary hover:text-primary-hover"
          >
            Open original file ↗
          </a>
        </div>
      )}
    </aside>
  );
}
