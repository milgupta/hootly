import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { capturePostHog } from "@/lib/analytics/server";
import { sendPaymentFailedEmail } from "@/lib/email";

/** Stripe webhooks (docs/07 §1.5): verify signature, idempotency via stripe_events.
 *  Downgrade rule (trust-critical): free limits gate CREATING new things, never
 *  ACCESSING existing ones — content is never locked or deleted. */
export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!stripe || !env.stripeWebhookSecret || !signature) {
    // TODO(key-needed): STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET missing.
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // Idempotency: stripe_events(id) primary key — a duplicate insert means we've
  // already processed this event, so acknowledge and stop.
  const { error: dupe } = await admin.from("stripe_events").insert({ id: event.id });
  if (dupe) return NextResponse.json({ received: true, duplicate: true });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId =
        session.client_reference_id ??
        (typeof session.subscription === "string" ? null : null);
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const resolvedUserId = userId ?? subscription.metadata?.user_id ?? null;
        const interval = subscription.items.data[0]?.price.recurring?.interval ?? "month";
        if (resolvedUserId) {
          await admin
            .from("subscriptions")
            .update({
              plan: "plus",
              stripe_customer_id:
                typeof session.customer === "string" ? session.customer : session.customer?.id,
              stripe_subscription_id: subscriptionId,
              interval,
              status: subscription.status,
              current_period_end: periodEnd(subscription),
              cancel_at_period_end: subscription.cancel_at_period_end,
            })
            .eq("user_id", resolvedUserId);
          await capturePostHog(resolvedUserId, "checkout_completed", {
            interval: interval === "year" ? "year" : "month",
            revenue: (session.amount_total ?? 0) / 100,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const userId = await userIdForSubscription(admin, subscription);
      if (userId) {
        const interval = subscription.items.data[0]?.price.recurring?.interval ?? null;
        await admin
          .from("subscriptions")
          .update({
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: periodEnd(subscription),
            interval,
            plan: subscription.status === "canceled" ? "free" : "plus",
          })
          .eq("user_id", userId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const userId = await userIdForSubscription(admin, subscription);
      if (userId) {
        // plan→free. Limits re-apply on the NEXT create action; existing content
        // is never locked or deleted — read + review stay free forever.
        await admin
          .from("subscriptions")
          .update({
            plan: "free",
            status: "canceled",
            cancel_at_period_end: false,
            stripe_subscription_id: null,
          })
          .eq("user_id", userId);
        const daysSubscribed = subscription.start_date
          ? Math.floor((Date.now() / 1000 - subscription.start_date) / 86_400)
          : 0;
        await capturePostHog(userId, "cancel_completed", { days_subscribed: daysSubscribed });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        const { data: sub } = await admin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (sub?.user_id) {
          await admin.from("subscriptions").update({ status: "past_due" }).eq("user_id", sub.user_id);
          const { data: profile } = await admin
            .from("profiles")
            .select("email")
            .eq("id", sub.user_id)
            .maybeSingle();
          if (profile?.email) {
            await sendPaymentFailedEmail(profile.email, `${env.appUrl}/settings?tab=billing`);
          }
        }
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId) {
        await admin
          .from("subscriptions")
          .update({ status: "active" })
          .eq("stripe_customer_id", customerId)
          .eq("status", "past_due");
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function userIdForSubscription(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  subscription: Stripe.Subscription
): Promise<string | null> {
  if (subscription.metadata?.user_id) return subscription.metadata.user_id;
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

/** Stripe moved current_period_end onto subscription items in recent API versions. */
function periodEnd(subscription: Stripe.Subscription): string | null {
  const item = subscription.items.data[0] as unknown as { current_period_end?: number } | undefined;
  const ts =
    item?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}
