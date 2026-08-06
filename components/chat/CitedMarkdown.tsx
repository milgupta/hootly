"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Markdown } from "@/components/notes/Markdown";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTimestamp } from "@/components/ui/SourceChip";
import { extractChunkMarkers } from "@/lib/ai/chunk-markers";
import { getCitationExcerpt } from "@/app/(app)/courses/[courseId]/chat/actions";
import type { Citation } from "@/lib/types";

/** Assistant message body: markdown + KaTeX with inline [chunk:ID] markers
 *  replaced by numbered citation chips [1][2] (docs/05 §7.6). Hovering a chip
 *  shows the source excerpt; clicking opens the split-pane. */
export function CitedMarkdown({
  body,
  citations,
  onOpenSource,
}: {
  body: string;
  citations: Citation[];
  onOpenSource: (chunkId: string) => void;
}) {
  // Marker prefix (8 chars) → citation number, in order of first appearance.
  const numbering = React.useMemo(() => {
    const order = extractChunkMarkers(body);
    const map = new Map<string, { n: number; citation: Citation }>();
    let n = 0;
    for (const prefix of order) {
      const citation = citations.find((c) => c.chunk_id.replace(/-/g, "").startsWith(prefix));
      if (citation && !map.has(prefix)) {
        n += 1;
        map.set(prefix, { n, citation });
      }
    }
    return map;
  }, [body, citations]);

  // Split the markdown on markers so chips render inline at their position.
  const parts = React.useMemo(() => {
    const out: Array<{ type: "md"; text: string } | { type: "cite"; prefix: string }> = [];
    const re = /\[chunk:([a-f0-9]{4,32})\]/gi;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      if (m.index > last) out.push({ type: "md", text: body.slice(last, m.index) });
      out.push({ type: "cite", prefix: m[1]!.toLowerCase() });
      last = m.index + m[0].length;
    }
    if (last < body.length) out.push({ type: "md", text: body.slice(last) });
    return out;
  }, [body]);

  return (
    <div className="prose-notes text-body text-ink">
      {parts.map((part, i) =>
        part.type === "md" ? (
          <Markdown key={i} className="inline-block w-full align-top">
            {part.text}
          </Markdown>
        ) : (
          <CitationChip
            key={i}
            entry={numbering.get(part.prefix)}
            onOpenSource={onOpenSource}
          />
        )
      )}
    </div>
  );
}

function CitationChip({
  entry,
  onOpenSource,
}: {
  entry: { n: number; citation: Citation } | undefined;
  onOpenSource: (chunkId: string) => void;
}) {
  const [excerpt, setExcerpt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  if (!entry) return null;
  const { n, citation } = entry;

  const locator =
    citation.start_seconds != null
      ? formatTimestamp(citation.start_seconds)
      : citation.page != null
        ? `p.${citation.page}`
        : "";

  function loadExcerpt(open: boolean) {
    if (!open || excerpt || loading) return;
    setLoading(true);
    void getCitationExcerpt(citation.chunk_id).then((res) => {
      setLoading(false);
      setExcerpt(res.ok && res.data ? res.data.excerpt : "Couldn't load this source.");
    });
  }

  return (
    <Popover.Root onOpenChange={loadExcerpt}>
      <Popover.Trigger asChild>
        <button
          onClick={() => onOpenSource(citation.chunk_id)}
          onMouseEnter={() => loadExcerpt(true)}
          aria-label={`Source ${n}: ${citation.material_title}${locator ? `, ${locator}` : ""}`}
          className="focus-ring mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-primary-border bg-primary-soft px-1 align-super text-[10px] font-semibold text-primary transition-all duration-150 hover:border-primary"
        >
          {n}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          className="fade-in-up z-50 max-w-[320px] rounded-card border border-border bg-surface p-3 shadow-md"
        >
          <p className="text-micro mb-1.5 font-semibold text-primary">
            {citation.material_title}
            {locator && ` · ${locator}`}
          </p>
          {loading ? (
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ) : (
            <p className="text-small text-ink-2">{excerpt}</p>
          )}
          <Popover.Arrow className="fill-[#EAEAF0]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
