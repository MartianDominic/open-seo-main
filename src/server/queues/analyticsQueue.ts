/**
 * BullMQ Queue definitions for the analytics sync system.
 *
 * - `analyticsQueue` - primary queue for analytics sync jobs
 * - `initAnalyticsScheduler` - sets up nightly cron via upsertJobScheduler
 *
 * Job types:
 * - sync-all-clients: Master job that fans out to per-client jobs
 * - sync-client-analytics: Per-client sync (GSC + GA4)
 */

import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@/server/lib/redis";

export const ANALYTICS_QUEUE_NAME = "analytics-sync" as const;

export interface AnalyticsSyncJobData {
  clientId: string;
  provider: "google";
  mode: "incremental" | "backfill";
}

export interface SyncAllClientsJobData {
  mode: "incremental" | "backfill";
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const analyticsQueue = new Queue<
  AnalyticsSyncJobData | SyncAllClientsJobData
>(ANALYTICS_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize the nightly analytics sync scheduler.
 * Uses upsertJobScheduler for idempotent cron setup.
 * Call once on worker startup.
 */
export async function initAnalyticsScheduler(): Promise<void> {
  await analyticsQueue.upsertJobScheduler(
    "nightly-analytics-sync",
    { pattern: "0 2 * * *" }, // 02:00 UTC daily
    {
      name: "sync-all-clients",
      data: { mode: "incremental" },
      opts: {
        attempts: 1, // Master job spawns per-client jobs
        removeOnComplete: { count: 30 },
      },
    },
  );
  console.log("[analyticsQueue] Nightly scheduler initialized (02:00 UTC)");
}

/**
 * Queue a backfill job for a single client.
 * Called from OAuth callback when a new connection is established.
 */
export async function queueBackfillJob(clientId: string): Promise<void> {
  await analyticsQueue.add(
    "sync-client-analytics",
    {
      clientId,
      provider: "google",
      mode: "backfill",
    },
    {
      jobId: `backfill-${clientId}-${Date.now()}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
    },
  );
  console.log(`[analyticsQueue] Backfill job queued for client ${clientId}`);
}
