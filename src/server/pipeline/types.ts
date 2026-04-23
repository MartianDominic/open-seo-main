/**
 * Core pipeline types.
 */

export interface PipelineState {
  status: "idle" | "running" | "paused" | "error";
  currentPhase: number | null;
  lastCompletedPhase: number | null;
  lastCompletedPlan: string | null;
  startedAt: string | null;
  updatedAt: string;
}

export class PipelineError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "PipelineError";
  }
}
