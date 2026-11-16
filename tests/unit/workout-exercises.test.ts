import { describe, expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { createExercise } from "@/lib/db/queries/exercises";
import { addSet } from "@/lib/db/queries/sets";
import {
  addExerciseToWorkout,
  removeWorkoutExercise,
  reorderWorkoutExercises,
} from "@/lib/db/queries/workout-exercises";
import { getOrCreateWorkout, getWorkoutByDate } from "@/lib/db/queries/workouts";
import { workoutExercise, workoutSet } from "@/lib/db/schema";
import { startWithEmptyDatabase } from "./helpers/db";

startWithEmptyDatabase();

const DATE = "2026-11-16";

/** A workout on DATE with the named exercises, in that order. */
async function workoutWith(...names: string[]) {
  const workout = await getOrCreateWorkout(DATE);
  const entries = [];
  for (const name of names) {
    const exercise = await createExercise(name);
    entries.push(await addExerciseToWorkout(workout.id, exercise.id));
  }
  return { workout, entries };
}

async function order() {
  const found = await getWorkoutByDate(DATE);
  return found?.exercises.map((e) => [e.position, e.name]);
}

describe("addExerciseToWorkout", () => {
  test("appends exercises in the order they are added", async () => {
    await workoutWith("Squat", "Bench Press", "Row");
    expect(await order()).toEqual([
      [1, "Squat"],
      [2, "Bench Press"],
      [3, "Row"],
    ]);
  });

  test("does not add the same exercise twice; returns the existing entry", async () => {
    const { workout, entries } = await workoutWith("Squat", "Row");

    const again = await addExerciseToWorkout(
      workout.id,
      entries[0].exerciseId,
    );

    expect(again).toEqual(entries[0]);
    expect(await db.select().from(workoutExercise)).toHaveLength(2);
  });

  test("positions are counted per workout", async () => {
    const { entries } = await workoutWith("Squat");
    const other = await getOrCreateWorkout("2026-11-17");

    const added = await addExerciseToWorkout(other.id, entries[0].exerciseId);

    expect(added.position).toBe(1);
  });

  test("rejects an exercise that does not exist", async () => {
    const workout = await getOrCreateWorkout(DATE);
    await expect(addExerciseToWorkout(workout.id, 999)).rejects.toThrow();
  });
});

describe("removeWorkoutExercise", () => {
  test("removes the exercise with its sets and closes the gap", async () => {
    const { entries } = await workoutWith("Squat", "Bench Press", "Row");
    await addSet(entries[1].id, { reps: 8, weightKg: 60 });
    await addSet(entries[2].id, { reps: 10, weightKg: 50 });

    await removeWorkoutExercise(entries[1].id);

    expect(await order()).toEqual([
      [1, "Squat"],
      [2, "Row"],
    ]);
    expect(await db.select().from(workoutSet)).toHaveLength(1);
  });

  test("does nothing for an unknown id", async () => {
    await workoutWith("Squat");
    await removeWorkoutExercise(999);
    expect(await order()).toEqual([[1, "Squat"]]);
  });
});

describe("reorderWorkoutExercises", () => {
  test("applies the new order", async () => {
    const { workout, entries } = await workoutWith("Squat", "Bench Press", "Row");
    const [squat, bench, row] = entries;

    await reorderWorkoutExercises(workout.id, [row.id, squat.id, bench.id]);

    expect(await order()).toEqual([
      [1, "Row"],
      [2, "Squat"],
      [3, "Bench Press"],
    ]);
  });

  test("rejects a list that is incomplete, has duplicates or foreign ids, and changes nothing", async () => {
    const { workout, entries } = await workoutWith("Squat", "Row");
    const [squat, row] = entries;

    for (const ids of [
      [row.id],
      [row.id, row.id],
      [row.id, 999],
      [row.id, squat.id, 999],
    ]) {
      await expect(reorderWorkoutExercises(workout.id, ids)).rejects.toThrow(
        "exactly once",
      );
    }
    expect(await order()).toEqual([
      [1, "Squat"],
      [2, "Row"],
    ]);
  });
});
