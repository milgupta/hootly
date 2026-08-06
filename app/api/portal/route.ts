import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

/** Customer Portal (docs/07 §1.3) — cancel lives here: 2 clicks total from
 *  Settings → Billing → Manage billing → Cancel. No email maze, no retention flow. */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    // TODO(key-needed): STRIPE_SECRET_KEY missing.
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) {
    return NextResponse.redirect(`${env.appUrl}/pricing`, { status: 303 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${env.appUrl}/settings?tab=billing`,
  });

  const wantsJson = request.headers.get("content-type")?.includes("application/json");
  return wantsJson
    ? NextResponse.json({ url: session.url })
    : NextResponse.redirect(session.url, { status: 303 });
}
