import { describe, expect, test } from "vitest";
import { db } from "@/lib/db/client";
import {
  ExerciseInUseError,
  ExerciseNameTakenError,
  NotFoundError,
} from "@/lib/db/errors";
import {
  archiveExercise,
  createExercise,
  deleteExercise,
  renameExercise,
  searchExercises,
  unarchiveExercise,
} from "@/lib/db/queries/exercises";
import { addSet } from "@/lib/db/queries/sets";
import { addExerciseToWorkout } from "@/lib/db/queries/workout-exercises";
import { getOrCreateWorkout, getWorkoutByDate } from "@/lib/db/queries/workouts";
import { exercise } from "@/lib/db/schema";
import { startWithEmptyDatabase } from "./helpers/db";

startWithEmptyDatabase();

async function names(text: string) {
  return (await searchExercises(text)).map((e) => e.name);
}

describe("createExercise", () => {
  test("trims the name", async () => {
    const created = await createExercise("  Bench Press  ");
    expect(created.name).toBe("Bench Press");
    expect(created.archivedAt).toBeNull();
  });

  test('creating "bench press" when "Bench Press" exists returns the existing row', async () => {
    const first = await createExercise("Bench Press");
    const second = await createExercise(" bench press ");

    expect(second).toEqual(first);
    expect(await db.select().from(exercise)).toHaveLength(1);
  });

  test("unarchives an archived exercise that is asked for again", async () => {
    const first = await createExercise("Squat");
    await archiveExercise(first.id);

    const again = await createExercise("squat");

    expect(again.id).toBe(first.id);
    expect(again.archivedAt).toBeNull();
  });

  test("rejects an empty name", async () => {
    await expect(createExercise("   ")).rejects.toThrow(
      "Enter an exercise name.",
    );
  });

  test("the database itself rejects a name that differs only in case", async () => {
    await db.insert(exercise).values({ name: "Deadlift" });
    await expect(
      db.insert(exercise).values({ name: "DEADLIFT" }),
    ).rejects.toThrow();
  });
});

describe("searchExercises", () => {
  test("matches anywhere in the name, ignoring case, prefix matches first", async () => {
    await createExercise("Incline Bench Press");
    await createExercise("Bench Press");
    await createExercise("Squat");
    await createExercise("bench dip");

    expect(await names("BENCH")).toEqual([
      "bench dip",
      "Bench Press",
      "Incline Bench Press",
    ]);
  });

  test("an empty text returns everything, alphabetically", async () => {
    await createExercise("Squat");
    await createExercise("bench press");
    expect(await names("")).toEqual(["bench press", "Squat"]);
  });

  test("respects the limit", async () => {
    await createExercise("A");
    await createExercise("B");
    expect(await searchExercises("", 1)).toHaveLength(1);
  });

  test("treats % and _ as plain characters", async () => {
    await createExercise("Squat");
    await createExercise("50% squat");
    expect(await names("%")).toEqual(["50% squat"]);
    expect(await names("_")).toEqual([]);
  });
});

describe("renameExercise", () => {
  test("renames and trims", async () => {
    const created = await createExercise("Benhc Press");
    const renamed = await renameExercise(created.id, " Bench Press ");
    expect(renamed.name).toBe("Bench Press");
    expect(await names("bench")).toEqual(["Bench Press"]);
  });

  test("can change only the letter case", async () => {
    const created = await createExercise("bench press");
    const renamed = await renameExercise(created.id, "Bench Press");
    expect(renamed.name).toBe("Bench Press");
  });

  test("rejects a name another exercise already has, in any case", async () => {
    await createExercise("Bench Press");
    const other = await createExercise("Squat");

    const attempt = renameExercise(other.id, "bench PRESS");
    await expect(attempt).rejects.toThrow(ExerciseNameTakenError);
    await expect(attempt).rejects.toThrow(
      'An exercise named "bench PRESS" already exists.',
    );
  });

  test("throws for an unknown id", async () => {
    await expect(renameExercise(999, "Anything")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("archive, unarchive and delete", () => {
  test("archiving hides the exercise from search but keeps its history", async () => {
    const squat = await createExercise("Squat");
    const workout = await getOrCreateWorkout("2026-11-10");
    const entry = await addExerciseToWorkout(workout.id, squat.id);
    await addSet(entry.id, { reps: 5, weightKg: 100 });

    const archived = await archiveExercise(squat.id);

    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(await names("squat")).toEqual([]);
    const history = await getWorkoutByDate("2026-11-10");
    expect(history?.exercises[0].name).toBe("Squat");
    expect(history?.exercises[0].sets).toHaveLength(1);
  });

  test("unarchiving brings it back in search", async () => {
    const squat = await createExercise("Squat");
    await archiveExercise(squat.id);

    const restored = await unarchiveExercise(squat.id);

    expect(restored.archivedAt).toBeNull();
    expect(await names("squat")).toEqual(["Squat"]);
  });

  test("archiving an unknown id throws", async () => {
    await expect(archiveExercise(999)).rejects.toThrow(NotFoundError);
  });

  test("a used exercise cannot be deleted", async () => {
    const squat = await createExercise("Squat");
    const workout = await getOrCreateWorkout("2026-11-10");
    await addExerciseToWorkout(workout.id, squat.id);

    await expect(deleteExercise(squat.id)).rejects.toThrow(ExerciseInUseError);
    expect(await db.select().from(exercise)).toHaveLength(1);
  });

  test("an unused exercise can be deleted", async () => {
    const typo = await createExercise("Sqaut");
    await deleteExercise(typo.id);
    expect(await db.select().from(exercise)).toHaveLength(0);
  });
});
