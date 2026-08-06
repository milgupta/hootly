import "server-only";
import Stripe from "stripe";
import { env, hasStripeEnv } from "@/lib/env";

let stripe: Stripe | null = null;

/** Stripe client (server only). Null when STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe | null {
  // TODO(key-needed): remove the guard once STRIPE_SECRET_KEY is set.
  if (!hasStripeEnv) return null;
  if (!stripe) stripe = new Stripe(env.stripeSecretKey);
  return stripe;
}
