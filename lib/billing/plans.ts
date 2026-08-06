/** Stripe catalog constants (docs/07 §1.1). NO weekly plans, NO forever-discount gimmicks. */

export const PRODUCT_NAME = "Hootly Plus";

export const LOOKUP_KEYS = {
  monthly: "plus_monthly",
  annual: "plus_annual",
} as const;

/** Prices in cents. */
export const PRICES = {
  monthly: { amount: 1299, interval: "month" as const, lookupKey: LOOKUP_KEYS.monthly },
  annual: { amount: 8388, interval: "year" as const, lookupKey: LOOKUP_KEYS.annual },
} as const;

export const EDU_COUPON_ID = "edu20";
export const EDU_DISCOUNT_PCT = 20;

/** Display strings used verbatim across pricing, paywall, and settings. */
export const PRICE_COPY = {
  annualPerMonth: "$6.99/mo",
  annualTotal: "$83.88/yr",
  annualBilled: "$83.88 billed today",
  monthly: "$12.99/mo",
  /** $83.88/yr vs $155.88 at the monthly rate. */
  annualSavingsPct: 46,
  monthlyYearTotal: "$155.88",
} as const;

/** 7-day self-serve refund window (docs/07 §1.4). */
export const REFUND_WINDOW_DAYS = 7;
