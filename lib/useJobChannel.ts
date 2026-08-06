"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export interface JobEvent {
  stage?: string;
  pct?: number;
  error_code?: string;
  error_detail?: string;
  [key: string]: unknown;
}

/** Subscribe to the private Realtime channel 'job:{id}' (docs/04 §8).
 *  Progress is real — no fake timers anywhere. */
export function useJobChannel(id: string | null, onEvent: (e: JobEvent) => void): void {
  const handler = React.useRef(onEvent);
  handler.current = onEvent;

  React.useEffect(() => {
    if (!id) return;
    const supabase = createClient();
    if (!supabase) return;
    let active = true;

    const channel = supabase.channel(`job:${id}`, { config: { private: true } });
    channel.on("broadcast", { event: "progress" }, (msg) => {
      if (active) handler.current((msg.payload ?? {}) as JobEvent);
    });
    void supabase.realtime.setAuth().then(() => channel.subscribe());

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [id]);
}
