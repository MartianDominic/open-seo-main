/**
 * Sandboxed processor for keyword ranking checks.
 *
 * Queries all tracking-enabled keywords, fetches SERP data from DataForSEO,
 * and stores daily position snapshots.
 */

import type { Job } from "bullmq";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { savedKeywords, projects } from "@/db/app.schema";
import { keywordRankings } from "@/db/ranking-schema";
import { fetchLiveSerpItemsRaw, type SerpLiveItem } from "@/server/lib/dataforseo";
import { createLogger } from "@/server/lib/logger";
import type { RankingJobData } from "@/server/queues/rankingQueue";
import { recordDropEvent } from "@/services/rank-events";

const log = createLogger({ module: "ranking-processor" });

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY_MS = 100; // 100ms between API calls to respect rate limits

/**
 * Extract position from SERP results for a target domain.
 * Returns 0 if not ranking in top 100.
 */
function extractPosition(
  items: SerpLiveItem[],
  targetDomain: string | null,
): { position: number; url: string | null } {
  if (!targetDomain) {
    // No domain set on project, return first organic result position
    const firstOrganic = items.find((item) => item.type === "organic");
    return {
      position: firstOrganic?.rank_absolute ?? 0,
      url: firstOrganic?.url ?? null,
    };
  }

  // Find organic result matching project domain
  const matchingResult = items.find(
    (item) =>
      item.type === "organic" &&
      item.domain?.includes(targetDomain),
  );

  return {
    position: matchingResult?.rank_absolute ?? 0,
    url: matchingResult?.url ?? null,
  };
}

/**
 * Extract SERP features present in results.
 */
function extractSerpFeatures(items: SerpLiveItem[]): string[] {
  const features = new Set<string>();
  for (const item of items) {
    if (item.type && item.type !== "organic" && item.type !== "paid") {
      features.add(item.type);
    }
  }
  return Array.from(features);
}

/**
 * Sleep utility for rate limiting.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get previous position for a keyword (most recent ranking).
 */
async function getPreviousPosition(keywordId: string): Promise<number | null> {
  const [lastRanking] = await db
    .select({ position: keywordRankings.position })
    .from(keywordRankings)
    .where(eq(keywordRankings.keywordId, keywordId))
    .orderBy(desc(keywordRankings.date))
    .limit(1);

  return lastRanking?.position ?? null;
}

/**
 * Process a batch of keywords.
 */
async function processBatch(
  keywords: Array<{
    id: string;
    keyword: string;
    locationCode: number;
    languageCode: string;
    projectDomain: string | null;
    projectId: string;
    clientId: string | null;
    dropAlertThreshold: number | null;
  }>,
  today: Date,
): Promise<{ success: number; failed: number; drops: number }> {
  let success = 0;
  let failed = 0;
  let drops = 0;

  for (const kw of keywords) {
    try {
      // Fetch SERP data from DataForSEO
      const response = await fetchLiveSerpItemsRaw(
        kw.keyword,
        kw.locationCode,
        kw.languageCode,
      );

      const items = response.data;
      const { position, url } = extractPosition(items, kw.projectDomain);
      const serpFeatures = extractSerpFeatures(items);
      const previousPosition = await getPreviousPosition(kw.id);

      // Insert ranking record
      await db.insert(keywordRankings).values({
        id: crypto.randomUUID(),
        keywordId: kw.id,
        position,
        previousPosition,
        url,
        date: today,
        serpFeatures,
      });

      // Check for rank drop and record event if threshold exceeded
      const threshold = kw.dropAlertThreshold ?? 5;
      if (previousPosition !== null && position > 0 && previousPosition > 0) {
        const dropAmount = position - previousPosition;
        if (dropAmount >= threshold) {
          await recordDropEvent({
            keywordId: kw.id,
            projectId: kw.projectId,
            clientId: kw.clientId,
            keyword: kw.keyword,
            previousPosition,
            currentPosition: position,
            dropAmount,
            threshold,
          });
          drops++;
          log.warn("Rank drop detected", {
            keywordId: kw.id,
            keyword: kw.keyword,
            previousPosition,
            currentPosition: position,
            dropAmount,
            threshold,
          });
        }
      }

      success++;
      log.info("Ranking recorded", {
        keywordId: kw.id,
        keyword: kw.keyword,
        position,
        previousPosition,
      });
    } catch (error) {
      failed++;
      log.error("Failed to check ranking", error instanceof Error ? error : new Error(String(error)), {
        keywordId: kw.id,
        keyword: kw.keyword,
      });
    }

    // Rate limiting delay
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  return { success, failed, drops };
}

/**
 * Main processor function for ranking checks.
 */
export default async function processor(job: Job<RankingJobData>): Promise<void> {
  const jobLogger = createLogger({ module: "ranking-processor", jobId: job.id });
  jobLogger.info("Starting ranking check", { triggeredAt: job.data.triggeredAt });

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let offset = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalDrops = 0;

  // Process in batches
  while (true) {
    // Query tracking-enabled keywords with project domain and alert config
    const keywords = await db
      .select({
        id: savedKeywords.id,
        keyword: savedKeywords.keyword,
        locationCode: savedKeywords.locationCode,
        languageCode: savedKeywords.languageCode,
        projectDomain: projects.domain,
        projectId: savedKeywords.projectId,
        clientId: projects.organizationId, // organizationId maps to clientId
        dropAlertThreshold: savedKeywords.dropAlertThreshold,
      })
      .from(savedKeywords)
      .innerJoin(projects, eq(savedKeywords.projectId, projects.id))
      .where(eq(savedKeywords.trackingEnabled, true))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (keywords.length === 0) {
      break;
    }

    const { success, failed, drops } = await processBatch(keywords, today);
    totalSuccess += success;
    totalFailed += failed;
    totalDrops += drops;
    offset += BATCH_SIZE;

    jobLogger.info("Batch completed", {
      batchSize: keywords.length,
      success,
      failed,
      drops,
      totalProcessed: offset,
    });
  }

  jobLogger.info("Ranking check completed", {
    totalSuccess,
    totalFailed,
    totalDrops,
    totalProcessed: totalSuccess + totalFailed,
  });
}
