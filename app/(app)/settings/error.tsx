"use client";

import * as React from "react";
import { RouteError } from "@/components/ui/RouteError";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return <RouteError reset={reset} backHref="/home" backLabel="Go home" />;
}
