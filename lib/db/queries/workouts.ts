import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { NotFoundError } from "@/lib/db/errors";
import {
  exercise,
  workout,
  workoutExercise,
  workoutSet,
  type Workout,
  type WorkoutSet,
} from "@/lib/db/schema";

// Dates are "YYYY-MM-DD" strings everywhere.

export type WorkoutDetail = Workout & {
  exercises: {
    /** workout_exercise id */
    id: number;
    exerciseId: number;
    name: string;
    position: number;
    sets: WorkoutSet[];
  }[];
};

export type WorkoutSummary = {
  id: number;
  date: string;
  notes: string | null;
  /** In workout order. */
  exerciseNames: string[];
  setCount: number;
  totalReps: number;
  /** Sum of reps × weight_kg; sets without weight add nothing. */
  volume: number;
};

/** The workout on that date with its exercises and sets in order, or null. */
export async function getWorkoutByDate(
  date: string,
): Promise<WorkoutDetail | null> {
  const [found] = await db.select().from(workout).where(eq(workout.date, date));
  if (!found) return null;

  const exercises = await db
    .select({
      id: workoutExercise.id,
      exerciseId: workoutExercise.exerciseId,
      name: exercise.name,
      position: workoutExercise.position,
    })
    .from(workoutExercise)
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(eq(workoutExercise.workoutId, found.id))
    .orderBy(asc(workoutExercise.position));

  const sets = await db
    .select()
    .from(workoutSet)
    .where(
      inArray(
        workoutSet.workoutExerciseId,
        exercises.map((e) => e.id),
      ),
    )
    .orderBy(asc(workoutSet.setNumber));

  return {
    ...found,
    exercises: exercises.map((e) => ({
      ...e,
      sets: sets.filter((s) => s.workoutExerciseId === e.id),
    })),
  };
}

/** Returns the workout on that date, creating an empty one if there is none. */
export async function getOrCreateWorkout(date: string): Promise<Workout> {
  const [created] = await db
    .insert(workout)
    .values({ date })
    .onConflictDoNothing({ target: workout.date })
    .returning();
  if (created) return created;

  const [existing] = await db
    .select()
    .from(workout)
    .where(eq(workout.date, date));
  return existing;
}

/** Empty or whitespace-only notes are stored as NULL. */
export async function updateWorkoutNotes(
  id: number,
  notes: string | null,
): Promise<Workout> {
  const [updated] = await db
    .update(workout)
    .set({ notes: notes?.trim() || null })
    .where(eq(workout.id, id))
    .returning();
  if (!updated) throw new NotFoundError("Workout");
  return updated;
}

/** Deletes the workout with its exercises and sets. */
export async function deleteWorkout(id: number): Promise<void> {
  await db.delete(workout).where(eq(workout.id, id));
}

/** Workouts newest first, with totals for the history list. */
export async function listWorkoutSummaries({
  limit = 20,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<WorkoutSummary[]> {
  const rows = await db
    .select({
      id: workout.id,
      date: workout.date,
      notes: workout.notes,
      setCount: sql<number>`count(${workoutSet.id})::int`,
      totalReps: sql<number>`coalesce(sum(${workoutSet.reps}), 0)::int`,
      volume: sql<number>`coalesce(sum(${workoutSet.reps} * ${workoutSet.weightKg}), 0)::float8`,
    })
    .from(workout)
    .leftJoin(workoutExercise, eq(workoutExercise.workoutId, workout.id))
    .leftJoin(workoutSet, eq(workoutSet.workoutExerciseId, workoutExercise.id))
    .groupBy(workout.id)
    .orderBy(desc(workout.date))
    .limit(limit)
    .offset(offset);

  const names = await db
    .select({ workoutId: workoutExercise.workoutId, name: exercise.name })
    .from(workoutExercise)
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(
      inArray(
        workoutExercise.workoutId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(workoutExercise.position));

  return rows.map((row) => ({
    ...row,
    exerciseNames: names
      .filter((n) => n.workoutId === row.id)
      .map((n) => n.name),
  }));
}
