/**
 * Worker exports for startup registration.
 * Phase 22: Goal-Based Metrics System
 */

export { goalWorker } from "./goal-processor";
export { initGoalProcessingScheduler } from "@/server/queues/goalQueue";
