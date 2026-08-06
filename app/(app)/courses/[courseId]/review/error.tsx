"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { ErrorTracker } from "@/components/analytics/ErrorTracker";

/** Error state with recovery (docs/03 §8.10, copy per docs/05 §11).
 *  Ratings already saved are safe — persistence is per rating. */
export default function ReviewError({ reset }: { error: Error; reset: () => void }) {
  const params = useParams<{ courseId: string }>();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg px-4">
      <ErrorTracker errorCode="unhandled_error" />
      <EmptyState
        ollie={<OllieAnimated mode="concerned" size={80} />}
        message="Something broke on our end. Your ratings are already saved — try refreshing."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = params?.courseId ? `/courses/${params.courseId}` : "/home";
              }}
            >
              Back to course
            </Button>
          </div>
        }
      />
    </div>
  );
}
