/**
 * Prospects components
 * Phase 28: Keyword Gap Analysis UI
 */
export { DifficultyBadge, getDifficultyLevel, getDifficultyConfig } from "./DifficultyBadge";
export type { DifficultyLevel } from "./DifficultyBadge";

export {
  KeywordGapTable,
  sortKeywordGaps,
  calculateGapSummary,
} from "./KeywordGapTable";
export type { SortColumn, SortDirection, GapSummary } from "./KeywordGapTable";

export { GapSummaryCard } from "./GapSummaryCard";
export { KeywordGapsTab } from "./KeywordGapsTab";
