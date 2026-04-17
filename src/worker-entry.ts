/**
 * Dedicated BullMQ worker entry — used by the `open-seo-worker` service in
 * docker-compose.vps.yml. Does NOT start the HTTP server. Runs only the
 * sandboxed audit worker + graceful shutdown.
 */
import { validateEnv, REQUIRED_ENV_CORE } from "@/server/lib/runtime-env";
import { startAuditWorker, stopAuditWorker } from "@/server/workers/audit-worker";
import { closeRedis } from "@/server/lib/redis";
import { pool } from "@/db";

validateEnv(REQUIRED_ENV_CORE);

startAuditWorker();
console.log("[worker-entry] audit worker started");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker-entry] ${signal} received — shutting down`);
  try { await stopAuditWorker(); } catch (err) { console.error("[worker-entry] stopAuditWorker failed:", err); }
  try { await closeRedis(); } catch (err) { console.error("[worker-entry] closeRedis failed:", err); }
  try { await pool.end(); } catch (err) { console.error("[worker-entry] pool.end failed:", err); }
  console.log("[worker-entry] shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT");  });

// Keep process alive — workers are event-driven, not request-driven.
setInterval(() => {}, 1 << 30);
