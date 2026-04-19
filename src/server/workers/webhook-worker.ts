/**
 * Webhook delivery worker.
 * Phase 18.5: Processes webhook delivery queue.
 */
import { Worker, type Processor } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import type { WebhookDeliveryJobData } from "@/server/queues/webhookQueue";

const log = createLogger({ module: "webhook-worker" });

let webhookWorker: Worker<WebhookDeliveryJobData> | null = null;

/**
 * Start the webhook delivery worker.
 */
export async function startWebhookWorker(): Promise<void> {
  if (webhookWorker) {
    log.warn("Webhook worker already running");
    return;
  }

  const processorPath = new URL("./webhook-processor.ts", import.meta.url)
    .pathname;

  webhookWorker = new Worker<WebhookDeliveryJobData>(
    "webhook-delivery",
    processorPath as unknown as Processor<WebhookDeliveryJobData>,
    {
      connection: getSharedBullMQConnection("worker:webhook"),
      concurrency: 5,
      lockDuration: 60000, // 1 minute lock
      maxStalledCount: 2,
    },
  );

  webhookWorker.on("ready", () => {
    log.info("Webhook worker ready");
  });

  webhookWorker.on("completed", (job, result) => {
    log.info("Webhook job completed", {
      jobId: job.id,
      deliveryId: job.data.deliveryId,
      delivered: result?.delivered,
    });
  });

  webhookWorker.on("failed", (job, err) => {
    log.warn("Webhook job failed", {
      jobId: job?.id,
      deliveryId: job?.data.deliveryId,
      attempt: job?.attemptsMade,
      error: err.message,
    });
  });

  webhookWorker.on("error", (err) => {
    log.error("Webhook worker error", err);
  });

  log.info("Webhook worker started");
}

/**
 * Stop the webhook worker gracefully.
 */
export async function stopWebhookWorker(): Promise<void> {
  if (!webhookWorker) {
    return;
  }

  log.info("Stopping webhook worker...");

  try {
    await webhookWorker.close();
    webhookWorker = null;
    log.info("Webhook worker stopped");
  } catch (err) {
    log.error(
      "Error stopping webhook worker",
      err instanceof Error ? err : new Error(String(err)),
    );
  }
}

/**
 * Check if webhook worker is running.
 */
export function isWebhookWorkerRunning(): boolean {
  return webhookWorker !== null;
}
