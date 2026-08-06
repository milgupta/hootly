"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { OllieAnimated } from "@/components/ollie/OllieAnimated";
import { ErrorTracker } from "@/components/analytics/ErrorTracker";

/**
 * Shared route-level error surface (docs/05 §11 copy, docs/03 §8 gate item 10:
 * every async surface needs an error state WITH a recovery action). Ollie is
 * concerned, not comedic; nothing here is red because nothing is destructive.
 */
export function RouteError({
  reset,
  backHref,
  backLabel = "Go home",
}: {
  reset: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <Card className="mx-auto max-w-[520px] p-0">
      <ErrorTracker errorCode="unhandled_error" />
      <EmptyState
        ollie={<OllieAnimated mode="concerned" size={72} />}
        message="Something broke on our end. Your data is safe — try refreshing."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> Refresh
            </Button>
            {backHref && (
              <Link href={backHref}>
                <Button variant="secondary">{backLabel}</Button>
              </Link>
            )}
          </div>
        }
      />
    </Card>
  );
}
