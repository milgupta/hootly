import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

/** Spec: docs/07 §1.5 (Stripe webhooks — signature verify + idempotency via the
 *  stripe_events primary key) and docs/00 trust rule 2 / docs/04 §5
 *  (downgrade NEVER locks or deletes content — plan flips to free, nothing else). */

// ---------------------------------------------------------------------------
// Fake Supabase admin client: records every table operation so a "replay" can be
// asserted to have mutated nothing.
// ---------------------------------------------------------------------------
interface Op {
  table: string;
  verb: "insert" | "update" | "select" | "delete";
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

const ops: Op[] = [];
/** Event ids already stored — a second insert of the same id fails the PK. */
const storedEventIds = new Set<string>();
/** Rows the fake DB can answer lookups with. */
let subscriptionRow: Record<string, unknown> | null = null;

function makeBuilder(table: string, verb: Op["verb"], payload?: unknown) {
  const op: Op = { table, verb, payload, filters: [] };
  ops.push(op);

  const result: Record<string, unknown> = { data: null, error: null };
  if (table === "stripe_events" && verb === "insert") {
    const id = (payload as { id: string }).id;
    if (storedEventIds.has(id)) {
      result.error = { code: "23505", message: "duplicate key value violates unique constraint" };
    } else {
      storedEventIds.add(id);
    }
  }

  const builder: Record<string, unknown> = {
    eq(column: string, value: unknown) {
      op.filters.push([column, value]);
      return builder;
    },
    in(column: string, value: unknown) {
      op.filters.push([column, value]);
      return builder;
    },
    maybeSingle() {
      if (table === "subscriptions" && verb === "select") {
        return Promise.resolve({ data: subscriptionRow, error: null });
      }
      if (table === "profiles" && verb === "select") {
        return Promise.resolve({ data: { email: "student@example.edu" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
  return builder;
}

const adminClient = {
  from(table: string) {
    return {
      insert: (payload: unknown) => makeBuilder(table, "insert", payload),
      update: (payload: unknown) => makeBuilder(table, "update", payload),
      select: (_columns?: string) => makeBuilder(table, "select"),
      delete: () => makeBuilder(table, "delete"),
    };
  },
};

// ---------------------------------------------------------------------------
// Module mocks — no real Stripe, Supabase, PostHog or Resend.
// ---------------------------------------------------------------------------
let constructedEvent: Stripe.Event | null = null;
let constructEventThrows = false;
const subscriptionsRetrieve = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: () => {
        if (constructEventThrows) throw new Error("bad signature");
        return constructedEvent;
      },
    },
    subscriptions: { retrieve: subscriptionsRetrieve },
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    stripeWebhookSecret: "whsec_test",
    appUrl: "http://localhost:3000",
  },
  hasStripeEnv: true,
  hasServiceRoleEnv: true,
}));

const capturePostHog = vi.fn(async () => {});
vi.mock("@/lib/analytics/server", () => ({ capturePostHog: (...a: unknown[]) => capturePostHog(...(a as [])) }));

const sendPaymentFailedEmail = vi.fn(async () => {});
vi.mock("@/lib/email", () => ({
  sendPaymentFailedEmail: (...a: unknown[]) => sendPaymentFailedEmail(...(a as [])),
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function request(): Request {
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
    body: "{}",
  });
}

function subscriptionEvent(
  type: "customer.subscription.deleted" | "customer.subscription.updated",
  over: Record<string, unknown> = {},
  id = "evt_sub_1"
): Stripe.Event {
  return {
    id,
    type,
    data: {
      object: {
        id: "sub_123",
        customer: "cus_123",
        status: type === "customer.subscription.deleted" ? "canceled" : "active",
        cancel_at_period_end: false,
        start_date: Math.floor(Date.now() / 1000) - 90 * 86_400,
        metadata: { user_id: "user_1" },
        items: { data: [{ price: { recurring: { interval: "month" } }, current_period_end: 1_800_000_000 }] },
        ...over,
      },
    },
  } as unknown as Stripe.Event;
}

function checkoutEvent(id = "evt_checkout_1"): Stripe.Event {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        client_reference_id: "user_1",
        subscription: "sub_123",
        customer: "cus_123",
        amount_total: 999,
      },
    },
  } as unknown as Stripe.Event;
}

function opsAfterEventInsert(): Op[] {
  const index = ops.findIndex((o) => o.table === "stripe_events" && o.verb === "insert");
  return index === -1 ? ops : ops.slice(index + 1);
}

beforeEach(() => {
  ops.length = 0;
  storedEventIds.clear();
  subscriptionRow = { user_id: "user_1" };
  constructEventThrows = false;
  constructedEvent = null;
  capturePostHog.mockClear();
  sendPaymentFailedEmail.mockClear();
  subscriptionsRetrieve.mockReset();
  subscriptionsRetrieve.mockResolvedValue({
    id: "sub_123",
    status: "active",
    cancel_at_period_end: false,
    metadata: { user_id: "user_1" },
    items: { data: [{ price: { recurring: { interval: "month" } }, current_period_end: 1_800_000_000 }] },
  });
});

// ---------------------------------------------------------------------------
describe("signature verification", () => {
  it("rejects an unverifiable payload with 400 before touching the database", async () => {
    constructEventThrows = true;
    const res = await POST(request());
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_signature" });
    expect(ops).toHaveLength(0);
  });
});

describe("idempotency via the stripe_events primary key (docs/07 §1.5)", () => {
  it("inserts event.id into stripe_events FIRST, before any other mutation", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    await POST(request());
    expect(ops[0]).toMatchObject({
      table: "stripe_events",
      verb: "insert",
      payload: { id: "evt_sub_1" },
    });
  });

  it("processes the first delivery and acknowledges without the duplicate flag", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    const res = await POST(request());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(opsAfterEventInsert().some((o) => o.table === "subscriptions" && o.verb === "update")).toBe(true);
  });

  it("returns {received:true, duplicate:true} and mutates NOTHING on a replay", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    await POST(request()); // first delivery
    ops.length = 0;
    capturePostHog.mockClear();

    const res = await POST(request()); // Stripe retries the same event id
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, duplicate: true });

    // Only the failed PK insert happened; no subscription write, no analytics.
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ table: "stripe_events", verb: "insert" });
    expect(opsAfterEventInsert()).toHaveLength(0);
    expect(capturePostHog).not.toHaveBeenCalled();
  });

  it("does not double-apply an upgrade when checkout.session.completed is replayed", async () => {
    constructedEvent = checkoutEvent();
    await POST(request());
    const firstUpdates = ops.filter((o) => o.table === "subscriptions" && o.verb === "update");
    expect(firstUpdates).toHaveLength(1);
    expect(firstUpdates[0]!.payload).toMatchObject({ plan: "plus" });
    expect(capturePostHog).toHaveBeenCalledTimes(1);

    ops.length = 0;
    capturePostHog.mockClear();
    subscriptionsRetrieve.mockClear();

    const replay = await POST(request());
    await expect(replay.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(ops.filter((o) => o.table === "subscriptions")).toHaveLength(0);
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(capturePostHog).not.toHaveBeenCalled();
  });

  it("does not resend the dunning email when invoice.payment_failed is replayed", async () => {
    constructedEvent = {
      id: "evt_failed_1",
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_123" } },
    } as unknown as Stripe.Event;

    await POST(request());
    expect(sendPaymentFailedEmail).toHaveBeenCalledTimes(1);

    sendPaymentFailedEmail.mockClear();
    ops.length = 0;
    const replay = await POST(request());
    await expect(replay.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
    expect(opsAfterEventInsert()).toHaveLength(0);
  });

  it("treats each distinct event id independently", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted", {}, "evt_a");
    await expect((await POST(request())).json()).resolves.toEqual({ received: true });
    constructedEvent = subscriptionEvent("customer.subscription.deleted", {}, "evt_b");
    await expect((await POST(request())).json()).resolves.toEqual({ received: true });
    expect(storedEventIds).toEqual(new Set(["evt_a", "evt_b"]));
  });

  it("acknowledges an unhandled event type after claiming its id", async () => {
    constructedEvent = {
      id: "evt_unknown_1",
      type: "customer.created",
      data: { object: {} },
    } as unknown as Stripe.Event;
    const res = await POST(request());
    await expect(res.json()).resolves.toEqual({ received: true });
    expect(storedEventIds.has("evt_unknown_1")).toBe(true);
    expect(opsAfterEventInsert()).toHaveLength(0);
  });
});

describe("downgrade rule — content is NEVER locked or deleted (docs/00 rule 2)", () => {
  it("customer.subscription.deleted sets plan='free' and clears the subscription id", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    await POST(request());
    const update = ops.find((o) => o.table === "subscriptions" && o.verb === "update");
    expect(update).toBeDefined();
    expect(update!.payload).toEqual({
      plan: "free",
      status: "canceled",
      cancel_at_period_end: false,
      stripe_subscription_id: null,
    });
    expect(update!.filters).toEqual([["user_id", "user_1"]]);
  });

  it("issues NO delete against any table on downgrade", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    await POST(request());
    expect(ops.filter((o) => o.verb === "delete")).toHaveLength(0);
  });

  it("touches ONLY the subscriptions table — never courses, notes, cards or quizzes", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    await POST(request());
    const mutated = new Set(
      ops.filter((o) => o.verb !== "select").map((o) => o.table)
    );
    expect(mutated).toEqual(new Set(["stripe_events", "subscriptions"]));
    for (const table of ["courses", "materials", "notes", "flashcards", "quizzes", "chunks"]) {
      expect(ops.some((o) => o.table === table)).toBe(false);
    }
  });

  it("never writes a locking/archiving flag alongside the downgrade", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    await POST(request());
    const update = ops.find((o) => o.table === "subscriptions" && o.verb === "update")!;
    const keys = Object.keys(update.payload as Record<string, unknown>);
    for (const forbidden of ["locked", "archived_at", "deleted_at", "read_only", "suspended"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("resolves the user via the subscriptions row when metadata has no user_id", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted", { metadata: {} });
    subscriptionRow = { user_id: "user_from_lookup" };
    await POST(request());
    const update = ops.find((o) => o.table === "subscriptions" && o.verb === "update");
    expect(update!.filters).toEqual([["user_id", "user_from_lookup"]]);
  });

  it("makes no write at all when the user cannot be resolved", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted", { metadata: {} });
    subscriptionRow = null;
    await POST(request());
    expect(ops.filter((o) => o.table === "subscriptions" && o.verb === "update")).toHaveLength(0);
  });

  it("reports the cancellation to analytics with days_subscribed", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.deleted");
    await POST(request());
    expect(capturePostHog).toHaveBeenCalledWith(
      "user_1",
      "cancel_completed",
      expect.objectContaining({ days_subscribed: expect.any(Number) })
    );
  });
});

describe("customer.subscription.updated", () => {
  it("keeps plus while the subscription is active", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.updated");
    await POST(request());
    const update = ops.find((o) => o.table === "subscriptions" && o.verb === "update")!;
    expect(update.payload).toMatchObject({ plan: "plus", status: "active" });
  });

  it("drops to free once Stripe reports the subscription canceled", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.updated", { status: "canceled" });
    await POST(request());
    const update = ops.find((o) => o.table === "subscriptions" && o.verb === "update")!;
    expect(update.payload).toMatchObject({ plan: "free" });
    expect(ops.filter((o) => o.verb === "delete")).toHaveLength(0);
  });

  it("records cancel_at_period_end without downgrading early (access until period end)", async () => {
    constructedEvent = subscriptionEvent("customer.subscription.updated", {
      cancel_at_period_end: true,
    });
    await POST(request());
    const update = ops.find((o) => o.table === "subscriptions" && o.verb === "update")!;
    expect(update.payload).toMatchObject({ plan: "plus", cancel_at_period_end: true });
  });
});
