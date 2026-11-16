export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found.`);
    this.name = "NotFoundError";
  }
}

export class ExerciseNameTakenError extends Error {
  constructor(name: string) {
    super(`An exercise named "${name}" already exists.`);
    this.name = "ExerciseNameTakenError";
  }
}

export class ExerciseInUseError extends Error {
  constructor() {
    super(
      "This exercise has been used in a workout and cannot be deleted. Archive it instead.",
    );
    this.name = "ExerciseInUseError";
  }
}

export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";
export const PG_CHECK_VIOLATION = "23514";

/** Postgres error code of a failed query, or undefined for any other error. */
export function pgErrorCode(error: unknown): string | undefined {
  // Drizzle wraps the driver's error and keeps the original as `cause`.
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    const code = (candidate as { code?: unknown })?.code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
