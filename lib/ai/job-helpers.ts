import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { broadcastJobEvent } from "@/lib/realtime";
import { getCourseChunks, type RetrievedChunk } from "@/lib/ai/rag";
import { capturePostHog } from "@/lib/analytics/server";
import type { Course, Profile } from "@/lib/types";
import type { Artifact } from "@/lib/analytics/events";

/** Canonical error copy (docs/04 §9) — every error surface = message + recovery action. */
export const ERROR_DETAIL: Record<string, string> = {
  file_too_large: "Max 100MB — this file is too big.",
  unsupported_format: "This file type isn't supported — try another format.",
  yt_unavailable: "This video is private or region-locked.",
  yt_no_captions: "This video has no captions — download the audio and upload it instead.",
  audio_too_long: "Free plan covers recordings up to 30 minutes.",
  extract_empty: "We couldn't find readable text. Try a clearer scan.",
  insufficient_material: "Not enough material on this topic yet.",
  ai_invalid_output: "Generation hiccuped — retry.",
  ai_overloaded: "Our AI is busy — retrying automatically.",
  limit_reached: "You've used your free quota for this.",
  payment_failed: "Payment failed — update your card.",
};

export async function loadGenerationContext(
  admin: SupabaseClient,
  courseId: string
): Promise<{ course: Course; profile: Profile | null; chunks: RetrievedChunk[] }> {
  const { data: course } = await admin.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!course) throw new Error("course not found");
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", course.user_id)
    .maybeSingle();
  const chunks = await getCourseChunks(courseId);
  return { course: course as Course, profile: (profile ?? null) as Profile | null, chunks };
}

/** Job failure: set status='failed' + error code/detail, broadcast, log.
 *  MUST leave prior artifacts untouched (data-durability rule, docs/04 §6). */
export async function failArtifact(
  admin: SupabaseClient,
  artifact: Artifact,
  rowId: string,
  userId: string,
  code: string
): Promise<void> {
  const table = artifact === "notes" ? "notes" : artifact === "plan" ? null : "quizzes";
  if (table) {
    await admin.from(table).update({ status: "failed" }).eq("id", rowId);
  }
  await broadcastJobEvent(rowId, {
    stage: "failed",
    artifact,
    error_code: code,
    error_detail: ERROR_DETAIL[code] ?? "Generation hiccuped — retry.",
  });
  await capturePostHog(userId, "generation_failed", { artifact, error_code: code });
}
