/**
 * Auto-Revert Worker
 * Phase 33: Auto-Fix System
 *
 * BullMQ worker that periodically checks rollback triggers and
 * automatically reverts changes when conditions are met.
 */
import { Worker, Queue, type Job } from 'bullmq';
import { redisConnection } from '~/server/redis';
import {
  evaluateTrigger,
  getEnabledTriggers,
  updateTriggerTimestamps,
} from '~/server/features/changes/services/TriggerService';
import { revertByScope } from '~/server/features/changes/services/RevertService';
import { getAdapterForConnection } from '~/server/features/connections/services/ConnectionService';
import { isWriteAdapter } from '~/server/features/connections/adapters/BaseAdapter';
import { db } from '~/db';
import { siteConnections } from '~/db/connection-schema';
import { eq, and } from 'drizzle-orm';

const QUEUE_NAME = 'auto-revert';

/**
 * Queue for auto-revert jobs.
 */
export const autoRevertQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

/**
 * Job data for auto-revert check.
 */
interface AutoRevertJobData {
  type: 'check_all_triggers' | 'check_client_triggers';
  clientId?: string;
}

/**
 * Result of processing auto-revert job.
 */
interface AutoRevertJobResult {
  triggersChecked: number;
  triggersFired: number;
  revertsExecuted: number;
  errors: string[];
}

/**
 * Process auto-revert jobs.
 */
async function processAutoRevertJob(job: Job<AutoRevertJobData>): Promise<AutoRevertJobResult> {
  const { type, clientId } = job.data;

  await job.log(`Starting auto-revert check: ${type}${clientId ? ` for client ${clientId}` : ''}`);

  // Get enabled triggers
  const triggers = await getEnabledTriggers(clientId);
  await job.log(`Found ${triggers.length} enabled triggers`);

  const result: AutoRevertJobResult = {
    triggersChecked: triggers.length,
    triggersFired: 0,
    revertsExecuted: 0,
    errors: [],
  };

  for (const trigger of triggers) {
    try {
      await job.log(`Evaluating trigger ${trigger.id} (${trigger.triggerType})`);

      // Evaluate the trigger
      const evaluation = await evaluateTrigger(trigger);

      // Update last check timestamp
      await updateTriggerTimestamps(trigger.id, evaluation.shouldFire);

      if (!evaluation.shouldFire) {
        await job.log(`Trigger ${trigger.id}: ${evaluation.reason}`);
        continue;
      }

      result.triggersFired++;
      await job.log(`Trigger ${trigger.id} FIRED: ${evaluation.reason}`);

      // Get connection for this client to get adapter
      const [connection] = await db
        .select()
        .from(siteConnections)
        .where(
          and(
            eq(siteConnections.clientId, trigger.clientId),
            eq(siteConnections.status, 'active')
          )
        )
        .limit(1);

      if (!connection) {
        result.errors.push(`No active connection for client ${trigger.clientId}`);
        await job.log(`No active connection for client ${trigger.clientId}`);
        continue;
      }

      // Get adapter
      const adapter = await getAdapterForConnection(connection.id);
      if (!adapter || !isWriteAdapter(adapter)) {
        result.errors.push(`No write adapter for connection ${connection.id}`);
        await job.log(`No write adapter for connection ${connection.id}`);
        continue;
      }

      // Execute revert
      if (evaluation.scope) {
        await job.log(`Executing revert with scope: ${JSON.stringify(evaluation.scope)}`);

        const revertResult = await revertByScope(adapter, evaluation.scope, 'cascade');

        if (revertResult.success) {
          result.revertsExecuted++;
          await job.log(
            `Revert successful: ${revertResult.revertedCount} changes reverted (batch: ${revertResult.revertBatchId})`
          );
        } else {
          result.errors.push(`Revert failed: ${revertResult.errors.map((e) => e.error).join(', ')}`);
          await job.log(`Revert failed: ${JSON.stringify(revertResult.errors)}`);
        }
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      result.errors.push(`Trigger ${trigger.id}: ${errorMessage}`);
      await job.log(`Error processing trigger ${trigger.id}: ${errorMessage}`);
    }
  }

  await job.log(
    `Auto-revert check complete: ${result.triggersChecked} checked, ${result.triggersFired} fired, ${result.revertsExecuted} executed, ${result.errors.length} errors`
  );

  return result;
}

/**
 * Create the auto-revert worker.
 */
export const autoRevertWorker = new Worker<AutoRevertJobData, AutoRevertJobResult>(
  QUEUE_NAME,
  processAutoRevertJob,
  {
    connection: redisConnection,
    concurrency: 1, // Only one auto-revert check at a time
    lockDuration: 5 * 60 * 1000, // 5 minutes
    stalledInterval: 60 * 1000, // Check for stalled jobs every minute
  }
);

// Event handlers
autoRevertWorker.on('completed', (job, result) => {
  console.log(`[auto-revert] Job ${job.id} completed:`, result);
});

autoRevertWorker.on('failed', (job, error) => {
  console.error(`[auto-revert] Job ${job?.id} failed:`, error.message);
});

autoRevertWorker.on('error', (error) => {
  console.error('[auto-revert] Worker error:', error);
});

/**
 * Schedule the auto-revert check to run every hour.
 */
export async function scheduleAutoRevertCheck(): Promise<void> {
  // Remove existing repeatable jobs
  const repeatableJobs = await autoRevertQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await autoRevertQueue.removeRepeatableByKey(job.key);
  }

  // Add new hourly job
  await autoRevertQueue.add(
    'hourly-check',
    { type: 'check_all_triggers' },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour on the hour
      },
      jobId: 'auto-revert-hourly',
    }
  );

  console.log('[auto-revert] Scheduled hourly trigger checks');
}

/**
 * Manually trigger a check for a specific client.
 */
export async function triggerClientCheck(clientId: string): Promise<string> {
  const job = await autoRevertQueue.add('manual-check', {
    type: 'check_client_triggers',
    clientId,
  });
  return job.id ?? '';
}

/**
 * Graceful shutdown for the worker.
 */
export async function shutdownAutoRevertWorker(): Promise<void> {
  await autoRevertWorker.close();
  await autoRevertQueue.close();
  console.log('[auto-revert] Worker shut down');
}
