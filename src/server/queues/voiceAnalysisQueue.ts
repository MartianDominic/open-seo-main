/**
 * BullMQ Queue for voice analysis jobs.
 * Phase 37: Brand Voice Management
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import type { VoiceAnalysisJobData, VoiceAnalysisDLQJobData } from "@/server/features/voice/types";

const log = createLogger({ module: "voiceAnalysisQueue" });

export const VOICE_ANALYSIS_QUEUE_NAME = "voice-analysis" as const;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 15_000, // 15s, 30s, 60s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const voiceAnalysisQueue = new Queue<VoiceAnalysisJobData | VoiceAnalysisDLQJobData>(
  VOICE_ANALYSIS_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:voice-analysis"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Queue a voice analysis job for a client.
 * Rate limited: max 1 concurrent analysis job per client.
 *
 * @param clientId - Client ID
 * @param profileId - Voice profile ID
 * @param urls - URLs to analyze (5-10 pages recommended)
 * @returns Job ID
 */
export async function queueVoiceAnalysis(
  clientId: string,
  profileId: string,
  urls: string[],
): Promise<string> {
  // T-37-05: Rate limit - max 1 concurrent job per client
  const existingJobs = await voiceAnalysisQueue.getJobs(["active", "waiting"]);
  const hasActiveJob = existingJobs.some(
    (job) => (job.data as VoiceAnalysisJobData).clientId === clientId,
  );

  if (hasActiveJob) {
    log.warn("Voice analysis already in progress for client", { clientId });
    throw new Error(`Voice analysis already in progress for client ${clientId}`);
  }

  const job = await voiceAnalysisQueue.add(
    "analyze-voice",
    { clientId, profileId, urls },
    {
      jobId: `voice-${clientId}-${Date.now()}`,
    },
  );

  log.info("Voice analysis job queued", {
    clientId,
    profileId,
    urlCount: urls.length,
    jobId: job.id,
  });

  return job.id!;
}
