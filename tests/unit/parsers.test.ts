import { describe, it, expect } from "vitest";
import { parseQuizlet } from "@/lib/extract/quizlet";
import { parseYouTubeId } from "@/lib/extract/youtube";

/** Spec: docs/04 §1 (Quizlet paste import — `term<TAB>definition`, comma fallback;
 *  YouTube captions ingestion). */

describe("parseQuizlet", () => {
  it("parses tab-separated term/definition pairs", () => {
    const text = "Mitochondrion\tThe organelle that produces ATP\nRibosome\tSite of protein synthesis";
    expect(parseQuizlet(text)).toEqual([
      { front: "Mitochondrion", back: "The organelle that produces ATP" },
      { front: "Ribosome", back: "Site of protein synthesis" },
    ]);
  });

  it("falls back to the first comma when there is no tab", () => {
    expect(parseQuizlet("Nucleus,Stores the cell's DNA")).toEqual([
      { front: "Nucleus", back: "Stores the cell's DNA" },
    ]);
  });

  it("keeps commas inside the definition when the line is tab-separated", () => {
    const text = "Golgi apparatus\tSorts, modifies, and packages proteins";
    expect(parseQuizlet(text)).toEqual([
      { front: "Golgi apparatus", back: "Sorts, modifies, and packages proteins" },
    ]);
  });

  it("splits on the FIRST comma only, so the rest of the definition survives", () => {
    expect(parseQuizlet("Osmosis,Diffusion of water, across a membrane")).toEqual([
      { front: "Osmosis", back: "Diffusion of water, across a membrane" },
    ]);
  });

  it("skips blank and whitespace-only lines", () => {
    const text = "A\tfirst\n\n   \n\t\nB\tsecond\n\n";
    expect(parseQuizlet(text)).toEqual([
      { front: "A", back: "first" },
      { front: "B", back: "second" },
    ]);
  });

  it("skips lines with no delimiter at all", () => {
    expect(parseQuizlet("Chapter 3 Review\nA\tfirst")).toEqual([{ front: "A", back: "first" }]);
  });

  it("skips lines where either side is empty after trimming", () => {
    expect(parseQuizlet("\tdefinition only\nterm only\t\n,\nA\tfirst")).toEqual([
      { front: "A", back: "first" },
    ]);
  });

  it("trims surrounding whitespace on both sides", () => {
    expect(parseQuizlet("  Cytoplasm  \t   Gel-like interior of the cell   ")).toEqual([
      { front: "Cytoplasm", back: "Gel-like interior of the cell" },
    ]);
  });

  it("handles CRLF line endings from Windows pastes", () => {
    expect(parseQuizlet("A\tfirst\r\nB\tsecond\r\n")).toEqual([
      { front: "A", back: "first" },
      { front: "B", back: "second" },
    ]);
  });

  it("mixes tab and comma lines in one paste", () => {
    expect(parseQuizlet("A\tfirst, with comma\nB,second")).toEqual([
      { front: "A", back: "first, with comma" },
      { front: "B", back: "second" },
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseQuizlet("")).toEqual([]);
    expect(parseQuizlet("\n\n   \n")).toEqual([]);
  });
});

describe("parseYouTubeId", () => {
  it("parses a standard watch?v= URL", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("http://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses watch URLs where v= is not the first query parameter", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("ignores trailing query parameters after the id", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe("dQw4w9WgXcQ");
  });

  it("parses the youtu.be short form", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses /shorts/ and /embed/ URLs", () => {
    expect(parseYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts ids containing hyphens and underscores", () => {
    expect(parseYouTubeId("https://youtu.be/a_b-c1D2e3F")).toBe("a_b-c1D2e3F");
  });

  it("returns null for junk and for non-YouTube URLs", () => {
    for (const junk of [
      "",
      "not a url",
      "https://vimeo.com/123456789",
      "https://www.youtube.com/",
      "https://www.youtube.com/watch",
      "https://www.youtube.com/watch?v=",
      "https://example.com/watch?v=dQw4w9WgXcQ",
      "dQw4w9WgXcQ",
    ]) {
      expect(parseYouTubeId(junk)).toBeNull();
    }
  });

  it("returns null when the id is too short to be a video id", () => {
    expect(parseYouTubeId("https://youtu.be/abc123")).toBeNull();
    expect(parseYouTubeId("https://www.youtube.com/watch?v=short")).toBeNull();
  });

  it("returns exactly 11 characters when it matches", () => {
    const id = parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(id).not.toBeNull();
    expect(id).toHaveLength(11);
  });
});
