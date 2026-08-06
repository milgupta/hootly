"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import type { ActionResult } from "@/app/(app)/actions";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  studyLevel: z
    .enum(["college", "grad", "high_school", "med", "professional_cert", "standardized_test", "other"])
    .nullable(),
});

export async function updateProfile(input: {
  displayName: string;
  studyLevel: string | null;
}): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Name is required (max 80 characters)." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      study_level: parsed.data.studyLevel,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setMarketingEmails(enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { error } = await supabase
    .from("profiles")
    .update({ marketing_emails: enabled })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save — try again." };
  revalidatePath("/settings");
  return { ok: true };
}

/** Account deletion (docs/04 §4): typed-confirm upstream. Sets deletion_requested_at,
 *  cancels any Stripe sub immediately, signs the user out. 30-day grace purge via cron. */
export async function deleteAccount(typedConfirm: string): Promise<ActionResult> {
  if (typedConfirm !== "DELETE") {
    return { ok: false, error: 'Type "DELETE" to confirm.' };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Account deletion isn't configured yet on this deployment." };

  // Cancel any active Stripe subscription immediately.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (sub?.stripe_subscription_id) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch {
        // Already canceled or missing — deletion proceeds regardless.
      }
    }
    // TODO(key-needed): with STRIPE_SECRET_KEY missing, the sub is only marked locally.
    await admin
      .from("subscriptions")
      .update({ plan: "free", status: "canceled", stripe_subscription_id: null })
      .eq("user_id", user.id);
  }

  await admin
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", user.id);

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}

/** Login-during-grace restore ("Your account is scheduled for deletion — Restore?"). */
export async function restoreAccount(): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected to a database yet." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Not configured." };
  const { error } = await admin
    .from("profiles")
    .update({ deletion_requested_at: null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't restore — contact support." };
  revalidatePath("/", "layout");
  return { ok: true };
}
