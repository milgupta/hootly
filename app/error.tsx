"use client";

import * as React from "react";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { ErrorTracker } from "@/components/analytics/ErrorTracker";

/**
 * 500 — copy verbatim from docs/05 §11. Two recovery actions: "Refresh" (retries the
 * segment via reset()) and "Contact support". Ollie is concerned, not comedic; the
 * message is factual (docs/03 §6). No red: nothing here is destructive, and the
 * failure is already stated in words.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <ErrorTracker errorCode="unhandled_error" />
      <div className="flex flex-col items-center text-center">
        {/* Hero glow sits behind the art only — never under text (docs/03 §1). */}
        <div className="relative flex justify-center">
          <div
            className="gradient-hero-glow pointer-events-none absolute inset-x-[-120px] -top-4 bottom-0"
            aria-hidden
          />
          <OllieAnimated mode="concerned" size={96} />
        </div>

        <h1 className="text-h1 mt-8 text-ink">Something broke on our end.</h1>
        <p className="text-body mt-2 max-w-[46ch] text-ink-2">
          Your data is safe — try refreshing.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="gradient-button-depth focus-ring inline-flex h-10 items-center justify-center rounded-ctl px-4 text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            Refresh
          </button>
          <a
            href="mailto:support@hootly.app?subject=Something%20broke%20on%20Hootly"
            className="focus-ring inline-flex h-10 items-center justify-center rounded-ctl border border-border bg-surface px-4 text-[15px] font-semibold text-ink transition-all duration-150 hover:border-primary-border hover:shadow-md active:scale-[0.98]"
          >
            Contact support
          </a>
        </div>

        {error.digest && (
          <p className="text-small mt-6 tabular-nums text-ink-3">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
