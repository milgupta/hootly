"use server";

import { createClient } from "@/lib/supabase/server";
import { sendInngestEvent } from "@/lib/inngest-send";
import type { ActionResult } from "@/app/(app)/actions";

/** GDPR/CCPA export: async job zips user data + files, emails a signed link. */
export async function requestExport(): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const sent = await sendInngestEvent({
    name: "account/export",
    data: { userId: user.id },
  });
  if (!sent) return { ok: false, error: "Export isn't configured yet on this deployment." };
  return { ok: true };
}
