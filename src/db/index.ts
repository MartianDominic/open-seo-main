import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is required — set it in .env or the deployment environment before starting the server.",
  );
}

// Single shared pool for the lifetime of the Node process.
// drizzle-kit migrate uses a separate short-lived pool; app runtime reuses this one.
export const pool = new Pool({
  connectionString,
  // Reasonable defaults for a single Node.js server; tune in Phase 4 for VPS load.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });
