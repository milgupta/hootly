import "server-only";
import { getOpenAI } from "@/lib/ai/openai";
import { env } from "@/lib/env";
import { classifierPrompt, refusalCopy } from "@/lib/ai/prompts";

/** Input gate (docs/06 §3). Order:
 *  1. OpenAI Moderation API on user text — flagged → refusal.
 *  2. Topic classifier (CHECK model, ~50 tokens) → STUDY | INTEGRITY | OFFTOPIC.
 *  The classifier runs only when a cheap regex prefilter fires OR the message is
 *  >20 chars with no course-term overlap; otherwise we skip to save latency/cost. */

export type GuardrailDecision = "STUDY" | "INTEGRITY" | "OFFTOPIC";
export type GuardrailLayer = "moderation" | "classifier" | "integrity";

export interface GuardrailResult {
  allowed: boolean;
  decision: GuardrailDecision;
  layer?: GuardrailLayer;
  /** Ollie's reply when blocked — rendered as a normal friendly message. */
  message?: string;
  /** INTEGRITY still proceeds, but the model is told to teach, not do the work. */
  integrityRedirect?: boolean;
}

/** Obvious non-course patterns — cheap prefilter (docs/06 §3). */
const SUSPICIOUS = [
  /write (?:my|me|an?|the)\s+(essay|paper|assignment|homework|cover letter|application)/i,
  /do (?:my|this) (homework|assignment|essay|lab report)/i,
  /for my (girlfriend|boyfriend|tinder|dating|bio)\b/i,
  /\b(tinder|instagram caption|dating profile)\b/i,
  /\b(ignore (all )?(previous|prior) instructions|jailbreak|DAN mode|system prompt)\b/i,
  /\b(medical|legal|financial) advice\b/i,
  /\b(kill myself|suicide|self.harm)\b/i,
  /\b(build|code) my (side project|app|startup)\b/i,
];

export function needsClassifier(text: string, courseTerms: string[]): boolean {
  if (SUSPICIOUS.some((re) => re.test(text))) return true;
  if (text.length <= 20) return false;
  const lower = text.toLowerCase();
  const overlaps = courseTerms.some((term) => {
    const t = term.toLowerCase().trim();
    return t.length > 3 && lower.includes(t);
  });
  return !overlaps;
}

export async function runInputGate(args: {
  text: string;
  courseTerms: string[];
  topCourseTopic: string;
}): Promise<GuardrailResult> {
  const openai = getOpenAI();
  // TODO(key-needed): without OPENAI_API_KEY the gate can't run; fail open to the
  // regex prefilter only so the surrounding pipeline stays exercised.
  if (!openai) {
    if (SUSPICIOUS.some((re) => re.test(args.text))) {
      return {
        allowed: false,
        decision: "OFFTOPIC",
        layer: "classifier",
        message: refusalCopy(args.topCourseTopic),
      };
    }
    return { allowed: true, decision: "STUDY" };
  }

  // 1. Moderation
  try {
    const mod = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: args.text,
    });
    if (mod.results[0]?.flagged) {
      return {
        allowed: false,
        decision: "OFFTOPIC",
        layer: "moderation",
        message: refusalCopy(args.topCourseTopic),
      };
    }
  } catch {
    // Moderation outage must not block studying; fall through to the classifier.
  }

  // 2. Topic classifier (only when the prefilter says it's worth the call)
  if (!needsClassifier(args.text, args.courseTerms)) {
    return { allowed: true, decision: "STUDY" };
  }
  try {
    const res = await openai.chat.completions.create({
      model: env.modelCheck,
      max_tokens: 5,
      temperature: 0,
      messages: [{ role: "user", content: classifierPrompt(args.text) }],
    });
    const word = (res.choices[0]?.message?.content ?? "").trim().toUpperCase();
    if (word.startsWith("INTEGRITY")) {
      // Still helpful: offer outline/explanation instead of submittable work.
      return { allowed: true, decision: "INTEGRITY", layer: "integrity", integrityRedirect: true };
    }
    if (word.startsWith("OFFTOPIC")) {
      return {
        allowed: false,
        decision: "OFFTOPIC",
        layer: "classifier",
        message: refusalCopy(args.topCourseTopic),
      };
    }
  } catch {
    // Classifier outage: allow, the system preamble still constrains behavior.
  }
  return { allowed: true, decision: "STUDY" };
}

/** Appended to the system prompt when the classifier says INTEGRITY. */
export const INTEGRITY_INSTRUCTION = `The student's request looks like it asks for work they'd submit as their own. Do NOT produce it. Warmly decline in one sentence, then offer the learning alternative: explain the concept, outline how they'd approach it, or quiz them on it.`;
