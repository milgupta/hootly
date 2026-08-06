import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import { REFUND_WINDOW_DAYS } from "@/lib/billing/plans";
import { capturePostHog } from "@/lib/analytics/server";
import { sendRefundEmail } from "@/lib/email";
import { env } from "@/lib/env";

/** Self-serve refund (docs/07 §1.4): visible when the latest paid invoice is
 *  <7 days old → full refund + cancel now + plan→free + email + PostHog.
 *  No human in the loop. Existing content is NEVER locked or deleted. */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    // TODO(key-needed): STRIPE_SECRET_KEY missing — the refund flow is fully wired below.
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "no_subscription" }, { status: 400 });
  }

  const invoices = await stripe.invoices.list({
    customer: sub.stripe_customer_id,
    status: "paid",
    limit: 1,
  });
  const invoice = invoices.data[0];
  if (!invoice) return NextResponse.json({ error: "no_paid_invoice" }, { status: 400 });

  const daysSince = (Date.now() / 1000 - invoice.created) / 86_400;
  if (daysSince > REFUND_WINDOW_DAYS) {
    return NextResponse.json(
      { error: "outside_window", days_since_charge: Math.floor(daysSince) },
      { status: 400 }
    );
  }

  const paymentIntentId =
    typeof (invoice as unknown as { payment_intent?: string | { id: string } }).payment_intent === "string"
      ? ((invoice as unknown as { payment_intent: string }).payment_intent)
      : ((invoice as unknown as { payment_intent?: { id: string } }).payment_intent?.id ?? null);
  if (!paymentIntentId) return NextResponse.json({ error: "no_payment_intent" }, { status: 400 });

  await stripe.refunds.create({ payment_intent: paymentIntentId });

  if (sub.stripe_subscription_id) {
    await stripe.subscriptions.cancel(sub.stripe_subscription_id);
  }

  const admin = createAdminClient();
  await admin
    ?.from("subscriptions")
    .update({ plan: "free", status: "canceled", cancel_at_period_end: false })
    .eq("user_id", user.id);

  const amount = `$${((invoice.amount_paid ?? 0) / 100).toFixed(2)}`;
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.email) await sendRefundEmail(profile.email, amount);

  await capturePostHog(user.id, "refund_selfserve", { days_since_charge: Math.floor(daysSince) });

  const wantsJson = request.headers.get("content-type")?.includes("application/json");
  return wantsJson
    ? NextResponse.json({ ok: true, amount })
    : NextResponse.redirect(`${env.appUrl}/settings?tab=billing&refunded=1`, { status: 303 });
}
