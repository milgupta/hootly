import "server-only";
import { inngest } from "@/inngest/client";

/** Send an Inngest event; returns false (never throws) when Inngest isn't reachable.
 *  In dev without keys, the local Inngest dev server still accepts events. */
export async function sendInngestEvent(event: {
  name: string;
  data: Record<string, unknown>;
}): Promise<boolean> {
  try {
    await inngest.send(event);
    return true;
  } catch {
    // TODO(key-needed): INNGEST_EVENT_KEY missing and no dev server running.
    return false;
  }
}
