import "server-only";
import type { z } from "zod";
import { getOpenAI } from "@/lib/ai/openai";

/** JSON generation contract (docs/06 intro): structured outputs, temperature 0.4
 *  for generation / 0.7 for tutor. Retry malformed output ONCE with the validation
 *  error appended; then fail with error_code 'ai_invalid_output'. */

export class AIInvalidOutputError extends Error {
  code = "ai_invalid_output";
  constructor(message: string) {
    super(message);
  }
}

export class AINotConfiguredError extends Error {
  code = "ai_overloaded";
  constructor() {
    super("openai_not_configured");
  }
}

export interface GenerateJsonResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function generateJson<T>(args: {
  model: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
}): Promise<GenerateJsonResult<T>> {
  const openai = getOpenAI();
  // TODO(key-needed): OPENAI_API_KEY missing — every generation path above is complete.
  if (!openai) throw new AINotConfiguredError();

  let prompt = args.prompt;
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai.chat.completions.create({
      model: args.model,
      temperature: args.temperature ?? 0.4,
      max_tokens: args.maxTokens ?? 8000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.choices[0]?.message?.content ?? "";
    const usage = {
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    };
    try {
      const parsed = args.schema.parse(JSON.parse(text));
      return { data: parsed, ...usage, model: args.model };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      prompt = `${args.prompt}\n\nYour previous output was invalid: ${lastError}\nReturn ONLY valid JSON matching the schema exactly.`;
    }
  }
  throw new AIInvalidOutputError(lastError);
}
