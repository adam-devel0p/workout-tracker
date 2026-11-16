import { asc, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { db } from "@/lib/db/client";
import {
  NotFoundError,
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from "@/lib/db/errors";
import { createExercise } from "@/lib/db/queries/exercises";
import {
  addSet,
  deleteSet,
  getLastSessionSets,
  updateSet,
} from "@/lib/db/queries/sets";
import { addExerciseToWorkout } from "@/lib/db/queries/workout-exercises";
import { getOrCreateWorkout } from "@/lib/db/queries/workouts";
import { workoutSet } from "@/lib/db/schema";
import { startWithEmptyDatabase } from "./helpers/db";

startWithEmptyDatabase();

/** Adds the exercise to the workout on that date and returns the workout_exercise id. */
async function entryFor(name: string, date: string) {
  const exercise = await createExercise(name);
  const workout = await getOrCreateWorkout(date);
  const entry = await addExerciseToWorkout(workout.id, exercise.id);
  return { entryId: entry.id, exerciseId: exercise.id };
}

async function setsOf(entryId: number) {
  const rows = await db
    .select()
    .from(workoutSet)
    .where(eq(workoutSet.workoutExerciseId, entryId))
    .orderBy(asc(workoutSet.setNumber));
  return rows.map((s) => [s.setNumber, s.reps, s.weightKg]);
}

async function errorCodeOf(query: Promise<unknown>) {
  return query.then(
    () => "no error",
    (error) => pgErrorCode(error),
  );
}

describe("addSet", () => {
  test("numbers sets 1, 2, 3 per exercise in a workout", async () => {
    const squat = await entryFor("Squat", "2026-11-16");
    const row = await entryFor("Row", "2026-11-16");

    const first = await addSet(squat.entryId, { reps: 5, weightKg: 100 });
    await addSet(squat.entryId, { reps: 5, weightKg: 102.5 });
    await addSet(row.entryId, { reps: 10, weightKg: 47.25 });

    expect(first).toMatchObject({ setNumber: 1, reps: 5, weightKg: 100 });
    expect(await setsOf(squat.entryId)).toEqual([
      [1, 5, 100],
      [2, 5, 102.5],
    ]);
    expect(await setsOf(row.entryId)).toEqual([[1, 10, 47.25]]);
  });

  test("stores a bodyweight set with no weight", async () => {
    const { entryId } = await entryFor("Pull-up", "2026-11-16");
    const added = await addSet(entryId, { reps: 8, weightKg: null });
    expect(added.weightKg).toBeNull();
  });

  test.each([
    { reps: 0, weightKg: 50 },
    { reps: -3, weightKg: 50 },
    { reps: 2.5, weightKg: 50 },
    { reps: 5, weightKg: -1 },
    { reps: 5, weightKg: 50.123 },
  ])("rejects %j before it reaches the database", async (input) => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    await expect(addSet(entryId, input)).rejects.toThrow();
    expect(await setsOf(entryId)).toEqual([]);
  });
});

describe("database constraints", () => {
  test.each([
    ["zero reps", { reps: 0, weightKg: 50 }],
    ["negative reps", { reps: -1, weightKg: 50 }],
    ["negative weight", { reps: 5, weightKg: -0.5 }],
    ["set number zero", { reps: 5, weightKg: 50, setNumber: 0 }],
  ])("reject %s", async (_label, values) => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    const insert = db
      .insert(workoutSet)
      .values({ workoutExerciseId: entryId, setNumber: 1, ...values });
    expect(await errorCodeOf(insert)).toBe(PG_CHECK_VIOLATION);
  });

  test("reject a duplicate set number", async () => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    const values = { workoutExerciseId: entryId, setNumber: 1, reps: 5 };
    await db.insert(workoutSet).values(values);
    expect(await errorCodeOf(db.insert(workoutSet).values(values))).toBe(
      PG_UNIQUE_VIOLATION,
    );
  });

  test("accept zero weight", async () => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    const added = await addSet(entryId, { reps: 5, weightKg: 0 });
    expect(added.weightKg).toBe(0);
  });
});

describe("updateSet", () => {
  test("changes reps and weight, keeps the set number", async () => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    await addSet(entryId, { reps: 5, weightKg: 100 });
    const second = await addSet(entryId, { reps: 5, weightKg: 100 });

    const updated = await updateSet(second.id, { reps: 4, weightKg: null });

    expect(updated).toMatchObject({ setNumber: 2, reps: 4, weightKg: null });
    expect(await setsOf(entryId)).toEqual([
      [1, 5, 100],
      [2, 4, null],
    ]);
  });

  test("rejects invalid values and keeps the old ones", async () => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    const set = await addSet(entryId, { reps: 5, weightKg: 100 });

    await expect(updateSet(set.id, { reps: 0, weightKg: 100 })).rejects.toThrow(
      "Reps must be at least 1.",
    );
    expect(await setsOf(entryId)).toEqual([[1, 5, 100]]);
  });

  test("throws for an unknown id", async () => {
    await expect(updateSet(999, { reps: 5, weightKg: 1 })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("deleteSet", () => {
  test("renumbers the sets after the deleted one", async () => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    const other = await entryFor("Row", "2026-11-16");
    const ids = [];
    for (const reps of [10, 9, 8, 7, 6]) {
      ids.push((await addSet(entryId, { reps, weightKg: 60 })).id);
    }
    await addSet(other.entryId, { reps: 12, weightKg: 40 });
    await addSet(other.entryId, { reps: 11, weightKg: 40 });

    await deleteSet(ids[1]);

    expect(await setsOf(entryId)).toEqual([
      [1, 10, 60],
      [2, 8, 60],
      [3, 7, 60],
      [4, 6, 60],
    ]);
    // Another exercise in the same workout is untouched.
    expect(await setsOf(other.entryId)).toEqual([
      [1, 12, 40],
      [2, 11, 40],
    ]);
  });

  test("deleting the last set leaves the others alone", async () => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    await addSet(entryId, { reps: 10, weightKg: 60 });
    const last = await addSet(entryId, { reps: 9, weightKg: 60 });

    await deleteSet(last.id);

    expect(await setsOf(entryId)).toEqual([[1, 10, 60]]);
  });

  test("does nothing for an unknown id", async () => {
    const { entryId } = await entryFor("Squat", "2026-11-16");
    await addSet(entryId, { reps: 10, weightKg: 60 });
    await deleteSet(999);
    expect(await setsOf(entryId)).toEqual([[1, 10, 60]]);
  });
});

describe("getLastSessionSets", () => {
  test("returns the sets of the most recent earlier workout with that exercise", async () => {
    const old = await entryFor("Squat", "2026-11-02");
    await addSet(old.entryId, { reps: 5, weightKg: 90 });
    const recent = await entryFor("Squat", "2026-11-09");
    await addSet(recent.entryId, { reps: 5, weightKg: 100 });
    await addSet(recent.entryId, { reps: 4, weightKg: 102.5 });
    // Today and a later day must not count.
    const today = await entryFor("Squat", "2026-11-16");
    await addSet(today.entryId, { reps: 1, weightKg: 120 });
    const future = await entryFor("Squat", "2026-11-20");
    await addSet(future.entryId, { reps: 1, weightKg: 130 });
    // Neither does another exercise on a closer day.
    const row = await entryFor("Row", "2026-11-12");
    await addSet(row.entryId, { reps: 10, weightKg: 50 });

    const last = await getLastSessionSets(recent.exerciseId, "2026-11-16");

    expect(last?.date).toBe("2026-11-09");
    expect(last?.sets.map((s) => [s.setNumber, s.reps, s.weightKg])).toEqual([
      [1, 5, 100],
      [2, 4, 102.5],
    ]);
  });

  test("skips a workout where the exercise was added but has no sets", async () => {
    const withSets = await entryFor("Squat", "2026-11-02");
    await addSet(withSets.entryId, { reps: 5, weightKg: 90 });
    await entryFor("Squat", "2026-11-09");

    const last = await getLastSessionSets(withSets.exerciseId, "2026-11-16");

    expect(last?.date).toBe("2026-11-02");
  });

  test("returns null when the exercise was never done before", async () => {
    const { entryId, exerciseId } = await entryFor("Squat", "2026-11-16");
    await addSet(entryId, { reps: 5, weightKg: 100 });

    expect(await getLastSessionSets(exerciseId, "2026-11-16")).toBeNull();
  });
});
