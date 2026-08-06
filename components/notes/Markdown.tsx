"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { stripChunkMarkers } from "@/lib/ai/chunk-markers";

/** Markdown + KaTeX renderer for notes and tutor messages.
 *  Inline [chunk:ID] markers are stripped at render time — they're surfaced as
 *  source chips / citation chips instead (docs/06 §1 chunk ID contract).
 *  No raw HTML is allowed through (react-markdown skips it by default). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  const clean = React.useMemo(() => stripChunkMarkers(children), [children]);
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children: kids }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="focus-ring rounded font-medium text-primary underline hover:text-primary-hover"
            >
              {kids}
            </a>
          ),
        }}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}
