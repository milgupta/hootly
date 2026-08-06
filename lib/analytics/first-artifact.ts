import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { capturePostHog } from "@/lib/analytics/server";
import type { Artifact } from "@/lib/analytics/events";

/** first_artifact_generated fires ONCE per user — the activation metric (docs/07 §2.2).
 *  Determined by whether the user has any other artifact rows yet. */
export async function markFirstArtifact(userId: string, artifact: Artifact): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const [notes, quizzes, cards] = await Promise.all([
    admin.from("notes").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "ready"),
    admin.from("quizzes").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "ready"),
    admin.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const total = (notes.count ?? 0) + (quizzes.count ?? 0) + (cards.count ?? 0);
  // The just-finished artifact is already counted; >1 means it wasn't the first.
  if (total <= 1) {
    await capturePostHog(userId, "first_artifact_generated", { artifact });
  }
}
