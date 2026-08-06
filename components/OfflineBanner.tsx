"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Offline banner — docs/05 §11 copy, verbatim.
 * Reusable: mount once per shell. Driven by navigator.onLine + online/offline events.
 * Motion is opacity/transform only, 200ms (docs/03 §5).
 */
export function OfflineBanner({ className }: { className?: string }) {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "toast-in fixed inset-x-0 bottom-4 z-50 flex justify-center px-4",
        className
      )}
    >
      <p className="text-small flex items-center gap-2 rounded-ctl border border-border bg-surface px-4 py-2.5 text-ink shadow-md">
        <WifiOff className="size-4 shrink-0 text-ink-2" aria-hidden />
        You&#8217;re offline. We&#8217;ll sync when you&#8217;re back.
      </p>
    </div>
  );
}
