import { describe, it, expect } from "vitest";
import {
  notesOutlineSchema,
  noteSectionSchema,
  cardsSchema,
  quizSchema,
  planSchema,
  groundednessSchema,
  answerKeySchema,
} from "@/lib/ai/schemas";

/** Spec: docs/06 §4–§6 (JSON schemas for every AI output; structured outputs, strict).
 *  These schemas are the last line of defence before AI output reaches the DB, so
 *  every test here asserts a REJECTION of realistic model misbehaviour. */

const validOutline = {
  sections: [
    { heading: "Cell Membrane Structure", covers_chunk_ids: ["a1b2c3d4", "b2c3d4e5"] },
    { heading: "Organelles and Their Functions", covers_chunk_ids: ["c3d4e5f6"] },
  ],
};

const validSection = {
  heading: "Cell Membrane Structure",
  body_md: "The **phospholipid bilayer** is selectively permeable [chunk:a1b2c3d4].",
  source_chunk_ids: ["a1b2c3d4"],
};

const validCards = {
  cards: [
    { kind: "basic", front: "What does the mitochondrion produce?", back: "ATP", source_chunk_ids: ["a1b2c3d4"] },
    { kind: "cloze", front: "The {{c1::nucleus}} stores DNA.", back: "nucleus", source_chunk_ids: ["b2c3d4e5"] },
    { kind: "reversed", front: "Ribosome", back: "Site of protein synthesis", source_chunk_ids: [] },
  ],
};

const validQuiz = {
  title: "Cell Structure Quiz",
  questions: [
    {
      qtype: "mcq",
      topic: "Organelles",
      prompt: "Which organelle synthesizes ATP?",
      options: ["Nucleus", "Mitochondrion", "Ribosome", "Lysosome"],
      answer: "Mitochondrion",
      explanation: "Oxidative phosphorylation occurs on the inner membrane [chunk:a1b2c3d4].",
      source_chunk_ids: ["a1b2c3d4"],
      difficulty: 2,
    },
    {
      qtype: "short_answer",
      topic: "Membranes",
      prompt: "Name the two layers of the plasma membrane.",
      answer: "Two phospholipid leaflets",
      explanation: "The bilayer has an inner and outer leaflet [chunk:b2c3d4e5].",
      source_chunk_ids: ["b2c3d4e5"],
      difficulty: 1,
    },
  ],
};

const validPlan = {
  items: [
    { idx: 0, title: "Read: Cell Structure", kind: "read_note", topic: "Cells", due_date: "2026-08-07" },
    { idx: 1, title: "Review 20 cards", kind: "review_cards", topic: "Cells", due_date: "2026-08-08" },
  ],
};

describe("notesOutlineSchema (docs/06 §4.1)", () => {
  it("accepts a valid outline", () => {
    expect(notesOutlineSchema.parse(validOutline)).toEqual(validOutline);
  });

  it("accepts a section with no covered chunks (topic mode emits empty arrays)", () => {
    expect(
      notesOutlineSchema.safeParse({ sections: [{ heading: "Intro", covers_chunk_ids: [] }] }).success
    ).toBe(true);
  });

  it("rejects a missing required field", () => {
    expect(notesOutlineSchema.safeParse({ sections: [{ heading: "Intro" }] }).success).toBe(false);
    expect(notesOutlineSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an empty heading and an empty sections array", () => {
    expect(
      notesOutlineSchema.safeParse({ sections: [{ heading: "", covers_chunk_ids: [] }] }).success
    ).toBe(false);
    expect(notesOutlineSchema.safeParse({ sections: [] }).success).toBe(false);
  });

  it("rejects more than 20 sections (comprehensive tops out at 16)", () => {
    const sections = Array.from({ length: 21 }, (_, i) => ({
      heading: `S${i}`,
      covers_chunk_ids: [],
    }));
    expect(notesOutlineSchema.safeParse({ sections }).success).toBe(false);
  });

  it("rejects chunk ids that are not strings", () => {
    expect(
      notesOutlineSchema.safeParse({ sections: [{ heading: "S", covers_chunk_ids: [12345] }] }).success
    ).toBe(false);
  });
});

describe("noteSectionSchema (docs/06 §4.1)", () => {
  it("accepts a valid section", () => {
    expect(noteSectionSchema.parse(validSection)).toEqual(validSection);
  });

  it("rejects an empty body (a section with no prose is a failed generation)", () => {
    expect(noteSectionSchema.safeParse({ ...validSection, body_md: "" }).success).toBe(false);
  });

  it("rejects a missing source_chunk_ids field", () => {
    const { heading, body_md } = validSection;
    expect(noteSectionSchema.safeParse({ heading, body_md }).success).toBe(false);
  });

  it("rejects null body_md", () => {
    expect(noteSectionSchema.safeParse({ ...validSection, body_md: null }).success).toBe(false);
  });
});

describe("cardsSchema (docs/06 §4.2)", () => {
  it("accepts all three card kinds", () => {
    expect(cardsSchema.parse(validCards)).toEqual(validCards);
  });

  it("rejects a wrong enum value for kind", () => {
    expect(
      cardsSchema.safeParse({ cards: [{ ...validCards.cards[0], kind: "multiple_choice" }] }).success
    ).toBe(false);
    expect(
      cardsSchema.safeParse({ cards: [{ ...validCards.cards[0], kind: "BASIC" }] }).success
    ).toBe(false);
  });

  it("rejects an empty cards array", () => {
    expect(cardsSchema.safeParse({ cards: [] }).success).toBe(false);
  });

  it("rejects an empty front or back", () => {
    expect(
      cardsSchema.safeParse({ cards: [{ ...validCards.cards[0], front: "" }] }).success
    ).toBe(false);
    expect(
      cardsSchema.safeParse({ cards: [{ ...validCards.cards[0], back: "" }] }).success
    ).toBe(false);
  });

  it("rejects a card missing source_chunk_ids", () => {
    expect(
      cardsSchema.safeParse({ cards: [{ kind: "basic", front: "Q", back: "A" }] }).success
    ).toBe(false);
  });
});

describe("quizSchema (docs/06 §4.3)", () => {
  it("accepts a valid quiz across question types", () => {
    expect(quizSchema.parse(validQuiz)).toEqual(validQuiz);
  });

  it("accepts options omitted or explicitly null for non-mcq questions", () => {
    const base = validQuiz.questions[1]!;
    expect(quizSchema.safeParse({ title: "T", questions: [base] }).success).toBe(true);
    expect(quizSchema.safeParse({ title: "T", questions: [{ ...base, options: null }] }).success).toBe(true);
  });

  it("rejects a wrong qtype enum value", () => {
    const bad = { ...validQuiz.questions[0]!, qtype: "multiple_choice" };
    expect(quizSchema.safeParse({ title: "T", questions: [bad] }).success).toBe(false);
  });

  it("rejects difficulty outside the 1–3 range", () => {
    for (const difficulty of [0, 4, 5, -1, 10]) {
      const bad = { ...validQuiz.questions[0]!, difficulty };
      expect(quizSchema.safeParse({ title: "T", questions: [bad] }).success).toBe(false);
    }
  });

  it("rejects a non-integer difficulty", () => {
    const bad = { ...validQuiz.questions[0]!, difficulty: 2.5 };
    expect(quizSchema.safeParse({ title: "T", questions: [bad] }).success).toBe(false);
  });

  it("rejects an empty questions array", () => {
    expect(quizSchema.safeParse({ title: "Empty quiz", questions: [] }).success).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(quizSchema.safeParse({ ...validQuiz, title: "" }).success).toBe(false);
  });

  it("rejects a question with no answer or no explanation (never serve an unexplained question)", () => {
    const noAnswer = { ...validQuiz.questions[0]!, answer: "" };
    const noExplanation = { ...validQuiz.questions[0]!, explanation: "" };
    expect(quizSchema.safeParse({ title: "T", questions: [noAnswer] }).success).toBe(false);
    expect(quizSchema.safeParse({ title: "T", questions: [noExplanation] }).success).toBe(false);
  });

  it("rejects options that are not strings", () => {
    const bad = { ...validQuiz.questions[0]!, options: [1, 2, 3, 4] };
    expect(quizSchema.safeParse({ title: "T", questions: [bad] }).success).toBe(false);
  });
});

describe("planSchema (docs/06 §4.5)", () => {
  it("accepts a valid plan", () => {
    expect(planSchema.parse(validPlan)).toEqual(validPlan);
  });

  it("accepts every documented item kind", () => {
    for (const kind of ["review_cards", "take_quiz", "read_note", "take_exam", "custom"]) {
      expect(planSchema.safeParse({ items: [{ ...validPlan.items[0]!, kind }] }).success).toBe(true);
    }
  });

  it("rejects an unknown kind", () => {
    expect(
      planSchema.safeParse({ items: [{ ...validPlan.items[0]!, kind: "watch_video" }] }).success
    ).toBe(false);
  });

  it("rejects a bad due_date format", () => {
    for (const due_date of ["08/07/2026", "2026-8-7", "next Tuesday", "2026-08-07T00:00:00Z", ""]) {
      expect(
        planSchema.safeParse({ items: [{ ...validPlan.items[0]!, due_date }] }).success
      ).toBe(false);
    }
  });

  it("accepts a well-formed ISO date", () => {
    expect(
      planSchema.safeParse({ items: [{ ...validPlan.items[0]!, due_date: "2026-12-31" }] }).success
    ).toBe(true);
  });

  it("rejects a negative or fractional idx", () => {
    expect(planSchema.safeParse({ items: [{ ...validPlan.items[0]!, idx: -1 }] }).success).toBe(false);
    expect(planSchema.safeParse({ items: [{ ...validPlan.items[0]!, idx: 1.5 }] }).success).toBe(false);
  });

  it("rejects an empty items array", () => {
    expect(planSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("does NOT accept an AI-emitted target_id (resolved lazily server-side, docs/06 §4.5)", () => {
    const parsed = planSchema.parse({
      items: [{ ...validPlan.items[0]!, target_id: "some-uuid" }],
    });
    expect(parsed.items[0]).not.toHaveProperty("target_id");
  });
});

describe("groundednessSchema (docs/06 §5)", () => {
  it("accepts a valid verdict payload", () => {
    const payload = {
      verdicts: [
        { sentence_idx: 0, supported: true },
        { sentence_idx: 1, supported: false },
      ],
      overall_supported_pct: 0.5,
    };
    expect(groundednessSchema.parse(payload)).toEqual(payload);
  });

  it("accepts an empty verdicts array with a 0 score", () => {
    expect(groundednessSchema.safeParse({ verdicts: [], overall_supported_pct: 0 }).success).toBe(true);
  });

  it("rejects a percentage outside 0–1 (the threshold logic assumes a fraction)", () => {
    for (const pct of [-0.1, 1.1, 80, 100]) {
      expect(
        groundednessSchema.safeParse({ verdicts: [], overall_supported_pct: pct }).success
      ).toBe(false);
    }
  });

  it("rejects a string 'supported' flag and a missing pct", () => {
    expect(
      groundednessSchema.safeParse({
        verdicts: [{ sentence_idx: 0, supported: "yes" }],
        overall_supported_pct: 1,
      }).success
    ).toBe(false);
    expect(groundednessSchema.safeParse({ verdicts: [] }).success).toBe(false);
  });
});

describe("answerKeySchema (docs/06 §6)", () => {
  it("accepts a valid verification result", () => {
    const payload = { correct: true, well_formed: true, explanation_ok: true, reason: "Matches p.3." };
    expect(answerKeySchema.parse(payload)).toEqual(payload);
  });

  it("accepts an empty reason string on a pass", () => {
    expect(
      answerKeySchema.safeParse({ correct: true, well_formed: true, explanation_ok: true, reason: "" })
        .success
    ).toBe(true);
  });

  it("rejects a missing flag — all three must be present to decide pass/fail", () => {
    expect(
      answerKeySchema.safeParse({ correct: true, well_formed: true, reason: "..." }).success
    ).toBe(false);
  });

  it("rejects string booleans (a truthy 'false' would silently pass a bad question)", () => {
    expect(
      answerKeySchema.safeParse({
        correct: "false",
        well_formed: true,
        explanation_ok: true,
        reason: "",
      }).success
    ).toBe(false);
  });
});
