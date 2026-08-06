"use client";

import * as React from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { env, hasPostHogEnv } from "@/lib/env";
import type { EventName, EventProps } from "./events";

let initialized = false;

export function initPostHog(): void {
  // TODO(key-needed): remove the guard once NEXT_PUBLIC_POSTHOG_KEY is set.
  if (!hasPostHogEnv || initialized || typeof window === "undefined") return;
  posthog.init(env.posthogKey, {
    api_host: env.posthogHost,
    person_profiles: "identified_only",
    autocapture: true,
    session_recording: { maskAllInputs: true },
  });
  initialized = true;
}

/** Typed client capture — the ONLY client entry point for custom events. */
export function captureEvent<E extends EventName>(event: E, properties?: EventProps[E]): void {
  if (!hasPostHogEnv) return;
  posthog.capture(event, properties as Record<string, unknown>);
}

export function identifyUser(
  userId: string,
  props: { plan: string; study_level: string | null; is_edu: boolean }
): void {
  if (!hasPostHogEnv) return;
  posthog.identify(userId, props);
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    initPostHog();
  }, []);
  if (!hasPostHogEnv) return <>{children}</>;
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
