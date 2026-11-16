import { describe, expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/lib/db/errors";
import { createExercise } from "@/lib/db/queries/exercises";
import { addSet } from "@/lib/db/queries/sets";
import { addExerciseToWorkout } from "@/lib/db/queries/workout-exercises";
import {
  deleteWorkout,
  getOrCreateWorkout,
  getWorkoutByDate,
  listWorkoutSummaries,
  updateWorkoutNotes,
} from "@/lib/db/queries/workouts";
import {
  exercise,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import { startWithEmptyDatabase } from "./helpers/db";

startWithEmptyDatabase();

/** Creates a workout with the given exercises and sets ([reps, weightKg]). */
async function logWorkout(
  date: string,
  exercises: Record<string, [number, number | null][]>,
) {
  const created = await getOrCreateWorkout(date);
  for (const [name, sets] of Object.entries(exercises)) {
    const { id } = await createExercise(name);
    const entry = await addExerciseToWorkout(created.id, id);
    for (const [reps, weightKg] of sets) {
      await addSet(entry.id, { reps, weightKg });
    }
  }
  return created;
}

describe("getOrCreateWorkout", () => {
  test("creates an empty workout for a new date", async () => {
    const created = await getOrCreateWorkout("2026-11-16");
    expect(created).toMatchObject({ date: "2026-11-16", notes: null });
  });

  test("returns the existing workout for a date that has one", async () => {
    const first = await getOrCreateWorkout("2026-11-16");
    const second = await getOrCreateWorkout("2026-11-16");

    expect(second).toEqual(first);
    expect(await db.select().from(workout)).toHaveLength(1);
  });

  test("the database rejects two workouts on the same date", async () => {
    await db.insert(workout).values({ date: "2026-11-16" });
    await expect(
      db.insert(workout).values({ date: "2026-11-16" }),
    ).rejects.toThrow();
  });
});

describe("getWorkoutByDate", () => {
  test("returns null when there is no workout", async () => {
    expect(await getWorkoutByDate("2026-11-16")).toBeNull();
  });

  test("returns a workout without exercises", async () => {
    await getOrCreateWorkout("2026-11-16");
    const found = await getWorkoutByDate("2026-11-16");
    expect(found?.exercises).toEqual([]);
  });

  test("returns exercises in position order with their sets in set order", async () => {
    await logWorkout("2026-11-16", {
      Squat: [
        [5, 100],
        [5, 102.5],
      ],
      "Pull-up": [[8, null]],
    });
    await logWorkout("2026-11-15", { Squat: [[3, 90]] });

    const found = await getWorkoutByDate("2026-11-16");

    expect(found?.date).toBe("2026-11-16");
    expect(
      found?.exercises.map((e) => ({
        name: e.name,
        position: e.position,
        sets: e.sets.map((s) => [s.setNumber, s.reps, s.weightKg]),
      })),
    ).toEqual([
      {
        name: "Squat",
        position: 1,
        sets: [
          [1, 5, 100],
          [2, 5, 102.5],
        ],
      },
      { name: "Pull-up", position: 2, sets: [[1, 8, null]] },
    ]);
  });
});

describe("updateWorkoutNotes", () => {
  test("saves trimmed notes", async () => {
    const created = await getOrCreateWorkout("2026-11-16");
    const updated = await updateWorkoutNotes(created.id, "  Felt strong \n");
    expect(updated.notes).toBe("Felt strong");
  });

  test.each(["", "   ", null])("stores %j as no notes", async (notes) => {
    const created = await getOrCreateWorkout("2026-11-16");
    await updateWorkoutNotes(created.id, "Something");
    const updated = await updateWorkoutNotes(created.id, notes);
    expect(updated.notes).toBeNull();
  });

  test("throws for an unknown id", async () => {
    await expect(updateWorkoutNotes(999, "x")).rejects.toThrow(NotFoundError);
  });
});

describe("deleteWorkout", () => {
  test("removes the workout with its exercises and sets, keeps the rest", async () => {
    const doomed = await logWorkout("2026-11-16", {
      Squat: [
        [5, 100],
        [5, 100],
      ],
      "Pull-up": [[8, null]],
    });
    await logWorkout("2026-11-15", { Squat: [[3, 90]] });

    await deleteWorkout(doomed.id);

    expect(await getWorkoutByDate("2026-11-16")).toBeNull();
    expect(await db.select().from(workout)).toHaveLength(1);
    expect(await db.select().from(workoutExercise)).toHaveLength(1);
    expect(await db.select().from(workoutSet)).toHaveLength(1);
    // Exercises themselves are never removed with a workout.
    expect(await db.select().from(exercise)).toHaveLength(2);
  });
});

describe("listWorkoutSummaries", () => {
  test("returns an empty list when nothing is logged", async () => {
    expect(await listWorkoutSummaries()).toEqual([]);
  });

  test("lists workouts newest first with exercises, sets, reps and volume", async () => {
    await logWorkout("2026-11-10", {
      Squat: [
        [5, 100],
        [5, 102.5],
      ],
      "Pull-up": [
        [8, null],
        [6, null],
      ],
    });
    const later = await logWorkout("2026-11-12", { "Pull-up": [[10, null]] });
    await updateWorkoutNotes(later.id, "Quick one");
    const empty = await getOrCreateWorkout("2026-11-14");

    expect(await listWorkoutSummaries()).toEqual([
      {
        id: empty.id,
        date: "2026-11-14",
        notes: null,
        exerciseNames: [],
        setCount: 0,
        totalReps: 0,
        volume: 0,
      },
      {
        id: later.id,
        date: "2026-11-12",
        notes: "Quick one",
        exerciseNames: ["Pull-up"],
        setCount: 1,
        totalReps: 10,
        volume: 0,
      },
      {
        id: expect.any(Number),
        date: "2026-11-10",
        notes: null,
        exerciseNames: ["Squat", "Pull-up"],
        setCount: 4,
        totalReps: 24,
        volume: 1012.5,
      },
    ]);
  });

  test("pages with limit and offset", async () => {
    for (const date of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
      await getOrCreateWorkout(date);
    }

    const firstPage = await listWorkoutSummaries({ limit: 2 });
    const secondPage = await listWorkoutSummaries({ limit: 2, offset: 2 });

    expect(firstPage.map((w) => w.date)).toEqual(["2026-11-03", "2026-11-02"]);
    expect(secondPage.map((w) => w.date)).toEqual(["2026-11-01"]);
  });
});
