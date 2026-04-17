/**
 * Sandboxed BullMQ processor for site-audit jobs.
 *
 * Runs in a child process (spawned by BullMQ when the Worker is configured with
 * a path string instead of an inline function) so Lighthouse's heavy Node-internal
 * work cannot stall the main event loop — satisfies BQ-04.
 *
 * The processor reuses Phase-2 runAuditPhases() verbatim by providing a
 * BullMQ-backed WorkflowStep adapter that persists `job.data.step` before each
 * named step, enabling step-level resume on retry.
 */
import type { Job } from "bullmq";
import type { AuditJobData } from "@/server/queues/auditQueue";
import { AUDIT_STEP } from "@/server/queues/auditQueue";
import type { WorkflowStep } from "@/server/workflows/workflow-types";
import { runAuditPhases } from "@/server/workflows/siteAuditWorkflowPhases";

/**
 * Map each named step in Phase-2 code to an AUDIT_STEP enum value.
 * Unknown names fall through without updating job.data.step (safe default).
 */
function mapNameToStep(name: string): AuditJobData["step"] | null {
  if (name === "discover-urls") return AUDIT_STEP.DISCOVER;
  if (
    name.startsWith("crawl-batch-") ||
    name.startsWith("kv-progress-batch-") ||
    name.startsWith("progress-batch-")
  )
    return AUDIT_STEP.CRAWL;
  if (name === "select-lighthouse-sample") return AUDIT_STEP.LIGHTHOUSE_SELECT;
  if (
    name.startsWith("lighthouse-batch-") ||
    name.startsWith("lighthouse-progress-batch-")
  )
    return AUDIT_STEP.LIGHTHOUSE_RUN;
  if (name === "finalize") return AUDIT_STEP.FINALIZE;
  return null;
}

/**
 * Build a WorkflowStep adapter whose .do() persists step-enum progress
 * (via job.updateData) before invoking fn. BullMQ itself handles retry —
 * on retry the processor starts fresh, but runAuditPhases is idempotent
 * per step (DB upserts, Redis set/del) so re-running a completed step
 * is safe. The enum in job.data.step exposes progress to observers.
 */
function buildStep(job: Job<AuditJobData>): WorkflowStep {
  return {
    async do(name, fn) {
      const nextStep = mapNameToStep(name);
      if (nextStep && nextStep !== job.data.step) {
        await job.updateData({ ...job.data, step: nextStep });
      }
      return fn();
    },
  };
}

export default async function processAuditJob(
  job: Job<AuditJobData>,
): Promise<void> {
  const { auditId, projectId, startUrl, config, billingCustomer } = job.data;
  const step = buildStep(job);
  await runAuditPhases(step, {
    auditId,
    // Phase 2 uses workflowInstanceId for audit progress writes. We reuse the
    // BullMQ jobId (which we set to auditId in Plan 04 for deduplication).
    workflowInstanceId: job.id ?? auditId,
    billingCustomer,
    projectId,
    startUrl,
    config,
  });
}
