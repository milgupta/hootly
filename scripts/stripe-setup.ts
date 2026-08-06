/**
 * Stripe catalog + portal configuration (docs/07 §1.1, §1.3).
 * Idempotent by lookup_key — safe to re-run. Usage: npm run stripe:setup
 */
import Stripe from "stripe";
import { EDU_COUPON_ID, EDU_DISCOUNT_PCT, PRICES, PRODUCT_NAME } from "../lib/billing/plans";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error(
    "STRIPE_SECRET_KEY is missing. Add it to .env.local (TEST mode until the Playwright checkout test passes), then re-run."
  );
  process.exit(1);
}
const stripe = new Stripe(key);
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  // ---- Product ----------------------------------------------------------
  const products = await stripe.products.search({ query: `name:'${PRODUCT_NAME}'` });
  const product =
    products.data[0] ??
    (await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "Unlimited courses, uploads, flashcards, quizzes, and tutor messages. Lecture recording, audio recaps, PDF export, priority processing.",
    }));
  console.log(`✓ Product ${product.id} (${PRODUCT_NAME})`);

  // ---- Prices (idempotent by lookup_key) --------------------------------
  for (const [name, spec] of Object.entries(PRICES)) {
    const existing = await stripe.prices.list({ lookup_keys: [spec.lookupKey], limit: 1 });
    if (existing.data[0]) {
      console.log(`✓ Price ${spec.lookupKey} already exists (${existing.data[0].id})`);
      continue;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: spec.amount,
      recurring: { interval: spec.interval },
      lookup_key: spec.lookupKey,
    });
    console.log(`✓ Created price ${name}: ${spec.lookupKey} (${price.id})`);
  }

  // ---- .edu coupon (applied server-side, never typed by the user) --------
  try {
    await stripe.coupons.retrieve(EDU_COUPON_ID);
    console.log(`✓ Coupon ${EDU_COUPON_ID} already exists`);
  } catch {
    await stripe.coupons.create({
      id: EDU_COUPON_ID,
      percent_off: EDU_DISCOUNT_PCT,
      duration: "forever",
      name: "Student discount (.edu)",
    });
    console.log(`✓ Created coupon ${EDU_COUPON_ID} (${EDU_DISCOUNT_PCT}% forever)`);
  }

  // ---- Billing Portal config (docs/07 §1.3) -----------------------------
  // Cancellation at period end, NO retention flow (the 2-click promise);
  // plan switch monthly↔annual with proration; invoice history; card updates.
  const prices = await stripe.prices.list({ product: product.id, limit: 10 });
  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Hootly — manage your plan",
      privacy_policy_url: `${appUrl}/legal/privacy`,
      terms_of_service_url: `${appUrl}/legal/terms`,
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        // No cancellation_reason survey gate and no retention offer — no dark patterns.
        proration_behavior: "none",
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [{ product: product.id, prices: prices.data.map((p) => p.id) }],
      },
    },
    default_return_url: `${appUrl}/settings?tab=billing`,
  });
  console.log(`✓ Billing portal configuration ${config.id}`);

  console.log("\nDone. Remaining manual steps (docs/07 §5):");
  console.log("  · Add the webhook endpoint: POST {APP_URL}/api/webhooks/stripe");
  console.log("    events: checkout.session.completed, customer.subscription.updated,");
  console.log("            customer.subscription.deleted, invoice.payment_failed, invoice.paid");
  console.log("  · Copy the signing secret into STRIPE_WEBHOOK_SECRET");
  console.log("  · Keep TEST mode until the Playwright checkout test passes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
