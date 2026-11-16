import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local first.",
  );
}

// Reuse one pool across hot reloads in development, so `next dev` does not
// open a new set of connections on every file change.
const globalForDb = globalThis as unknown as { dbPool?: Pool };

const pool =
  globalForDb.dbPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbPool = pool;
}

export const db = drizzle({ client: pool });
