import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  ExerciseInUseError,
  ExerciseNameTakenError,
  NotFoundError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from "@/lib/db/errors";
import { exercise, type Exercise } from "@/lib/db/schema";
import { exerciseNameSchema } from "@/lib/validation/schemas";

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

/**
 * Non-archived exercises whose name contains the text, ignoring case. Names
 * that start with the text come first, then alphabetical. An empty text
 * returns all of them.
 */
export async function searchExercises(
  text: string,
  limit = 20,
): Promise<Exercise[]> {
  const pattern = escapeLike(text.trim());
  return db
    .select()
    .from(exercise)
    .where(
      and(
        isNull(exercise.archivedAt),
        sql`${exercise.name} ILIKE ${`%${pattern}%`}`,
      ),
    )
    .orderBy(
      sql`${exercise.name} ILIKE ${`${pattern}%`} DESC`,
      sql`lower(${exercise.name})`,
    )
    .limit(limit);
}

/**
 * Creates an exercise with the trimmed name. If one with the same name in any
 * letter case already exists, that row is returned instead (and unarchived,
 * since asking for it again means it is wanted in the picker).
 */
export async function createExercise(name: string): Promise<Exercise> {
  const trimmed = exerciseNameSchema.parse(name);

  const [created] = await db
    .insert(exercise)
    .values({ name: trimmed })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [existing] = await db
    .update(exercise)
    .set({ archivedAt: null })
    .where(sql`lower(${exercise.name}) = lower(${trimmed})`)
    .returning();
  return existing;
}

/** Throws ExerciseNameTakenError if another exercise already has the name. */
export async function renameExercise(
  id: number,
  name: string,
): Promise<Exercise> {
  const trimmed = exerciseNameSchema.parse(name);
  try {
    const [updated] = await db
      .update(exercise)
      .set({ name: trimmed })
      .where(eq(exercise.id, id))
      .returning();
    if (!updated) throw new NotFoundError("Exercise");
    return updated;
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw new ExerciseNameTakenError(trimmed);
    }
    throw error;
  }
}

async function setArchivedAt(
  id: number,
  archivedAt: Date | null,
): Promise<Exercise> {
  const [updated] = await db
    .update(exercise)
    .set({ archivedAt })
    .where(eq(exercise.id, id))
    .returning();
  if (!updated) throw new NotFoundError("Exercise");
  return updated;
}

/** Hides the exercise from search. Workouts that used it keep it. */
export async function archiveExercise(id: number): Promise<Exercise> {
  return setArchivedAt(id, new Date());
}

export async function unarchiveExercise(id: number): Promise<Exercise> {
  return setArchivedAt(id, null);
}

/** Only for exercises never used in a workout; otherwise throws ExerciseInUseError. */
export async function deleteExercise(id: number): Promise<void> {
  try {
    await db.delete(exercise).where(eq(exercise.id, id));
  } catch (error) {
    if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) {
      throw new ExerciseInUseError();
    }
    throw error;
  }
}
