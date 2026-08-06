import { z } from "zod";

/** Zod schemas for all AI outputs (docs/06) — structured outputs, strict. */

export const notesOutlineSchema = z.object({
  sections: z
    .array(
      z.object({
        heading: z.string().min(1),
        covers_chunk_ids: z.array(z.string()),
      })
    )
    .min(1)
    .max(20),
});
export type NotesOutline = z.infer<typeof notesOutlineSchema>;

export const noteSectionSchema = z.object({
  heading: z.string().min(1),
  body_md: z.string().min(1),
  source_chunk_ids: z.array(z.string()),
});
export type NoteSectionOut = z.infer<typeof noteSectionSchema>;

export const cardsSchema = z.object({
  cards: z
    .array(
      z.object({
        kind: z.enum(["basic", "reversed", "cloze"]),
        front: z.string().min(1),
        back: z.string().min(1),
        source_chunk_ids: z.array(z.string()),
      })
    )
    .min(1),
});
export type CardsOut = z.infer<typeof cardsSchema>;

export const quizSchema = z.object({
  title: z.string().min(1),
  questions: z
    .array(
      z.object({
        qtype: z.enum(["mcq", "true_false", "fill_blank", "short_answer"]),
        topic: z.string(),
        prompt: z.string().min(1),
        options: z.array(z.string()).nullable().optional(),
        answer: z.string().min(1),
        explanation: z.string().min(1),
        source_chunk_ids: z.array(z.string()),
        difficulty: z.number().int().min(1).max(3),
      })
    )
    .min(1),
});
export type QuizOut = z.infer<typeof quizSchema>;

export const planSchema = z.object({
  items: z
    .array(
      z.object({
        idx: z.number().int().min(0),
        title: z.string().min(1),
        kind: z.enum(["review_cards", "take_quiz", "read_note", "take_exam", "custom"]),
        topic: z.string(),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .min(1),
});
export type PlanOut = z.infer<typeof planSchema>;

export const groundednessSchema = z.object({
  verdicts: z.array(z.object({ sentence_idx: z.number().int(), supported: z.boolean() })),
  overall_supported_pct: z.number().min(0).max(1),
});
export type GroundednessOut = z.infer<typeof groundednessSchema>;

export const answerKeySchema = z.object({
  correct: z.boolean(),
  well_formed: z.boolean(),
  explanation_ok: z.boolean(),
  reason: z.string(),
});
export type AnswerKeyOut = z.infer<typeof answerKeySchema>;
