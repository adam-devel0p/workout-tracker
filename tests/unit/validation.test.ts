import { describe, expect, test } from "vitest";
import {
  exerciseNameSchema,
  repsSchema,
  setInputSchema,
  weightKgSchema,
} from "@/lib/validation/schemas";

describe("exerciseNameSchema", () => {
  test("trims the name", () => {
    expect(exerciseNameSchema.parse("  Bench Press ")).toBe("Bench Press");
  });

  test.each(["", "   ", "x".repeat(101)])("rejects %j", (name) => {
    expect(exerciseNameSchema.safeParse(name).success).toBe(false);
  });
});

describe("repsSchema", () => {
  test.each([1, 12, 9999])("accepts %d", (reps) => {
    expect(repsSchema.parse(reps)).toBe(reps);
  });

  test.each([0, -1, 2.5, 10000, Number.NaN, "8"])("rejects %j", (reps) => {
    expect(repsSchema.safeParse(reps).success).toBe(false);
  });
});

describe("weightKgSchema", () => {
  test.each([0, 20, 62.5, 62.55, 0.07, 9999.99, null])(
    "accepts %j",
    (weight) => {
      expect(weightKgSchema.parse(weight)).toBe(weight);
    },
  );

  test.each([-0.5, 1.005, 10000, Number.NaN, "20", undefined])(
    "rejects %j",
    (weight) => {
      expect(weightKgSchema.safeParse(weight).success).toBe(false);
    },
  );
});

describe("setInputSchema", () => {
  test("accepts a weighted and a bodyweight set", () => {
    expect(setInputSchema.parse({ reps: 8, weightKg: 60 })).toEqual({
      reps: 8,
      weightKg: 60,
    });
    expect(setInputSchema.parse({ reps: 8, weightKg: null })).toEqual({
      reps: 8,
      weightKg: null,
    });
  });

  test("gives a readable message", () => {
    const result = setInputSchema.safeParse({ reps: 0, weightKg: -1 });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      "Reps must be at least 1.",
      "Weight cannot be negative.",
    ]);
  });
});
