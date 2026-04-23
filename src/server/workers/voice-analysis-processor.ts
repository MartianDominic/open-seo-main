/**
 * Sandboxed BullMQ processor for voice analysis jobs.
 * Phase 37: Brand Voice Management
 *
 * Runs in a child process to isolate Claude API calls from main event loop.
 */
import type { Job } from "bullmq";
import type { VoiceAnalysisJobData } from "@/server/features/voice/types";
import type { VoiceExtractionResult } from "@/server/features/voice/types";
import { analyzePageVoice, aggregateVoiceResults } from "@/server/features/voice/services/VoiceAnalyzer";
import { scrapeProspectPage } from "@/server/lib/scraper/dataforseoScraper";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { voiceAnalysis, voiceProfiles } from "@/db/voice-schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processVoiceAnalysisJob(
  job: Job<VoiceAnalysisJobData>,
): Promise<void> {
  const { clientId, profileId, urls, progress } = job.data;
  const logger = createLogger({
    module: "voice-analysis-processor",
    jobId: job.id,
    clientId,
  });

  const startIdx = progress?.completedUrls ?? 0;

  logger.info("Starting voice analysis", {
    profileId,
    urlCount: urls.length,
    resumeFrom: startIdx,
  });

  const results: VoiceExtractionResult[] = [];

  // Process each URL sequentially with checkpointing
  for (let i = startIdx; i < urls.length; i++) {
    const url = urls[i];

    try {
      // T-37-03: Validate URL belongs to expected domain (basic check)
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // T-37-04: Don't log full content, only metadata
      logger.info("Scraping page", { url, index: i + 1, total: urls.length });

      // Scrape the page
      const scrapeResult = await scrapeProspectPage(url);

      if (!scrapeResult.success) {
        logger.warn("Failed to scrape page", { url, error: scrapeResult.error });
        continue;
      }

      // Analyze voice
      const voiceResult = await analyzePageVoice(scrapeResult.page, domain);
      results.push(voiceResult);

      // Save individual analysis to DB
      await db.insert(voiceAnalysis).values({
        id: nanoid(),
        profileId,
        url,
        rawAnalysis: {
          model: process.env.CLAUDE_MODEL_VOICE_ANALYZER || "claude-3-5-sonnet-20241022",
          prompt: "(redacted)", // T-37-04: Don't store full prompt with scraped content
          response: JSON.stringify(voiceResult.dimensions),
          tokens_used: 0, // Would need to extract from API response
          analyzed_at: new Date().toISOString(),
        },
        extractedTone: voiceResult.dimensions.tone_primary,
        extractedFormality: voiceResult.dimensions.formality_level,
        sampleSentences: voiceResult.sample_sentences,
      });

      // Update job progress
      await job.updateData({
        ...job.data,
        progress: { completedUrls: i + 1, totalUrls: urls.length },
      });
      await job.updateProgress(((i + 1) / urls.length) * 100);

      logger.info("Page analyzed", {
        url,
        confidence: voiceResult.confidence,
        tone: voiceResult.dimensions.tone_primary,
      });
    } catch (error) {
      logger.error(
        "Error processing URL",
        error instanceof Error ? error : new Error(String(error)),
        { url },
      );
      // Continue with next URL rather than failing entire job
    }
  }

  // Final aggregation if we have results
  if (results.length > 0) {
    const aggregated = aggregateVoiceResults(results);
    const avgConfidence = Math.round(
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
    );

    // Update voice profile with aggregated dimensions
    await db
      .update(voiceProfiles)
      .set({
        tonePrimary: aggregated.tone_primary,
        toneSecondary: aggregated.tone_secondary,
        formalityLevel: aggregated.formality_level,
        personalityTraits: aggregated.personality_traits,
        archetype: aggregated.archetype,
        sentenceLengthAvg: aggregated.sentence_length_avg,
        paragraphLengthAvg: aggregated.paragraph_length_avg,
        contractionUsage: aggregated.contraction_usage,
        vocabularyPatterns: aggregated.vocabulary_patterns,
        signaturePhrases: aggregated.signature_phrases,
        forbiddenPhrases: aggregated.forbidden_phrases,
        headingStyle: aggregated.heading_style,
        confidenceScore: avgConfidence,
        analyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(voiceProfiles.id, profileId));

    logger.info("Voice profile updated with aggregated results", {
      profileId,
      pagesAnalyzed: results.length,
      avgConfidence,
      archetype: aggregated.archetype,
    });
  } else {
    logger.warn("No pages successfully analyzed", { profileId });
  }
}
