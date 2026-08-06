import { describe, it, expect } from "vitest";
import {
  chunkBlocks,
  estimateTokens,
  buildChunkContext,
  resolveCitations,
  formatLocator,
  TOP_K,
  SIM_FLOOR,
  LOW_CONFIDENCE_MIN,
  type SourceBlock,
  type RetrievedChunk,
} from "@/lib/ai/rag";
import { stripChunkMarkers, extractChunkMarkers } from "@/lib/ai/chunk-markers";

/** Spec: docs/06 §1 (RAG pipeline — ~800-token chunks with 15% overlap, locators
 *  preserved, context block format, 8-char chunk-ID contract). */

const CHUNK_TOKENS = 800;

function words(n: number, seed = "lorem"): string {
  return Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");
}

/** ~200 tokens per paragraph (4 chars/token heuristic → ~800 chars). */
function paragraph(index: number): string {
  return `Paragraph ${index}. ${words(110, `w${index}_`)}`;
}

function makeChunk(over: Partial<RetrievedChunk> & { id: string }): RetrievedChunk {
  return {
    material_id: "m1",
    content: "Some content.",
    page: null,
    start_seconds: null,
    end_seconds: null,
    similarity: 0.9,
    material_title: "Biology Chapter 3",
    ...over,
  };
}

describe("retrieval constants (docs/06 §1)", () => {
  it("matches the normative top-k / floor / low-confidence numbers", () => {
    expect(TOP_K).toBe(12);
    expect(SIM_FLOOR).toBe(0.25);
    expect(LOW_CONFIDENCE_MIN).toBe(3);
  });
});

describe("estimateTokens", () => {
  it("uses the documented ~4 chars/token heuristic, rounding up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("a".repeat(4000))).toBe(1000);
  });
});

describe("chunkBlocks — sizing and overlap", () => {
  const longDoc: SourceBlock[] = [
    { text: Array.from({ length: 24 }, (_, i) => paragraph(i)).join("\n\n"), page: 1 },
  ];

  it("splits a long document into multiple chunks", () => {
    const chunks = chunkBlocks(longDoc);
    expect(chunks.length).toBeGreaterThan(3);
  });

  it("keeps every chunk at or under the ~800-token target", () => {
    for (const chunk of chunkBlocks(longDoc)) {
      // token_count includes the "\n\n" joins, so allow a small margin.
      expect(chunk.token_count).toBeLessThanOrEqual(CHUNK_TOKENS + 50);
      expect(chunk.token_count).toBe(estimateTokens(chunk.content));
    }
  });

  it("fills chunks rather than emitting tiny ones (last chunk excepted)", () => {
    const chunks = chunkBlocks(longDoc);
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.token_count).toBeGreaterThan(CHUNK_TOKENS * 0.5);
    }
  });

  it("overlaps consecutive chunks (15% target) so context is never cut mid-idea", () => {
    const chunks = chunkBlocks(longDoc);
    let overlapping = 0;
    for (let i = 1; i < chunks.length; i++) {
      const previousParas = chunks[i - 1]!.content.split("\n\n");
      const currentParas = chunks[i]!.content.split("\n\n");
      if (previousParas.some((p) => currentParas.includes(p))) overlapping++;
    }
    expect(overlapping).toBe(chunks.length - 1);
  });

  it("keeps the carried overlap small — never re-emitting a whole chunk", () => {
    const chunks = chunkBlocks(longDoc);
    for (let i = 1; i < chunks.length; i++) {
      const previousParas = chunks[i - 1]!.content.split("\n\n");
      const currentParas = chunks[i]!.content.split("\n\n");
      const shared = currentParas.filter((p) => previousParas.includes(p));
      expect(shared.length).toBeLessThan(previousParas.length);
      expect(shared.length).toBeLessThan(currentParas.length);
    }
  });

  it("terminates without runaway duplication on very large paragraphs", () => {
    // Paragraphs far bigger than the overlap target must not loop or duplicate.
    const fat = Array.from({ length: 8 }, (_, i) => `P${i}. ${words(160, `f${i}_`)}`).join("\n\n");
    const chunks = chunkBlocks([{ text: fat, page: 1 }]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(12);
    const contents = chunks.map((c) => c.content);
    expect(new Set(contents).size).toBe(contents.length);
  });

  it("numbers chunks sequentially from 0", () => {
    const chunks = chunkBlocks(longDoc);
    expect(chunks.map((c) => c.idx)).toEqual(chunks.map((_, i) => i));
  });

  it("loses no source paragraph", () => {
    const chunks = chunkBlocks(longDoc);
    const all = chunks.map((c) => c.content).join("\n\n");
    for (let i = 0; i < 24; i++) {
      expect(all).toContain(`Paragraph ${i}.`);
    }
  });

  it("hard-splits an oversized single paragraph on sentence boundaries", () => {
    const giant = Array.from({ length: 40 }, (_, i) => `Sentence ${i} ${words(40, `s${i}_`)}.`).join(" ");
    const chunks = chunkBlocks([{ text: giant, page: 4 }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.token_count).toBeLessThanOrEqual(CHUNK_TOKENS + 50);
      expect(chunk.page).toBe(4);
    }
  });

  it("splits on markdown headings as well as blank lines", () => {
    const chunks = chunkBlocks([
      { text: "# Heading One\nBody one text.\n# Heading Two\nBody two text.", page: 1 },
    ]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toContain("# Heading One");
    expect(chunks[0]!.content).toContain("# Heading Two");
  });

  it("returns an empty array for empty or whitespace-only input", () => {
    expect(chunkBlocks([])).toEqual([]);
    expect(chunkBlocks([{ text: "" }])).toEqual([]);
    expect(chunkBlocks([{ text: "   \n\n  \n" }])).toEqual([]);
  });

  it("keeps a short document as a single chunk", () => {
    const chunks = chunkBlocks([{ text: "A short paragraph about cells.", page: 2 }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe("A short paragraph about cells.");
    expect(chunks[0]!.page).toBe(2);
  });
});

describe("chunkBlocks — locator preservation (docs/06 §1 / docs/04)", () => {
  it("keeps the page number of the first paragraph in each chunk", () => {
    const blocks: SourceBlock[] = [
      { text: Array.from({ length: 6 }, (_, i) => paragraph(i)).join("\n\n"), page: 12 },
      { text: Array.from({ length: 6 }, (_, i) => paragraph(100 + i)).join("\n\n"), page: 13 },
    ];
    const chunks = chunkBlocks(blocks);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.page === 12 || chunk.page === 13).toBe(true);
      expect(chunk.start_seconds).toBeNull();
    }
    expect(chunks[0]!.page).toBe(12);
    expect(chunks[chunks.length - 1]!.page).toBe(13);
  });

  it("keeps transcript timestamps, spanning first-start to last-end", () => {
    const blocks: SourceBlock[] = [
      { text: paragraph(1), startSeconds: 0, endSeconds: 30 },
      { text: paragraph(2), startSeconds: 30, endSeconds: 61 },
      { text: paragraph(3), startSeconds: 61, endSeconds: 95 },
    ];
    const chunks = chunkBlocks(blocks);
    expect(chunks[0]!.start_seconds).toBe(0);
    expect(chunks[0]!.end_seconds).toBe(95);
    expect(chunks[0]!.page).toBeNull();
  });

  it("normalizes absent locators to null rather than undefined", () => {
    const chunks = chunkBlocks([{ text: "No locator here." }]);
    expect(chunks[0]!.page).toBeNull();
    expect(chunks[0]!.start_seconds).toBeNull();
    expect(chunks[0]!.end_seconds).toBeNull();
  });
});

describe("formatLocator (docs/06 §1 — {p.12 | 03:41})", () => {
  it("formats a page locator", () => {
    expect(formatLocator({ page: 12, start_seconds: null })).toBe("p.12");
    expect(formatLocator({ page: 1, start_seconds: null })).toBe("p.1");
  });

  it("formats a timestamp locator as mm:ss, zero-padded", () => {
    expect(formatLocator({ page: null, start_seconds: 221 })).toBe("03:41");
    expect(formatLocator({ page: null, start_seconds: 0 })).toBe("00:00");
    expect(formatLocator({ page: null, start_seconds: 65 })).toBe("01:05");
  });

  it("prefers the timestamp when both are present", () => {
    expect(formatLocator({ page: 3, start_seconds: 221 })).toBe("03:41");
  });

  it("returns an empty string when there is no locator", () => {
    expect(formatLocator({ page: null, start_seconds: null })).toBe("");
  });
});

describe("buildChunkContext (docs/06 §1 block format + token budget)", () => {
  it("renders the exact documented block format with a page locator", () => {
    const chunk = makeChunk({
      id: "a1b2c3d4-1111-4222-8333-444455556666",
      content: "Mitochondria produce ATP.",
      page: 12,
      material_title: "Biology Chapter 3",
    });
    const ctx = buildChunkContext([chunk], 8000);
    expect(ctx.block).toBe("[chunk:a1b2c3d4] (Biology Chapter 3, p.12)\nMitochondria produce ATP.");
  });

  it("renders a timestamp locator for media chunks", () => {
    const chunk = makeChunk({
      id: "beef0001-1111-4222-8333-444455556666",
      content: "Today we cover derivatives.",
      start_seconds: 221,
      material_title: "Lecture 4",
    });
    expect(buildChunkContext([chunk], 8000).block).toBe(
      "[chunk:beef0001] (Lecture 4, 03:41)\nToday we cover derivatives."
    );
  });

  it("omits the locator separator when the chunk has none", () => {
    const chunk = makeChunk({ id: "cafe0001-1111-4222-8333-444455556666", content: "Pasted text." });
    expect(buildChunkContext([chunk], 8000).block).toBe("[chunk:cafe0001] (Biology Chapter 3)\nPasted text.");
  });

  it("joins multiple blocks with a blank line", () => {
    const ctx = buildChunkContext(
      [
        makeChunk({ id: "aaaa0001-1111-4222-8333-444455556666", content: "One.", page: 1 }),
        makeChunk({ id: "bbbb0002-1111-4222-8333-444455556666", content: "Two.", page: 2 }),
      ],
      8000
    );
    expect(ctx.block.split("\n\n")).toHaveLength(2);
    expect(ctx.chunks).toHaveLength(2);
  });

  it("uses the first 8 hex characters of the uuid as the prompt-facing prefix", () => {
    const ctx = buildChunkContext(
      [makeChunk({ id: "a1b2c3d4-1111-4222-8333-444455556666" })],
      8000
    );
    expect([...ctx.prefixToUuid.keys()]).toEqual(["a1b2c3d4"]);
    expect(ctx.prefixToUuid.get("a1b2c3d4")).toBe("a1b2c3d4-1111-4222-8333-444455556666");
    expect(extractChunkMarkers(ctx.block)).toEqual(["a1b2c3d4"]);
  });

  it("respects the token budget and stops adding blocks", () => {
    const big = "x".repeat(4000); // ~1000 tokens each
    const chunks = Array.from({ length: 10 }, (_, i) =>
      makeChunk({ id: `${String(i).padStart(8, "0")}-1111-4222-8333-444455556666`, content: big })
    );
    const ctx = buildChunkContext(chunks, 3000);
    expect(ctx.chunks.length).toBeLessThan(10);
    expect(estimateTokens(ctx.block)).toBeLessThanOrEqual(3000);
    expect(ctx.prefixToUuid.size).toBe(ctx.chunks.length);
  });

  it("honours the tutor 8k vs notes 12k budgets differently", () => {
    const big = "x".repeat(4000);
    const chunks = Array.from({ length: 20 }, (_, i) =>
      makeChunk({ id: `${String(i).padStart(8, "0")}-1111-4222-8333-444455556666`, content: big })
    );
    const tutor = buildChunkContext(chunks, 8000);
    const notes = buildChunkContext(chunks, 12_000);
    expect(notes.chunks.length).toBeGreaterThan(tutor.chunks.length);
  });

  it("always includes at least one block, even if it alone busts the budget", () => {
    const huge = makeChunk({
      id: "dddd0001-1111-4222-8333-444455556666",
      content: "y".repeat(40_000),
    });
    const ctx = buildChunkContext([huge], 100);
    expect(ctx.chunks).toHaveLength(1);
    expect(ctx.prefixToUuid.size).toBe(1);
  });

  it("returns an empty context for no chunks", () => {
    const ctx = buildChunkContext([], 8000);
    expect(ctx.block).toBe("");
    expect(ctx.chunks).toEqual([]);
    expect(ctx.prefixToUuid.size).toBe(0);
  });
});

describe("resolveCitations (8-char prefix → full uuid)", () => {
  const map = new Map([
    ["a1b2c3d4", "a1b2c3d4-1111-4222-8333-444455556666"],
    ["beef0001", "beef0001-1111-4222-8333-444455556666"],
  ]);

  it("maps prefixes back to full uuids", () => {
    expect(resolveCitations(["a1b2c3d4", "beef0001"], map)).toEqual([
      "a1b2c3d4-1111-4222-8333-444455556666",
      "beef0001-1111-4222-8333-444455556666",
    ]);
  });

  it("dedupes repeated citations while preserving first-seen order", () => {
    expect(resolveCitations(["beef0001", "a1b2c3d4", "beef0001"], map)).toEqual([
      "beef0001-1111-4222-8333-444455556666",
      "a1b2c3d4-1111-4222-8333-444455556666",
    ]);
  });

  it("tolerates a 'chunk:' prefix, surrounding whitespace, and a full uuid", () => {
    expect(resolveCitations(["chunk:a1b2c3d4"], map)).toEqual(["a1b2c3d4-1111-4222-8333-444455556666"]);
    expect(resolveCitations(["  a1b2c3d4 "], map)).toEqual(["a1b2c3d4-1111-4222-8333-444455556666"]);
    expect(resolveCitations(["a1b2c3d4-1111-4222-8333-444455556666"], map)).toEqual([
      "a1b2c3d4-1111-4222-8333-444455556666",
    ]);
  });

  it("drops hallucinated ids that are not in the request's map (docs/06 §2 rule 4)", () => {
    expect(resolveCitations(["deadbeef", "00000000"], map)).toEqual([]);
    expect(resolveCitations(["a1b2c3d4", "deadbeef"], map)).toEqual([
      "a1b2c3d4-1111-4222-8333-444455556666",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(resolveCitations([], map)).toEqual([]);
  });

  it("round-trips markers extracted from model output back to uuids", () => {
    const body = "ATP is made here [chunk:a1b2c3d4]. Derivatives are covered later [chunk:beef0001].";
    expect(resolveCitations(extractChunkMarkers(body), map)).toEqual([
      "a1b2c3d4-1111-4222-8333-444455556666",
      "beef0001-1111-4222-8333-444455556666",
    ]);
  });
});

describe("chunk marker helpers (docs/06 §1 — stripped at render, chips instead)", () => {
  it("extracts markers in order of first appearance, deduped and lowercased", () => {
    const md = "One [chunk:A1B2C3D4]. Two [chunk:beef0001]. Again [chunk:a1b2c3d4].";
    expect(extractChunkMarkers(md)).toEqual(["a1b2c3d4", "beef0001"]);
  });

  it("returns an empty array when there are no markers", () => {
    expect(extractChunkMarkers("Plain prose with no citations.")).toEqual([]);
  });

  it("strips markers along with the space in front of them", () => {
    expect(stripChunkMarkers("ATP is made here [chunk:a1b2c3d4].")).toBe("ATP is made here.");
    expect(stripChunkMarkers("A [chunk:a1b2c3d4] B [chunk:beef0001] C")).toBe("A B C");
  });

  it("leaves prose without markers untouched", () => {
    const md = "### Heading\n\nSome **bold** text and $x^2$ math.";
    expect(stripChunkMarkers(md)).toBe(md);
  });

  it("does not strip look-alike text that is not a chunk marker", () => {
    expect(stripChunkMarkers("See [chunk:zzzz] and [note:a1b2c3d4]")).toBe(
      "See [chunk:zzzz] and [note:a1b2c3d4]"
    );
  });

  it("round-trips: strip removes exactly what extract found", () => {
    const md = "Claim one [chunk:a1b2c3d4]. Claim two [chunk:beef0001]. Claim three [chunk:a1b2c3d4].";
    const markers = extractChunkMarkers(md);
    const stripped = stripChunkMarkers(md);
    expect(markers).toHaveLength(2);
    for (const id of markers) {
      expect(stripped).not.toContain(id);
    }
    expect(stripped).toBe("Claim one. Claim two. Claim three.");
    expect(extractChunkMarkers(stripped)).toEqual([]);
  });
});
