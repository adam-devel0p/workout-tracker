import { and, asc, desc, eq, exists, gt, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/lib/db/errors";
import {
  workout,
  workoutExercise,
  workoutSet,
  type WorkoutSet,
} from "@/lib/db/schema";
import { setInputSchema, type SetInput } from "@/lib/validation/schemas";

/** Adds a set after the last one of that exercise in the workout. */
export async function addSet(
  workoutExerciseId: number,
  input: SetInput,
): Promise<WorkoutSet> {
  const { reps, weightKg } = setInputSchema.parse(input);
  const [added] = await db
    .insert(workoutSet)
    .values({
      workoutExerciseId,
      setNumber: sql`(SELECT coalesce(max(set_number), 0) + 1 FROM workout_set WHERE workout_exercise_id = ${workoutExerciseId})`,
      reps,
      weightKg,
    })
    .returning();
  return added;
}

export async function updateSet(
  id: number,
  input: SetInput,
): Promise<WorkoutSet> {
  const { reps, weightKg } = setInputSchema.parse(input);
  const [updated] = await db
    .update(workoutSet)
    .set({ reps, weightKg })
    .where(eq(workoutSet.id, id))
    .returning();
  if (!updated) throw new NotFoundError("Set");
  return updated;
}

/** Deletes the set and renumbers the ones after it, so numbers stay 1, 2, 3… */
export async function deleteSet(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(workoutSet)
      .where(eq(workoutSet.id, id))
      .returning();
    if (!deleted) return;

    const later = await tx
      .select({ id: workoutSet.id, setNumber: workoutSet.setNumber })
      .from(workoutSet)
      .where(
        and(
          eq(workoutSet.workoutExerciseId, deleted.workoutExerciseId),
          gt(workoutSet.setNumber, deleted.setNumber),
        ),
      )
      .orderBy(asc(workoutSet.setNumber));

    // One row at a time, lowest first: a single UPDATE could hit the unique
    // (workout_exercise_id, set_number) constraint part-way through.
    for (const set of later) {
      await tx
        .update(workoutSet)
        .set({ setNumber: set.setNumber - 1 })
        .where(eq(workoutSet.id, set.id));
    }
  });
}

/**
 * The sets of the most recent workout before `beforeDate` ("YYYY-MM-DD") in
 * which the exercise has at least one set, or null if there is none.
 */
export async function getLastSessionSets(
  exerciseId: number,
  beforeDate: string,
): Promise<{ date: string; sets: WorkoutSet[] } | null> {
  const [last] = await db
    .select({ workoutExerciseId: workoutExercise.id, date: workout.date })
    .from(workoutExercise)
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(
      and(
        eq(workoutExercise.exerciseId, exerciseId),
        lt(workout.date, beforeDate),
        exists(
          db
            .select({ one: sql`1` })
            .from(workoutSet)
            .where(eq(workoutSet.workoutExerciseId, workoutExercise.id)),
        ),
      ),
    )
    .orderBy(desc(workout.date))
    .limit(1);
  if (!last) return null;

  const sets = await db
    .select()
    .from(workoutSet)
    .where(eq(workoutSet.workoutExerciseId, last.workoutExerciseId))
    .orderBy(asc(workoutSet.setNumber));
  return { date: last.date, sets };
}
