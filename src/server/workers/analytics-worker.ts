/**
 * BullMQ Worker for analytics sync jobs.
 *
 * Wires:
 *   - Dedicated Redis connection via createRedisConnection()
 *   - lockDuration: 120_000 (BQ-05)
 *   - maxStalledCount: 2 (BQ-06)
 *   - Sandboxed processor via file path
 *   - concurrency: 5 (respect Google API rate limits)
 *   - Graceful shutdown with 25s timeout
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { createRedisConnection } from "@/server/lib/redis";
import {
  ANALYTICS_QUEUE_NAME,
  initAnalyticsScheduler,
  type AnalyticsSyncJobData,
  type SyncAllClientsJobData,
} from "@/server/queues/analyticsQueue";

const LOCK_DURATION_MS = 120_000; // BQ-05
const MAX_STALLED_COUNT = 2; // BQ-06
const SHUTDOWN_TIMEOUT_MS = 25_000; // BQ-06

// URL-based resolution works in both Node ESM and in the built Nitro output.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./analytics-processor.js", import.meta.url),
);

let worker: Worker<AnalyticsSyncJobData | SyncAllClientsJobData> | null = null;

export async function startAnalyticsWorker(): Promise<
  Worker<AnalyticsSyncJobData | SyncAllClientsJobData>
> {
  if (worker) return worker;

  // Initialize the nightly scheduler first
  await initAnalyticsScheduler();

  worker = new Worker<AnalyticsSyncJobData | SyncAllClientsJobData>(
    ANALYTICS_QUEUE_NAME,
    PROCESSOR_PATH, // Sandboxed processor
    {
      connection: createRedisConnection(),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 5, // Lower than audit to respect Google API rate limits
    },
  );

  worker.on("ready", () => {
    console.log(`[analytics-worker] ready - consuming ${ANALYTICS_QUEUE_NAME}`);
  });

  worker.on("error", (err) => {
    console.error("[analytics-worker] error:", err);
  });

  worker.on(
    "failed",
    (
      job: Job<AnalyticsSyncJobData | SyncAllClientsJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        console.error("[analytics-worker] failed with no job context:", err);
        return;
      }
      const maxAttempts = job.opts.attempts ?? 1;
      console.error(
        `[analytics-worker] job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}):`,
        err.message,
      );
    },
  );

  worker.on("completed", (job) => {
    console.log(`[analytics-worker] job ${job.id} completed`);
  });

  return worker;
}

export async function stopAnalyticsWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    console.error(
      `[analytics-worker] graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms - forcing close`,
    );
    await current.close(true);
  }
}
