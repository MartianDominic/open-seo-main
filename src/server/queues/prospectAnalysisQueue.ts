/**
 * BullMQ Queue definition for prospect analysis jobs.
 *
 * - `prospectAnalysisQueue` - primary queue for analysis jobs
 * - Jobs are submitted when user clicks "Analyze" button
 * - Rate limited to 10 analyses/day per workspace
 *
 * Job types:
 * - analyze-prospect: Run DataForSEO analysis on a prospect
 * - dlq:prospect-analysis: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "prospectAnalysisQueue" });

export const PROSPECT_ANALYSIS_QUEUE_NAME = "prospect-analysis" as const;

/**
 * Analysis types available for prospects.
 */
export type ProspectAnalysisType = "quick_scan" | "deep_dive" | "opportunity_discovery";

/**
 * Job data for prospect analysis.
 */
export interface ProspectAnalysisJobData {
  prospectId: string;
  workspaceId: string;
  analysisType: ProspectAnalysisType;
  analysisId: string; // ID of the prospect_analyses record
  targetRegion?: string; // e.g., "US", "UK", "EU"
  targetLanguage?: string; // e.g., "en", "de"
  triggeredAt: string; // ISO timestamp
  triggeredBy: string; // User ID who triggered
}

/**
 * Dead-letter queue job data for failed analysis jobs.
 */
export interface ProspectAnalysisDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: ProspectAnalysisJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * 3 attempts with exponential backoff (10s, 20s, 40s).
 * Longer backoff than ranking since analysis involves multiple API calls.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

/**
 * Prospect analysis queue.
 * Uses shared BullMQ connection for Redis.
 */
export const prospectAnalysisQueue = new Queue<
  ProspectAnalysisJobData | ProspectAnalysisDLQJobData
>(PROSPECT_ANALYSIS_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:prospect-analysis"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Submit a prospect analysis job.
 * Job ID uses prospectId + timestamp to prevent exact duplicates.
 */
export async function submitProspectAnalysis(
  data: ProspectAnalysisJobData,
): Promise<string> {
  const jobId = `prospect-${data.prospectId}-${Date.now()}`;

  await prospectAnalysisQueue.add("analyze-prospect", data, {
    jobId,
  });

  log.info("Prospect analysis job submitted", {
    jobId,
    prospectId: data.prospectId,
    analysisType: data.analysisType,
  });

  return jobId;
}

/**
 * Get count of analyses run today for a workspace.
 * Used for rate limiting (max 10/day).
 */
export async function getWorkspaceAnalysisCountToday(
  workspaceId: string,
): Promise<number> {
  // Get all completed and active jobs from today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTimestamp = startOfDay.getTime();

  const [completed, active, waiting] = await Promise.all([
    prospectAnalysisQueue.getCompleted(0, 1000),
    prospectAnalysisQueue.getActive(0, 100),
    prospectAnalysisQueue.getWaiting(0, 100),
  ]);

  let count = 0;

  // Count completed jobs from today for this workspace
  for (const job of completed) {
    if (
      job.data &&
      "workspaceId" in job.data &&
      job.data.workspaceId === workspaceId &&
      job.finishedOn &&
      job.finishedOn >= startTimestamp
    ) {
      count++;
    }
  }

  // Count active jobs for this workspace
  for (const job of active) {
    if (
      job.data &&
      "workspaceId" in job.data &&
      job.data.workspaceId === workspaceId
    ) {
      count++;
    }
  }

  // Count waiting jobs for this workspace
  for (const job of waiting) {
    if (
      job.data &&
      "workspaceId" in job.data &&
      job.data.workspaceId === workspaceId
    ) {
      count++;
    }
  }

  return count;
}
