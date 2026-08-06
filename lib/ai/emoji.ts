import "server-only";
import { getOpenAI } from "@/lib/ai/openai";
import { env } from "@/lib/env";

/** Course emoji auto-suggest — tiny BULK-model call on the course name,
 *  fallback 📚 (docs/04 §7 mechanism notes). Never throws. */
export async function suggestCourseEmoji(courseName: string): Promise<string> {
  const openai = getOpenAI();
  if (!openai) return "📚"; // TODO(key-needed): OPENAI_API_KEY missing.
  try {
    const res = await openai.chat.completions.create({
      model: env.modelBulk,
      max_tokens: 5,
      temperature: 0.4,
      messages: [
        {
          role: "user",
          content: `Reply with exactly one emoji that best represents this course subject, nothing else: "${courseName.slice(0, 120)}"`,
        },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    // Accept only a short emoji-ish reply; otherwise fall back.
    if (text && [...text].length <= 3 && !/[a-zA-Z0-9]/.test(text)) return text;
    return "📚";
  } catch {
    return "📚";
  }
}
