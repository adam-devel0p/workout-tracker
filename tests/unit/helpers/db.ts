import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db/client";

/** Call at the top of a test file that uses the database: every test starts empty. */
export function startWithEmptyDatabase() {
  beforeEach(async () => {
    await db.execute(
      sql`TRUNCATE exercise, workout, workout_exercise, workout_set RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await db.$client.end();
  });
}
