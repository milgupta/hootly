import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Server → client job progress over Supabase Realtime private channels
 *  (docs/04 §8). Channel 'job:{id}'; jobs broadcast via service role.
 *  Never throws — progress is best-effort, job state is the source of truth. */
export async function broadcastJobEvent(
  resourceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return; // TODO(key-needed)
  try {
    const channel = admin.channel(`job:${resourceId}`, { config: { private: true } });
    await channel.send({ type: "broadcast", event: "progress", payload });
    await admin.removeChannel(channel);
  } catch {
    // Best-effort only.
  }
}
