import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { validateEnv, REQUIRED_ENV_CORE } from "@/server/lib/runtime-env";
import { startAuditWorker, stopAuditWorker } from "@/server/workers/audit-worker";
import {
  startAnalyticsWorker,
  stopAnalyticsWorker,
} from "@/server/workers/analytics-worker";
import { closeRedis } from "@/server/lib/redis";
import { pool } from "@/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "server" });

// Fail fast on missing required environment variables. Runs once per process.
validateEnv(REQUIRED_ENV_CORE);

// Start the BullMQ Workers as part of the HTTP server process. Plan 4 (Docker)
// may opt to run the worker in a separate container; at that time the startup
// of this function will move to a dedicated entry file. For Phase 3 we run
// Worker + HTTP in one process for dev simplicity.
startAuditWorker();

// Start analytics worker (initializes nightly scheduler at 02:00 UTC)
void startAnalyticsWorker();

// Graceful shutdown: drain Worker (up to 25s), then close Redis connections,
// then close Postgres pool. Order matters — Worker may still write to DB/Redis
// during drain.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("Shutdown signal received", { signal });
  try {
    await stopAuditWorker();
  } catch (err) {
    log.error("stopAuditWorker failed", err instanceof Error ? err : new Error(String(err)));
  }
  try {
    await stopAnalyticsWorker();
  } catch (err) {
    log.error("stopAnalyticsWorker failed", err instanceof Error ? err : new Error(String(err)));
  }
  try {
    await closeRedis();
  } catch (err) {
    log.error("closeRedis failed", err instanceof Error ? err : new Error(String(err)));
  }
  try {
    await pool.end();
  } catch (err) {
    log.error("pool.end failed", err instanceof Error ? err : new Error(String(err)));
  }
  log.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

const fetch = createStartHandler(defaultStreamHandler);

export default {
  fetch,
};
