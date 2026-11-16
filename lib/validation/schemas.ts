import { z } from "zod";

export const exerciseNameSchema = z
  .string()
  .trim()
  .min(1, "Enter an exercise name.")
  .max(100, "Exercise names can be at most 100 characters.");

export const repsSchema = z
  .number("Reps must be a number.")
  .int("Reps must be a whole number.")
  .positive("Reps must be at least 1.")
  .max(9999, "Reps must be at most 9999.");

// Matches NUMERIC(6,2) in the database. null means bodyweight.
export const weightKgSchema = z
  .number("Weight must be a number.")
  .min(0, "Weight cannot be negative.")
  .max(9999.99, "Weight must be at most 9999.99 kg.")
  .refine((value) => Math.round(value * 100) / 100 === value, {
    error: "Weight can have at most two decimals.",
  })
  .nullable();

export const setInputSchema = z.object({
  reps: repsSchema,
  weightKg: weightKgSchema,
});

export type SetInput = z.infer<typeof setInputSchema>;
