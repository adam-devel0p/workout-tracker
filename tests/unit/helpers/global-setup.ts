import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

// Runs once before the unit tests: recreates the empty test database and
// applies every migration to it, which also proves the migrations apply
// cleanly to an empty database.
export default async function setup(project: TestProject) {
  // Set in vitest.config.mts.
  const testUrl = new URL(project.config.env.DATABASE_URL ?? "");
  const name = testUrl.pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to recreate "${name}": not a test database.`);
  }

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      "Cannot reach the local Postgres. Start it with `docker compose up -d`.",
      { cause: error },
    );
  }
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const client = new Client({ connectionString: testUrl.toString() });
  await client.connect();
  await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
  await client.end();
}
