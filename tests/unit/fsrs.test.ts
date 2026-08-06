import { describe, it, expect } from "vitest";
import {
  rowToCard,
  cardToRow,
  scheduleReview,
  previewIntervals,
  humanInterval,
  type FsrsColumns,
  type ReviewRating,
} from "@/lib/fsrs";
import { masteryState } from "@/lib/types";

/** Spec: docs/04 §1 (ts-fsrs wrapper) + §4 (fsrs_* columns, mastery mapping),
 *  docs/05 §7.3 (rating bar next-due preview "<10m · 2d · 4d · 8d"). */

const NOW = new Date("2026-08-06T00:00:00.000Z");
const RATINGS: ReviewRating[] = [1, 2, 3, 4];

function newCardRow(): FsrsColumns {
  return {
    fsrs_due: "2026-08-06T00:00:00.000Z",
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_learning_steps: 0,
    fsrs_reps: 0,
    fsrs_lapses: 0,
    fsrs_state: 0,
    fsrs_last_review: null,
  };
}

function matureRow(): FsrsColumns {
  return {
    fsrs_due: "2026-08-06T00:00:00.000Z",
    fsrs_stability: 34.5,
    fsrs_difficulty: 5.25,
    fsrs_elapsed_days: 12,
    fsrs_scheduled_days: 30,
    fsrs_learning_steps: 0,
    fsrs_reps: 7,
    fsrs_lapses: 1,
    fsrs_state: 2,
    fsrs_last_review: "2026-07-25T00:00:00.000Z",
  };
}

function learningRow(): FsrsColumns {
  return {
    fsrs_due: "2026-08-06T00:10:00.000Z",
    fsrs_stability: 2.3065,
    fsrs_difficulty: 4.87,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_learning_steps: 1,
    fsrs_reps: 2,
    fsrs_lapses: 0,
    fsrs_state: 1,
    fsrs_last_review: "2026-08-06T00:00:00.000Z",
  };
}

describe("rowToCard / cardToRow round-trip", () => {
  it("preserves every fsrs_* column for a mature review card", () => {
    const row = matureRow();
    expect(cardToRow(rowToCard(row))).toEqual(row);
  });

  it("preserves every fsrs_* column for a learning card (steps + null-free)", () => {
    const row = learningRow();
    expect(cardToRow(rowToCard(row))).toEqual(row);
  });

  it("preserves a relearning (lapsed) card including the lapse counter", () => {
    const row: FsrsColumns = {
      ...matureRow(),
      fsrs_state: 3,
      fsrs_lapses: 4,
      fsrs_scheduled_days: 0,
      fsrs_learning_steps: 1,
    };
    const back = cardToRow(rowToCard(row));
    expect(back).toEqual(row);
    expect(back.fsrs_lapses).toBe(4);
  });

  it("maps a never-reviewed row (reps 0, state 0) onto a fresh empty card at its due date", () => {
    const row = newCardRow();
    const card = rowToCard(row);
    expect(card.state).toBe(0);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.stability).toBe(0);
    expect(card.difficulty).toBe(0);
    expect(card.due.toISOString()).toBe(row.fsrs_due);
    expect(card.last_review).toBeUndefined();
  });

  it("normalizes null stability/difficulty to 0 on the way out", () => {
    const back = cardToRow(rowToCard(newCardRow()));
    expect(back.fsrs_stability).toBe(0);
    expect(back.fsrs_difficulty).toBe(0);
    expect(back.fsrs_last_review).toBeNull();
  });
});

describe("scheduleReview — new card", () => {
  it("records the first repetition and stamps last_review at review time", () => {
    for (const rating of RATINGS) {
      const out = scheduleReview(newCardRow(), rating, NOW);
      expect(out.fsrs_reps).toBe(1);
      expect(out.fsrs_last_review).toBe(NOW.toISOString());
      expect(new Date(out.fsrs_due).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("Again keeps the card in learning with a sub-hour step; Easy graduates it to review", () => {
    const again = scheduleReview(newCardRow(), 1, NOW);
    expect(again.fsrs_state).toBe(1); // Learning
    expect(again.fsrs_scheduled_days).toBe(0);
    expect(new Date(again.fsrs_due).getTime() - NOW.getTime()).toBeLessThan(60 * 60 * 1000);

    const easy = scheduleReview(newCardRow(), 4, NOW);
    expect(easy.fsrs_state).toBe(2); // Review
    expect(easy.fsrs_scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it("due dates increase monotonically from Again → Hard → Good → Easy", () => {
    const dues = RATINGS.map((r) => new Date(scheduleReview(newCardRow(), r, NOW).fsrs_due).getTime());
    expect(dues[0]!).toBeLessThan(dues[1]!);
    expect(dues[1]!).toBeLessThanOrEqual(dues[2]!);
    expect(dues[2]!).toBeLessThan(dues[3]!);
    expect(dues[3]!).toBeGreaterThan(dues[0]!);
  });

  it("does not mutate the input row", () => {
    const row = newCardRow();
    const snapshot = { ...row };
    scheduleReview(row, 3, NOW);
    expect(row).toEqual(snapshot);
  });
});

describe("scheduleReview — mature card", () => {
  it("Again lapses the card into relearning and increments lapses", () => {
    const row = matureRow();
    const out = scheduleReview(row, 1, NOW);
    expect(out.fsrs_state).toBe(3); // Relearning
    expect(out.fsrs_lapses).toBe(row.fsrs_lapses + 1);
    expect(out.fsrs_reps).toBe(row.fsrs_reps + 1);
    expect(new Date(out.fsrs_due).getTime() - NOW.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("Good keeps it in review and extends the interval beyond the previous one", () => {
    const row = matureRow();
    const out = scheduleReview(row, 3, NOW);
    expect(out.fsrs_state).toBe(2);
    expect(out.fsrs_lapses).toBe(row.fsrs_lapses); // no lapse on a successful review
    expect(out.fsrs_scheduled_days).toBeGreaterThan(row.fsrs_scheduled_days);
  });

  it("Easy schedules strictly further out than Again", () => {
    const again = new Date(scheduleReview(matureRow(), 1, NOW).fsrs_due).getTime();
    const easy = new Date(scheduleReview(matureRow(), 4, NOW).fsrs_due).getTime();
    expect(easy).toBeGreaterThan(again);
    // Easy on a 30-day card must be at least another month out.
    expect(easy - NOW.getTime()).toBeGreaterThan(30 * 24 * 60 * 60 * 1000);
  });

  it("produces a row that round-trips back through rowToCard unchanged", () => {
    const out = scheduleReview(matureRow(), 3, NOW);
    expect(cardToRow(rowToCard(out))).toEqual(out);
  });
});

describe("previewIntervals (rating bar, docs/05 §7.3)", () => {
  it("returns a non-empty human string for all four ratings", () => {
    for (const row of [newCardRow(), learningRow(), matureRow()]) {
      const preview = previewIntervals(row, NOW);
      expect(Object.keys(preview).sort()).toEqual(["1", "2", "3", "4"]);
      for (const rating of RATINGS) {
        expect(preview[rating]).toBeTruthy();
        expect(preview[rating]).toMatch(/^(<10m|\d+(m|h|d|mo|y))$/);
      }
    }
  });

  it("previews Again as a sub-hour relearning step even on a month-long card", () => {
    expect(previewIntervals(matureRow(), NOW)[1]).toMatch(/^(<10m|\d{1,2}m)$/);
  });

  it("previews match what scheduleReview would actually persist", () => {
    const row = matureRow();
    const preview = previewIntervals(row, NOW);
    // Easy on a month-long card must preview in months, not minutes.
    expect(preview[4]).toMatch(/mo|y$/);
    const easyDue = new Date(scheduleReview(row, 4, NOW).fsrs_due).getTime();
    expect(humanInterval(easyDue - NOW.getTime())).toBe(preview[4]);
  });
});

describe("humanInterval", () => {
  it("collapses everything under ten minutes to the '<10m' copy", () => {
    expect(humanInterval(0)).toBe("<10m");
    expect(humanInterval(60_000)).toBe("<10m");
    expect(humanInterval(6 * 60_000)).toBe("<10m");
    expect(humanInterval(9 * 60_000)).toBe("<10m");
  });

  it("shows real minutes between 10 and 59 (never '<30m')", () => {
    expect(humanInterval(10 * 60_000)).toBe("10m");
    expect(humanInterval(30 * 60_000)).toBe("30m");
    expect(humanInterval(59 * 60_000)).toBe("59m");
  });

  it("switches to hours, then days, then months, then years", () => {
    expect(humanInterval(60 * 60_000)).toBe("1h");
    expect(humanInterval(5 * 60 * 60_000)).toBe("5h");
    expect(humanInterval(23 * 60 * 60_000)).toBe("23h");
    expect(humanInterval(2 * 24 * 60 * 60_000)).toBe("2d");
    expect(humanInterval(21 * 24 * 60 * 60_000)).toBe("21d");
    expect(humanInterval(45 * 24 * 60 * 60_000)).toBe("2mo");
    expect(humanInterval(400 * 24 * 60 * 60_000)).toBe("1y");
    expect(humanInterval(800 * 24 * 60 * 60_000)).toBe("2y");
  });

  it("never emits an empty or NaN-bearing string", () => {
    for (const minutes of [0, 1, 9, 10, 59, 60, 1439, 1440, 44_640, 525_600]) {
      const out = humanInterval(minutes * 60_000);
      expect(out).toBeTruthy();
      expect(out).not.toMatch(/NaN|undefined/);
    }
  });
});

describe("masteryState (docs/04 §4, normative)", () => {
  it("state 2 with scheduled_days >= 21 is mastered", () => {
    expect(masteryState({ fsrs_state: 2, fsrs_scheduled_days: 21 })).toBe("mastered");
    expect(masteryState({ fsrs_state: 2, fsrs_scheduled_days: 90 })).toBe("mastered");
  });

  it("state 2 with scheduled_days < 21 is reviewing", () => {
    expect(masteryState({ fsrs_state: 2, fsrs_scheduled_days: 20 })).toBe("reviewing");
    expect(masteryState({ fsrs_state: 2, fsrs_scheduled_days: 1 })).toBe("reviewing");
    expect(masteryState({ fsrs_state: 2, fsrs_scheduled_days: 0 })).toBe("reviewing");
  });

  it("states 0 (new), 1 (learning) and 3 (relearning) are all learning, whatever the interval", () => {
    for (const state of [0, 1, 3]) {
      expect(masteryState({ fsrs_state: state, fsrs_scheduled_days: 0 })).toBe("learning");
      expect(masteryState({ fsrs_state: state, fsrs_scheduled_days: 365 })).toBe("learning");
    }
  });

  it("a lapsed mastered card drops back to learning", () => {
    const lapsed = scheduleReview(matureRow(), 1, NOW);
    expect(masteryState({
      fsrs_state: lapsed.fsrs_state,
      fsrs_scheduled_days: lapsed.fsrs_scheduled_days,
    })).toBe("learning");
  });
});
