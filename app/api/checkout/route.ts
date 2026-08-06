import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import { EDU_COUPON_ID, LOOKUP_KEYS } from "@/lib/billing/plans";
import { env } from "@/lib/env";

const bodySchema = z.object({ interval: z.enum(["month", "year"]) });

/** Checkout (docs/07 §1.2): mode subscription, price by lookup_key.
 *  Discounts are mutually exclusive — Stripe rejects coupon + promo codes together:
 *  .edu → coupon edu20 applied server-side; otherwise allow_promotion_codes.
 *  NO trial period — the free tier IS the trial. */
export async function POST(request: Request) {
  const raw = request.headers.get("content-type")?.includes("application/json")
    ? await request.json()
    : Object.fromEntries(await request.formData());
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    // TODO(key-needed): STRIPE_SECRET_KEY missing — checkout is fully wired below.
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, is_edu")
    .eq("id", user.id)
    .maybeSingle();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Existing customer or create one, storing the id.
  let customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin
      ?.from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id);
  }

  const lookupKey = parsed.data.interval === "year" ? LOOKUP_KEYS.annual : LOOKUP_KEYS.monthly;
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const price = prices.data[0];
  if (!price) {
    return NextResponse.json({ error: "price_not_found", lookupKey }, { status: 500 });
  }

  const origin = request.headers.get("origin") ?? env.appUrl;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: price.id, quantity: 1 }],
    // Mutually exclusive by Stripe's rules.
    ...(profile?.is_edu
      ? { discounts: [{ coupon: EDU_COUPON_ID }] }
      : { allow_promotion_codes: true }),
    success_url: `${env.appUrl}/home?upgraded=1`,
    cancel_url: origin,
    subscription_data: { metadata: { user_id: user.id } },
    billing_address_collection: "auto",
    client_reference_id: user.id,
  });

  if (!session.url) return NextResponse.json({ error: "session_failed" }, { status: 500 });
  // Form posts get a redirect; fetch callers get the URL.
  const wantsJson = request.headers.get("content-type")?.includes("application/json");
  return wantsJson
    ? NextResponse.json({ url: session.url })
    : NextResponse.redirect(session.url, { status: 303 });
}
