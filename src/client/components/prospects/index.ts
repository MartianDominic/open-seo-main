/**
 * Prospects components
 * Phase 28: Keyword Gap Analysis UI
 * Phase 29: AI Opportunity Discovery UI
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

// Phase 29: AI Opportunity Discovery
export {
  OpportunityKeywordsTable,
  sortOpportunityKeywords,
  filterByCategory,
  calculateOpportunitySummary,
} from "./OpportunityKeywordsTable";
export type {
  OpportunitySortColumn,
  OpportunitySummary,
} from "./OpportunityKeywordsTable";

export { OpportunitySummaryCard } from "./OpportunitySummaryCard";
export { OpportunityKeywordsTab } from "./OpportunityKeywordsTab";
