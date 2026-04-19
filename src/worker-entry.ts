/**
 * Dedicated BullMQ worker entry — used by the `open-seo-worker` service in
 * docker-compose.vps.yml. Does NOT start the HTTP server. Runs only the
 * sandboxed audit worker + graceful shutdown.
 */
import { validateEnv, REQUIRED_ENV_CORE } from "@/server/lib/runtime-env";
import { startAuditWorker, stopAuditWorker } from "@/server/workers/audit-worker";
import { startReportWorker, stopReportWorker } from "@/server/workers/report-worker";
import { startScheduleWorker, stopScheduleWorker } from "@/server/workers/schedule-worker";
import { closeRedis } from "@/server/lib/redis";
import { pool } from "@/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "worker-entry" });

validateEnv(REQUIRED_ENV_CORE);

startAuditWorker();
log.info("Audit worker started");

startReportWorker();
log.info("Report worker started");

startScheduleWorker();
log.info("Schedule worker started");

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("Shutdown signal received", { signal });
  try { await stopAuditWorker(); } catch (err) { log.error("stopAuditWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopReportWorker(); } catch (err) { log.error("stopReportWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await stopScheduleWorker(); } catch (err) { log.error("stopScheduleWorker failed", err instanceof Error ? err : new Error(String(err))); }
  try { await closeRedis(); } catch (err) { log.error("closeRedis failed", err instanceof Error ? err : new Error(String(err))); }
  try { await pool.end(); } catch (err) { log.error("pool.end failed", err instanceof Error ? err : new Error(String(err))); }
  log.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT");  });

// Keep process alive — workers are event-driven, not request-driven.
setInterval(() => {}, 1 << 30);
