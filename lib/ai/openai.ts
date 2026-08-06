import "server-only";
import OpenAI from "openai";
import { env, hasOpenAIEnv } from "@/lib/env";

let client: OpenAI | null = null;

/** OpenAI client (server only). Null when OPENAI_API_KEY is missing. */
export function getOpenAI(): OpenAI | null {
  // TODO(key-needed): remove the guard once OPENAI_API_KEY is set.
  if (!hasOpenAIEnv) return null;
  if (!client) client = new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}
