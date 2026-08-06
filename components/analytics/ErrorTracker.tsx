"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { captureEvent } from "@/lib/analytics/posthog";

/** error_shown — captured on ANY error surface (docs/07 §2.2), with the
 *  canonical error code from docs/04 §9 and the screen it appeared on.
 *  Renders nothing; drop it into an error state. */
export function ErrorTracker({ errorCode }: { errorCode: string }) {
  const pathname = usePathname();
  const reported = React.useRef(false);

  React.useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    captureEvent("error_shown", { error_code: errorCode, screen: pathname });
  }, [errorCode, pathname]);

  return null;
}

/** Imperative variant for handlers that surface an error toast/banner. */
export function reportErrorShown(errorCode: string, screen: string): void {
  captureEvent("error_shown", { error_code: errorCode, screen });
}
