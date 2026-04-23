/**
 * Internal linking analysis module.
 * Phase 35-01: Link Graph Schema + Extraction
 *
 * Provides link extraction, graph building, and orphan detection
 * for internal linking analysis.
 */

// Types
export type {
  DetailedLink,
  UrlToPageMap,
  ExtractLinksOptions,
  ExtractLinksResult,
} from "./types";

// Link extraction
export {
  extractDetailedLinks,
  classifyLinkPosition,
  getParagraphIndex,
  extractContext,
} from "./link-extractor";

// Graph building
export type {
  PageData,
  BuildLinkGraphParams,
  BuildLinkGraphResult,
  ComputePageMetricsParams,
  DetectOrphanPagesParams,
} from "./graph-builder";

export {
  buildLinkGraph,
  createLinkGraphEntry,
  aggregateInboundMetrics,
  aggregateOutboundMetrics,
  computePageLinkMetrics,
  detectOrphanPages,
} from "./graph-builder";
