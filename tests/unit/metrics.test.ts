import { describe, expect, test } from "vitest";
import {
  bestSet,
  estimatedOneRepMax,
  sessionVolume,
  setVolume,
} from "@/lib/metrics/sets";

describe("setVolume", () => {
  test("is reps × weight", () => {
    expect(setVolume({ reps: 8, weightKg: 62.5 })).toBe(500);
  });

  test("has no floating-point noise", () => {
    // 3 * 0.1 is 0.30000000000000004 in plain JavaScript.
    expect(setVolume({ reps: 3, weightKg: 0.1 })).toBe(0.3);
  });

  test("is 0 for a set without weight", () => {
    expect(setVolume({ reps: 12, weightKg: null })).toBe(0);
  });
});

describe("sessionVolume", () => {
  test("sums the sets and ignores sets without weight", () => {
    expect(
      sessionVolume([
        { reps: 10, weightKg: 60 },
        { reps: 8, weightKg: 62.5 },
        { reps: 15, weightKg: null },
      ]),
    ).toBe(1100);
  });

  test("is 0 for no sets", () => {
    expect(sessionVolume([])).toBe(0);
  });
});

describe("estimatedOneRepMax", () => {
  test("uses the Epley formula", () => {
    expect(estimatedOneRepMax({ reps: 30, weightKg: 50 })).toBe(100);
    expect(estimatedOneRepMax({ reps: 5, weightKg: 100 })).toBeCloseTo(
      116.667,
      3,
    );
  });

  test("is null for a set without weight", () => {
    expect(estimatedOneRepMax({ reps: 10, weightKg: null })).toBeNull();
  });
});

describe("bestSet", () => {
  test("picks the highest estimated 1RM, not the heaviest weight", () => {
    const sets = [
      { reps: 1, weightKg: 100 }, // 1RM 103.3
      { reps: 10, weightKg: 90 }, // 1RM 120
      { reps: 5, weightKg: 95 }, // 1RM 110.8
    ];
    expect(bestSet(sets)).toBe(sets[1]);
  });

  test("picks the most reps when no set has weight", () => {
    const sets = [
      { reps: 8, weightKg: null },
      { reps: 12, weightKg: null },
      { reps: 10, weightKg: null },
    ];
    expect(bestSet(sets)).toBe(sets[1]);
  });

  test("prefers a weighted set over a set without weight", () => {
    const sets = [
      { reps: 20, weightKg: null },
      { reps: 5, weightKg: 10 },
    ];
    expect(bestSet(sets)).toBe(sets[1]);
  });

  test("keeps the earliest set on a tie", () => {
    const sets = [
      { reps: 5, weightKg: 80 },
      { reps: 5, weightKg: 80 },
    ];
    expect(bestSet(sets)).toBe(sets[0]);
  });

  test("is null for no sets", () => {
    expect(bestSet([])).toBeNull();
  });
});
