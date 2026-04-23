/**
 * Voice feature barrel export.
 * Phase 37: Brand Voice Management
 */

// Types
export type {
  ExtractedVoiceDimensions,
  VoiceExtractionResult,
  VoiceAnalysisJobData,
  VoiceAnalysisProgress,
  VoiceAnalysisDLQJobData,
} from "./types";

// Services
export { analyzePageVoice, aggregateVoiceResults, buildVoicePrompt } from "./services/VoiceAnalyzer";
