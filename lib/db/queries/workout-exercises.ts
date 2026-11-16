import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { workoutExercise, type WorkoutExercise } from "@/lib/db/schema";

/**
 * Adds the exercise at the end of the workout. If it is already in the
 * workout, the existing row is returned and nothing changes.
 */
export async function addExerciseToWorkout(
  workoutId: number,
  exerciseId: number,
): Promise<WorkoutExercise> {
  const [added] = await db
    .insert(workoutExercise)
    .values({
      workoutId,
      exerciseId,
      position: sql`(SELECT coalesce(max(position), 0) + 1 FROM workout_exercise WHERE workout_id = ${workoutId})`,
    })
    .onConflictDoNothing({
      target: [workoutExercise.workoutId, workoutExercise.exerciseId],
    })
    .returning();
  if (added) return added;

  const [existing] = await db
    .select()
    .from(workoutExercise)
    .where(
      and(
        eq(workoutExercise.workoutId, workoutId),
        eq(workoutExercise.exerciseId, exerciseId),
      ),
    );
  return existing;
}

/** Removes the exercise and its sets from the workout and closes the gap in positions. */
export async function removeWorkoutExercise(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(workoutExercise)
      .where(eq(workoutExercise.id, id))
      .returning();
    if (!removed) return;

    await tx
      .update(workoutExercise)
      .set({ position: sql`${workoutExercise.position} - 1` })
      .where(
        and(
          eq(workoutExercise.workoutId, removed.workoutId),
          gt(workoutExercise.position, removed.position),
        ),
      );
  });
}

/**
 * Sets the order of a workout's exercises. `orderedIds` must hold every
 * workout_exercise id of the workout exactly once.
 */
export async function reorderWorkoutExercises(
  workoutId: number,
  orderedIds: number[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: workoutExercise.id })
      .from(workoutExercise)
      .where(eq(workoutExercise.workoutId, workoutId));

    const currentIds = new Set(current.map((row) => row.id));
    const sameIds =
      orderedIds.length === currentIds.size &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => currentIds.has(id));
    if (!sameIds) {
      throw new Error(
        "The new order must list every exercise of the workout exactly once.",
      );
    }

    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(workoutExercise)
        .set({ position: index + 1 })
        .where(eq(workoutExercise.id, id));
    }
  });
}
