/**
 * BullMQ Queue definition for daily keyword ranking checks.
 *
 * - `rankingQueue` - primary queue for ranking jobs
 * - Runs daily at 03:00 UTC to check all tracking-enabled keywords
 *
 * Job types:
 * - check-keyword-rankings: Process all keywords needing rank checks
 * - dlq:keyword-ranking: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "rankingQueue" });

export const RANKING_QUEUE_NAME = "keyword-ranking" as const;

/**
 * Job data for ranking check.
 */
export interface RankingJobData {
  triggeredAt: string; // ISO timestamp
}

/**
 * Dead-letter queue job data for failed ranking jobs.
 */
export interface RankingDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: RankingJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * 3 attempts with exponential backoff.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

/**
 * Ranking queue.
 * Uses shared BullMQ connection for Redis.
 */
export const rankingQueue = new Queue<RankingJobData | RankingDLQJobData>(
  RANKING_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:ranking"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Initialize the ranking queue with a repeatable job.
 * Runs daily at 03:00 UTC to check keyword rankings.
 */
export async function initRankingScheduler(): Promise<void> {
  // Remove any existing repeatable jobs first to avoid duplicates
  const repeatableJobs = await rankingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await rankingQueue.removeRepeatableByKey(job.key);
  }

  // Add repeatable job that runs daily at 03:00 UTC
  await rankingQueue.add(
    "check-keyword-rankings",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "0 3 * * *", // 03:00 UTC daily
      },
      jobId: "ranking-check",
    },
  );

  log.info("Ranking queue initialized with daily repeatable job at 03:00 UTC");
}

/**
 * Manually trigger a ranking check.
 * Useful for testing or immediate ranking updates.
 */
export async function triggerRankingCheck(): Promise<void> {
  await rankingQueue.add(
    "check-keyword-rankings",
    { triggeredAt: new Date().toISOString() },
    {
      jobId: `manual-ranking-${Date.now()}`,
    },
  );
  log.info("Manual ranking check triggered");
}
