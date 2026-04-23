import type { PhaseNode, ExecutionOrder } from "./types";
import { PipelineError } from "./types";

/**
 * Resolve phase execution order using Kahn's algorithm (topological sort).
 * Returns phases in dependency-respecting order with wave assignments for parallelism.
 */
export function resolveExecutionOrder(phases: PhaseNode[]): ExecutionOrder {
  // Stub implementation - will fail tests
  throw new PipelineError("Not implemented", "NOT_IMPLEMENTED");
}
