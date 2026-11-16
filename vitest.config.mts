import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * URL of the database the unit tests use: the configured database name with
 * "_test" appended, so tests never touch development data. Only a local
 * Postgres is accepted, because the test database is dropped on every run
 * (see tests/unit/helpers/global-setup.ts).
 */
function testDatabaseUrl(): string {
  const url = new URL(
    process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/workout_tracker",
  );
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error(
      `Unit tests only run against a local Postgres, not "${url.hostname}".`,
    );
  }
  url.pathname += "_test";
  return url.toString();
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Database tests share one test database, so test files run one at a time.
    fileParallelism: false,
    globalSetup: ["tests/unit/helpers/global-setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl(),
    },
  },
});
