import "server-only";
import { PostHog } from "posthog-node";
import { env, hasPostHogEnv } from "@/lib/env";
import type { EventName, EventProps } from "@/lib/analytics/events";

let client: PostHog | null = null;

function getPostHog(): PostHog | null {
  // TODO(key-needed): remove the guard once NEXT_PUBLIC_POSTHOG_KEY is set.
  if (!hasPostHogEnv) return null;
  if (!client) {
    client = new PostHog(env.posthogKey, { host: env.posthogHost, flushAt: 1, flushInterval: 0 });
  }
  return client;
}

/** Server-side capture (actions/webhooks/jobs) — same distinct_id as the client. */
export async function capturePostHog<E extends EventName>(
  distinctId: string,
  event: E,
  properties?: EventProps[E]
): Promise<void> {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.capture({ distinctId, event, properties: properties as Record<string, unknown> });
    await ph.flush();
  } catch {
    // Analytics must never break product flows.
  }
}
