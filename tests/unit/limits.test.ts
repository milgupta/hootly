import { describe, it, expect } from "vitest";
import {
  LIMITS,
  FREE_AUDIO_MAX_SECONDS,
  limitFor,
  isMonthly,
  periodStart,
  remaining,
} from "@/lib/billing/limits";
import type { UsageMetric } from "@/lib/types";

/** Spec: docs/04 §5 (Plan limits — normative per-metric semantics). */

const LIFETIME_METRICS: UsageMetric[] = ["uploads", "cards_generated", "quizzes_generated"];
const ALL_METRICS: UsageMetric[] = [
  "courses",
  "uploads",
  "cards_generated",
  "quizzes_generated",
  "tutor_messages",
];

describe("LIMITS table (docs/04 §5 verbatim)", () => {
  it("free plan has the exact published numbers", () => {
    expect(LIMITS.free.courses).toBe(1);
    expect(LIMITS.free.uploads).toBe(3);
    expect(LIMITS.free.cards_generated).toBe(50);
    expect(LIMITS.free.quizzes_generated).toBe(2);
    expect(LIMITS.free.tutor_messages).toEqual({ limit: 20, per: "month" });
  });

  it("plus plan is unlimited on every metric", () => {
    expect(LIMITS.plus.courses).toBe(Infinity);
    expect(LIMITS.plus.uploads).toBe(Infinity);
    expect(LIMITS.plus.cards_generated).toBe(Infinity);
    expect(LIMITS.plus.quizzes_generated).toBe(Infinity);
    expect(LIMITS.plus.tutor_messages.limit).toBe(Infinity);
  });

  it("tutor_messages carries the per:'month' attribute (metric-named key)", () => {
    expect(LIMITS.free.tutor_messages.per).toBe("month");
    expect(LIMITS.plus.tutor_messages.per).toBe("month");
  });

  it("free audio/video uploads are capped at 30 minutes", () => {
    expect(FREE_AUDIO_MAX_SECONDS).toBe(1800);
  });
});

describe("limitFor()", () => {
  it("unwraps the numeric limit for both scalar and {limit,per} entries", () => {
    expect(limitFor("free", "courses")).toBe(1);
    expect(limitFor("free", "uploads")).toBe(3);
    expect(limitFor("free", "cards_generated")).toBe(50);
    expect(limitFor("free", "quizzes_generated")).toBe(2);
    expect(limitFor("free", "tutor_messages")).toBe(20);
  });

  it("returns Infinity for every plus metric", () => {
    for (const metric of ALL_METRICS) {
      expect(limitFor("plus", metric)).toBe(Infinity);
      expect(Number.isFinite(limitFor("plus", metric))).toBe(false);
    }
  });
});

describe("isMonthly() — only tutor_messages resets", () => {
  it("tutor_messages is monthly", () => {
    expect(isMonthly("tutor_messages")).toBe(true);
  });

  it("lifetime counters and the live course count are not monthly", () => {
    for (const metric of [...LIFETIME_METRICS, "courses" as UsageMetric]) {
      expect(isMonthly(metric)).toBe(false);
    }
  });
});

describe("periodStart() bucketing", () => {
  it("buckets tutor_messages to the first of the current UTC month", () => {
    expect(periodStart("tutor_messages", new Date("2026-08-06T13:45:00Z"))).toBe("2026-08-01");
    expect(periodStart("tutor_messages", new Date("2026-01-31T23:59:59Z"))).toBe("2026-01-01");
    expect(periodStart("tutor_messages", new Date("2026-12-01T00:00:00Z"))).toBe("2026-12-01");
  });

  it("zero-pads single-digit months", () => {
    expect(periodStart("tutor_messages", new Date("2026-03-15T00:00:00Z"))).toBe("2026-03-01");
    expect(periodStart("tutor_messages", new Date("2026-09-02T00:00:00Z"))).toBe("2026-09-01");
  });

  it("buckets lifetime metrics to the epoch so they never roll over", () => {
    for (const metric of LIFETIME_METRICS) {
      expect(periodStart(metric, new Date("2026-08-06T00:00:00Z"))).toBe("1970-01-01");
      expect(periodStart(metric, new Date("2031-02-14T00:00:00Z"))).toBe("1970-01-01");
    }
  });

  it("gives a lifetime metric the SAME bucket across month boundaries", () => {
    const july = periodStart("uploads", new Date("2026-07-31T23:00:00Z"));
    const august = periodStart("uploads", new Date("2026-08-01T01:00:00Z"));
    expect(july).toBe(august);
  });

  it("gives tutor_messages a DIFFERENT bucket across a month boundary (monthly reset)", () => {
    const july = periodStart("tutor_messages", new Date("2026-07-31T23:00:00Z"));
    const august = periodStart("tutor_messages", new Date("2026-08-01T01:00:00Z"));
    expect(july).not.toBe(august);
    expect(july).toBe("2026-07-01");
    expect(august).toBe("2026-08-01");
  });
});

describe("remaining()", () => {
  it("counts down from the free limit", () => {
    expect(remaining("free", "uploads", 0)).toBe(3);
    expect(remaining("free", "uploads", 1)).toBe(2);
    expect(remaining("free", "uploads", 3)).toBe(0);
    expect(remaining("free", "cards_generated", 12)).toBe(38);
    expect(remaining("free", "quizzes_generated", 1)).toBe(1);
    expect(remaining("free", "tutor_messages", 19)).toBe(1);
    expect(remaining("free", "courses", 1)).toBe(0);
  });

  it("clamps at 0 rather than going negative (over-count must never show -1 left)", () => {
    expect(remaining("free", "uploads", 5)).toBe(0);
    expect(remaining("free", "cards_generated", 999)).toBe(0);
    expect(remaining("free", "tutor_messages", 21)).toBe(0);
  });

  it("returns Infinity for plus on every metric, whatever the usage", () => {
    for (const metric of ALL_METRICS) {
      expect(remaining("plus", metric, 0)).toBe(Infinity);
      expect(remaining("plus", metric, 10_000)).toBe(Infinity);
    }
  });
});

describe("documented enforcement semantics", () => {
  it("lifetime counters never decrement: quota left is a pure function of the counter", () => {
    // Deleting artifacts does not refill quota — remaining() only ever sees the
    // monotonic counter, so a higher counter can never yield MORE remaining.
    let previous = Number.POSITIVE_INFINITY;
    for (let used = 0; used <= 60; used++) {
      const left = remaining("free", "cards_generated", used);
      expect(left).toBeLessThanOrEqual(previous);
      previous = left;
    }
    expect(previous).toBe(0);
  });

  it("courses is a live count: freeing the slot restores the quota", () => {
    // A deleted course lowers the LIVE count, which is what remaining() is fed.
    expect(remaining("free", "courses", 1)).toBe(0);
    expect(remaining("free", "courses", 0)).toBe(1); // course deleted → slot back
  });

  it("free tutor quota is fully restored by the monthly bucket flip", () => {
    const usedInJuly = 20;
    expect(remaining("free", "tutor_messages", usedInJuly)).toBe(0);
    // August is a new bucket, so the counter read for it starts at 0.
    expect(periodStart("tutor_messages", new Date("2026-08-01T00:00:00Z"))).not.toBe(
      periodStart("tutor_messages", new Date("2026-07-15T00:00:00Z"))
    );
    expect(remaining("free", "tutor_messages", 0)).toBe(20);
  });
});
