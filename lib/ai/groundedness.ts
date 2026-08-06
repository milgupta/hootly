import "server-only";
import { env } from "@/lib/env";
import { generateJson } from "@/lib/ai/generate";
import { groundednessSchema } from "@/lib/ai/schemas";
import { groundednessPrompt, answerKeyPrompt } from "@/lib/ai/prompts";
import { answerKeySchema } from "@/lib/ai/schemas";

/** §5 Groundedness pass (CHECK model, notes sections).
 *  Rule: overall_supported_pct < 0.8 → grounded=false (amber badge);
 *        < 0.5 → regenerate once, then flag. */
export const GROUNDED_FLAG_THRESHOLD = 0.8;
export const GROUNDED_REGEN_THRESHOLD = 0.5;

export async function checkGroundedness(
  sectionBody: string,
  citedChunks: string
): Promise<number> {
  const content = `${sectionBody}\n\nCITED CHUNKS:\n${citedChunks}`;
  const res = await generateJson({
    model: env.modelCheck,
    prompt: groundednessPrompt(content),
    schema: groundednessSchema,
    temperature: 0.4,
    maxTokens: 2000,
  });
  return res.data.overall_supported_pct;
}

/** §6 Quiz answer-key verification (CHECK model, per question).
 *  All three flags must be true or the question is regenerated (max 2 tries,
 *  else dropped and the count backfilled). */
export async function verifyAnswerKey(args: {
  sources: string;
  question: string;
  explanation: string;
  answer: string;
  qtype: string;
  options?: string[] | null;
}): Promise<{ ok: boolean; reason: string }> {
  const res = await generateJson({
    model: env.modelCheck,
    prompt: answerKeyPrompt(args),
    schema: answerKeySchema,
    temperature: 0.4,
    maxTokens: 500,
  });
  const { correct, well_formed, explanation_ok, reason } = res.data;
  return { ok: correct && well_formed && explanation_ok, reason };
}

/** fill_blank leak check (docs/06 §8 eval #5): the answer must not appear
 *  verbatim in the prompt. Cheap deterministic guard before the model check. */
export function fillBlankLeaks(prompt: string, answer: string): boolean {
  const a = answer.trim().toLowerCase();
  if (a.length < 3) return false;
  return prompt.toLowerCase().includes(a);
}
