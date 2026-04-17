/**
 * BullMQ Worker for site audits.
 *
 * Wires:
 *   - Dedicated Redis connection (BQ-03) via createRedisConnection()
 *   - lockDuration: 120_000 (BQ-05)
 *   - maxStalledCount: 2 (BQ-06)
 *   - Sandboxed processor via file path (BQ-04) — audit-processor.ts runs in child process
 *   - on("failed") handler that, when attemptsMade === attempts, enqueues a
 *     FailedAuditJobData to the `failed-audits` DLQ (BQ-07)
 *   - Graceful shutdown: stopAuditWorker() awaits up to 25s for in-flight jobs (BQ-06)
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { createRedisConnection } from "@/server/lib/redis";
import {
  AUDIT_QUEUE_NAME,
  failedAuditsQueue,
  type AuditJobData,
  type FailedAuditJobData,
} from "@/server/queues/auditQueue";

const LOCK_DURATION_MS = 120_000; // BQ-05
const MAX_STALLED_COUNT = 2; // BQ-06
const SHUTDOWN_TIMEOUT_MS = 25_000; // BQ-06

// URL-based resolution works in both Node ESM and in the built Nitro output.
// BullMQ accepts either a path string or a URL object as the processor arg.
const PROCESSOR_PATH = fileURLToPath(
  new URL("./audit-processor.js", import.meta.url),
);

let worker: Worker<AuditJobData> | null = null;

export function startAuditWorker(): Worker<AuditJobData> {
  if (worker) return worker;

  worker = new Worker<AuditJobData>(
    AUDIT_QUEUE_NAME,
    PROCESSOR_PATH, // Sandboxed processor — runs in child process (BQ-04)
    {
      connection: createRedisConnection(), // Dedicated connection (BQ-03)
      lockDuration: LOCK_DURATION_MS, // BQ-05
      maxStalledCount: MAX_STALLED_COUNT, // BQ-06
      concurrency: 2,
    },
  );

  worker.on("ready", () => {
    console.log(`[audit-worker] ready — consuming ${AUDIT_QUEUE_NAME}`);
  });

  worker.on("error", (err) => {
    console.error("[audit-worker] error:", err);
  });

  worker.on(
    "failed",
    async (job: Job<AuditJobData> | undefined, err: Error) => {
      if (!job) {
        console.error("[audit-worker] failed with no job context:", err);
        return;
      }
      const maxAttempts = job.opts.attempts ?? 1;
      console.error(
        `[audit-worker] job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}):`,
        err.message,
      );
      // Only enqueue DLQ when retries are exhausted (BQ-07)
      if (job.attemptsMade >= maxAttempts) {
        const dlqPayload: FailedAuditJobData = {
          auditId: job.data.auditId,
          projectId: job.data.projectId,
          originalJobId: String(job.id ?? job.data.auditId),
          failedAt: Date.now(),
          error: err.message,
          attemptsMade: job.attemptsMade,
        };
        try {
          await failedAuditsQueue.add(`dlq-${job.data.auditId}`, dlqPayload);
        } catch (dlqErr) {
          console.error("[audit-worker] failed to enqueue DLQ job:", dlqErr);
        }
      }
    },
  );

  worker.on("completed", (job) => {
    console.log(`[audit-worker] job ${job.id} completed`);
  });

  return worker;
}

export async function stopAuditWorker(): Promise<void> {
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
      `[audit-worker] graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms — forcing close`,
    );
    await current.close(true); // force
  }
}
