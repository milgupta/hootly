import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, hasOpenAIEnv } from "@/lib/env";
import { tutorSystemPrompt, preambleFor } from "@/lib/ai/prompts";
import { INTEGRITY_INSTRUCTION, runInputGate } from "@/lib/ai/guardrails";
import {
  buildChunkContext, extractChunkMarkers, resolveCitations, retrieveChunks,
  LOW_CONFIDENCE_MIN,
} from "@/lib/ai/rag";
import { checkQuota, incrementUsage } from "@/lib/billing/usage";
import { capturePostHog } from "@/lib/analytics/server";
import type { Citation } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = z.object({
  threadId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

/** Streaming tutor (docs/06 §4.4, docs/05 §7.6). Pipeline per message:
 *  quota → input gate (moderation + classifier) → RAG retrieve → stream →
 *  strip GENERAL_KNOWLEDGE marker → parse [chunk:ID] into citations → persist. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { threadId, message } = parsed.data;

  const supabase = await createClient();
  if (!supabase) return Response.json({ error: "not_configured" }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, course_id, socratic, title")
    .eq("id", threadId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!thread) return Response.json({ error: "not_found" }, { status: 404 });

  // ---- quota: tutor_messages is a monthly bucket -------------------------
  const quota = await checkQuota(user.id, "tutor_messages");
  if (!quota.allowed) {
    await capturePostHog(user.id, "limit_hit", { metric: "tutor_messages" });
    return Response.json({ error: "limit_reached", metric: "tutor_messages" }, { status: 402 });
  }

  const admin = createAdminClient();
  const [{ data: course }, { data: profile }, { data: history }] = await Promise.all([
    supabase.from("courses").select("name, familiarity").eq("id", thread.course_id).single(),
    supabase.from("profiles").select("study_level").eq("id", user.id).maybeSingle(),
    supabase
      .from("chat_messages")
      .select("role, content_md")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  // Persist the user's message immediately (nothing is ever silently lost).
  await supabase.from("chat_messages").insert({
    thread_id: threadId,
    user_id: user.id,
    role: "user",
    content_md: message,
  });

  // ---- input gate --------------------------------------------------------
  const { data: sections } = await supabase
    .from("note_sections")
    .select("heading, notes!inner(course_id)")
    .eq("notes.course_id", thread.course_id)
    .limit(30);
  const courseTerms = [
    course?.name ?? "",
    ...((sections ?? []).map((s) => s.heading as string)),
  ];
  const topTopic = (sections ?? [])[0]?.heading ?? course?.name ?? "your course";

  const gate = await runInputGate({ text: message, courseTerms, topCourseTopic: topTopic as string });
  if (gate.layer) {
    await capturePostHog(user.id, "ai_guardrail_triggered", {
      layer: gate.layer,
      decision: gate.decision,
    });
  }
  if (!gate.allowed && gate.message) {
    // Refusal renders as a normal friendly Ollie message (docs/05 §7.6).
    await supabase.from("chat_messages").insert({
      thread_id: threadId,
      user_id: user.id,
      role: "assistant",
      content_md: gate.message,
      citations: [],
      used_general_knowledge: false,
    });
    await incrementUsage(user.id, "tutor_messages");
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(gate.message));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Hootly-Guardrail": gate.decision } }
    );
  }

  // ---- RAG ---------------------------------------------------------------
  let contextBlock = "";
  let prefixToUuid = new Map<string, string>();
  let chunkMeta = new Map<string, Citation>();
  let lowConfidence = true;
  try {
    const chunks = await retrieveChunks(thread.course_id, message);
    lowConfidence = chunks.length < LOW_CONFIDENCE_MIN;
    const ctx = buildChunkContext(chunks, 8000); // ≤8k tokens for tutor
    contextBlock = ctx.block;
    prefixToUuid = ctx.prefixToUuid;
    chunkMeta = new Map(
      ctx.chunks.map((c) => [
        c.id,
        {
          chunk_id: c.id,
          material_title: c.material_title,
          page: c.page,
          start_seconds: c.start_seconds,
        } satisfies Citation,
      ])
    );
  } catch {
    // Retrieval unavailable → the model answers from general knowledge and the
    // UI shows the banner; never claim grounding we don't have.
    contextBlock = "(no sources available)";
  }
  if (lowConfidence && contextBlock !== "(no sources available)") {
    contextBlock += "\n\n(Fewer than 3 sources cleared the confidence floor — if these don't cover the question, use the GENERAL_KNOWLEDGE marker.)";
  }

  // Recent quiz misses feed the tutor's context (docs/06 §4.4).
  let recentMisses = "none";
  if (admin) {
    const { data: misses } = await admin
      .from("attempt_answers")
      .select("is_correct, quiz_questions!inner(topic, quiz_id)")
      .eq("user_id", user.id)
      .eq("is_correct", false)
      .order("answered_at", { ascending: false })
      .limit(10);
    const topics = [
      ...new Set(
        (misses ?? [])
          .map((m) => (m.quiz_questions as unknown as { topic: string | null }).topic)
          .filter((t): t is string => Boolean(t))
      ),
    ];
    if (topics.length > 0) recentMisses = topics.slice(0, 5).join(", ");
  }

  let system = tutorSystemPrompt({
    preamble: preambleFor(profile?.study_level ?? null),
    course: course?.name ?? "your course",
    studyLevel: profile?.study_level ?? null,
    recentMisses,
    socratic: thread.socratic,
    sources: contextBlock,
  });
  if (gate.integrityRedirect) system += `\n${INTEGRITY_INSTRUCTION}`;

  if (!hasOpenAIEnv) {
    // TODO(key-needed): OPENAI_API_KEY missing — everything above is fully wired.
    return Response.json({ error: "ai_not_configured" }, { status: 503 });
  }

  const openai = createOpenAI({ apiKey: env.openaiApiKey });
  const started = Date.now();

  const result = streamText({
    model: openai(env.modelTutor),
    system,
    temperature: 0.7,
    messages: [
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content_md as string,
      })),
      { role: "user" as const, content: message },
    ],
    onFinish: async ({ text }) => {
      // Client contract (docs/06 §4.4): strip the marker, set the flag,
      // parse [chunk:ID] into citation chips, persist raw + rendered.
      const usedGeneral = /^\s*GENERAL_KNOWLEDGE\s*$/m.test(text.split("\n")[0] ?? "");
      const body = usedGeneral ? text.replace(/^\s*GENERAL_KNOWLEDGE\s*\n?/, "") : text;
      const citedIds = resolveCitations(extractChunkMarkers(body), prefixToUuid);
      const citations = citedIds
        .map((id) => chunkMeta.get(id))
        .filter((c): c is Citation => Boolean(c));

      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        user_id: user.id,
        role: "assistant",
        content_md: body,
        citations,
        used_general_knowledge: usedGeneral,
      });
      await incrementUsage(user.id, "tutor_messages");
      await capturePostHog(user.id, "tutor_message_sent", {
        grounded: !usedGeneral && citations.length > 0,
        socratic: thread.socratic,
        latency_ms: Date.now() - started,
      });
      // First user message names the thread.
      if ((history ?? []).length === 0) {
        await supabase
          .from("chat_threads")
          .update({ title: message.slice(0, 60) })
          .eq("id", threadId);
      }
    },
  });

  return result.toTextStreamResponse();
}
