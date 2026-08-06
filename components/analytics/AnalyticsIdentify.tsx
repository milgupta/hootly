"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { captureEvent, identifyUser, initPostHog } from "@/lib/analytics/posthog";

/** identify(user_id, {plan, study_level, is_edu}) after auth (docs/07 §2.1),
 *  plus auth_paint_measured on the first paint after an OAuth callback
 *  (budget <2000ms — docs/07 §2.2, §3). */
export function AnalyticsIdentify({
  userId,
  plan,
  studyLevel,
  isEdu,
}: {
  userId: string;
  plan: string;
  studyLevel: string | null;
  isEdu: boolean;
}) {
  const searchParams = useSearchParams();
  const measured = React.useRef(false);

  React.useEffect(() => {
    initPostHog();
    identifyUser(userId, { plan, study_level: studyLevel, is_edu: isEdu });
  }, [userId, plan, studyLevel, isEdu]);

  React.useEffect(() => {
    if (measured.current || searchParams.get("authed") !== "1") return;
    measured.current = true;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paint = performance
      .getEntriesByType("paint")
      .find((p) => p.name === "first-contentful-paint");
    const ms = Math.round(paint?.startTime ?? nav?.domContentLoadedEventEnd ?? 0);
    if (ms > 0) captureEvent("auth_paint_measured", { ms });
  }, [searchParams]);

  return null;
}
