/** Pure [chunk:ID] marker helpers (docs/06 §1 chunk ID contract).
 *  Lives outside lib/ai/rag.ts because client components (Markdown, CitedMarkdown)
 *  render these markers away — rag.ts is "server-only" and can't cross that line. */

/** Strip inline [chunk:ID] markers from markdown for rendering. */
export function stripChunkMarkers(md: string): string {
  return md.replace(/\s*\[chunk:[a-f0-9]{4,32}\]/gi, "");
}

/** Extract [chunk:ID] markers in order of appearance. */
export function extractChunkMarkers(md: string): string[] {
  const out: string[] = [];
  const re = /\[chunk:([a-f0-9]{4,32})\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const id = m[1]!.toLowerCase();
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
