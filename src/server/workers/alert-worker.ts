/**
 * BullMQ worker for alert processing.
 * Phase 18: Monitoring & Alerts
 */
import { Worker } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  ALERT_QUEUE_NAME,
  initAlertScheduler,
  closeAlertQueue,
  type AlertJobData,
} from "@/server/queues/alertQueue";
import processor from "./alert-processor";

const log = createLogger({ module: "alert-worker" });

let alertWorker: Worker<AlertJobData> | null = null;

/**
 * Start the alert worker.
 */
export async function startAlertWorker(): Promise<void> {
  if (alertWorker) {
    log.warn("Alert worker already running");
    return;
  }

  // Initialize the scheduler for repeatable jobs
  await initAlertScheduler();

  alertWorker = new Worker<AlertJobData>(
    ALERT_QUEUE_NAME,
    processor,
    {
      connection: getSharedBullMQConnection("worker:alert"),
      lockDuration: 60_000, // 1 minute
      maxStalledCount: 2,
      concurrency: 1,
    },
  );

  alertWorker.on("completed", (job, result) => {
    log.info("Alert job completed", {
      jobId: job.id,
      type: job.data.type,
      alertsCreated: result?.alertsCreated?.length ?? 0,
    });
  });

  alertWorker.on("failed", (job, err) => {
    log.error("Alert job failed", err, {
      jobId: job?.id,
      type: job?.data.type,
    });
  });

  alertWorker.on("error", (err) => {
    log.error("Alert worker error", err);
  });

  log.info("Alert worker started");
}

/**
 * Stop the alert worker gracefully.
 */
export async function stopAlertWorker(): Promise<void> {
  if (alertWorker) {
    await alertWorker.close();
    alertWorker = null;
    log.info("Alert worker stopped");
  }

  await closeAlertQueue();
}
