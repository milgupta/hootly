"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/RouteError";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return <RouteError reset={reset} />;
}
