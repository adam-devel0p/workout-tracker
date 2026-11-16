import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const exercise = pgTable(
  "exercise",
  {
    id: serial().primaryKey(),
    name: text().notNull(),
    // Hidden from the picker, history kept.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("exercise_name_unique").on(sql`lower(${t.name})`)],
);

export const workout = pgTable("workout", {
  id: serial().primaryKey(),
  // One workout per day. Kept as a "YYYY-MM-DD" string so no time zone can shift it.
  date: date({ mode: "string" }).notNull().unique(),
  notes: text(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// An exercise done in a workout.
export const workoutExercise = pgTable(
  "workout_exercise",
  {
    id: serial().primaryKey(),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workout.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercise.id, { onDelete: "restrict" }),
    // Order within the workout, starting at 1.
    position: integer().notNull(),
  },
  (t) => [unique().on(t.workoutId, t.exerciseId)],
);

export const workoutSet = pgTable(
  "workout_set",
  {
    id: serial().primaryKey(),
    workoutExerciseId: integer("workout_exercise_id")
      .notNull()
      .references(() => workoutExercise.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer().notNull(),
    // NULL = bodyweight.
    weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }),
  },
  (t) => [
    unique().on(t.workoutExerciseId, t.setNumber),
    check("workout_set_set_number_check", sql`${t.setNumber} > 0`),
    check("workout_set_reps_check", sql`${t.reps} > 0`),
    check("workout_set_weight_kg_check", sql`${t.weightKg} >= 0`),
  ],
);

export type Exercise = typeof exercise.$inferSelect;
export type Workout = typeof workout.$inferSelect;
export type WorkoutExercise = typeof workoutExercise.$inferSelect;
export type WorkoutSet = typeof workoutSet.$inferSelect;
