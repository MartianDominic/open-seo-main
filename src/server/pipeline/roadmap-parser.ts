import type { PhaseNode } from "./types";
import { PipelineError } from "./types";

/**
 * Parse ROADMAP.md content into an array of PhaseNode objects.
 * Extracts phase number, name, dependencies, requirements, status, and plan count.
 */
export function parseRoadmap(content: string): PhaseNode[] {
  // Stub implementation - will fail tests
  throw new PipelineError("Not implemented", "NOT_IMPLEMENTED");
}
