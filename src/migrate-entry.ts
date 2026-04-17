// Standalone migration runner for CI-02.
// Uses drizzle-orm/node-postgres/migrator (prod dep) — NOT drizzle-kit (dev dep, pruned in runtime image).
// Invoked by the open-seo-migrate compose service during deploy, BEFORE new app containers go live.

import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("[migrate] DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  console.log("[migrate] applying migrations from ./drizzle ...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[migrate] migrations applied successfully");
  } catch (err) {
    console.error("[migrate] migration failed:", err);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

main();
