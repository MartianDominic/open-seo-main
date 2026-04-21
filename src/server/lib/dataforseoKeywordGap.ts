/**
 * DataForSEO API wrappers for keyword gap analysis.
 * Phase 28: Keyword Gap Analysis
 *
 * This module provides the domain intersection endpoint to identify keywords
 * where competitors rank but the target domain doesn't - keyword gaps.
 *
 * Endpoint: /v3/dataforseo_labs/google/domain_intersection/live
 * Cost: ~$0.02-0.05 per request
 */
import type { DataforseoApiResponse } from "@/server/lib/dataforseoCost";
import { AppError } from "@/server/lib/errors";
import {
  dataforseoResponseSchema,
  domainIntersectionItemSchema,
  type DomainIntersectionItem,
} from "@/server/lib/dataforseoSchemas";
import type { KeywordGap } from "@/db/prospect-schema";

// ---------------------------------------------------------------------------
// SDK client (reuse auth pattern from dataforseoProspect.ts)
// ---------------------------------------------------------------------------

const API_BASE = "https://api.dataforseo.com";

function createAuthenticatedFetch() {
  return (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set(
      "Authorization",
      `Basic ${process.env.DATAFORSEO_API_KEY ?? ""}`,
    );

    const newInit: RequestInit = {
      ...init,
      headers,
    };
    return fetch(url, newInit);
  };
}

async function postDataforseo(
  path: string,
  payload: unknown,
): Promise<unknown> {
  const authenticatedFetch = createAuthenticatedFetch();
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO HTTP ${response.status} on ${path}. Response: ${rawText.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO ${path} returned non-JSON response`,
    );
  }
}

// ---------------------------------------------------------------------------
// Response helpers (reuse pattern from dataforseoProspect.ts)
// ---------------------------------------------------------------------------

function assertOk(response: unknown): {
  path: string[];
  cost: number;
  result_count: number | null;
  result: unknown[];
} {
  const parsed = dataforseoResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response parse failed");
  }

  const data = parsed.data;
  if (data.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      data.status_message || "DataForSEO request failed",
    );
  }

  const task = data.tasks?.[0];
  if (!task) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response missing task");
  }
  if (task.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || "DataForSEO task failed",
    );
  }

  return {
    path: task.path ?? [],
    cost: task.cost ?? 0,
    result_count: task.result_count ?? null,
    result: task.result ?? [],
  };
}

function buildTaskBilling(task: {
  path: string[];
  cost: number;
  result_count: number | null;
}) {
  return {
    path: task.path,
    costUsd: task.cost,
    resultCount: task.result_count,
  };
}

// ---------------------------------------------------------------------------
// Domain Intersection API
// /v3/dataforseo_labs/google/domain_intersection/live
// ---------------------------------------------------------------------------

export interface DomainIntersectionInput {
  target1: string; // Competitor domain (has the keywords)
  target2: string; // Target domain (missing the keywords - your prospect)
  locationCode: number;
  languageCode: string;
  limit?: number;
  onlyMissingInTarget2?: boolean; // Default true - only return gaps
}

/**
 * Fetch keywords where target1 (competitor) ranks but target2 (prospect) doesn't.
 * This identifies keyword gaps - opportunities for the prospect.
 *
 * @param input - Two domains to compare and location/language settings
 * @returns Keyword gaps with ranking data and billing info
 *
 * Cost: ~$0.02-0.05 depending on result count
 *
 * @see https://docs.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live
 */
export async function fetchDomainIntersectionRaw(
  input: DomainIntersectionInput,
): Promise<DataforseoApiResponse<KeywordGap[]>> {
  const responseRaw = await postDataforseo(
    "/v3/dataforseo_labs/google/domain_intersection/live",
    [
      {
        target1: input.target1,
        target2: input.target2,
        location_code: input.locationCode,
        language_code: input.languageCode,
        limit: input.limit ?? 100,
        include_serp_info: false, // Don't need full SERP data for gap analysis
        intersections_mode: "missing_keywords_in_domain_2", // Only return gaps
      },
    ],
  );

  const task = assertOk(responseRaw);

  // Parse items from result array and transform to KeywordGap format
  const gaps: KeywordGap[] = [];
  for (const resultItem of task.result) {
    if (
      resultItem &&
      typeof resultItem === "object" &&
      "items" in resultItem &&
      Array.isArray((resultItem as { items?: unknown[] }).items)
    ) {
      for (const item of (resultItem as { items: unknown[] }).items) {
        const parsed = domainIntersectionItemSchema.safeParse(item);
        if (parsed.success) {
          const data = parsed.data;

          // Only include if target2 doesn't rank (this is the gap)
          const target2Ranks = data.domain_2_ranked_serp_element?.rank_absolute;
          if (input.onlyMissingInTarget2 !== false && target2Ranks) {
            // Skip - target already ranks for this keyword
            continue;
          }

          const keyword = data.keyword_data?.keyword;
          const searchVolume = data.keyword_data?.keyword_info?.search_volume ?? 0;
          const cpc = data.keyword_data?.keyword_info?.cpc ?? 0;
          const difficulty = data.keyword_data?.keyword_properties?.keyword_difficulty ?? 0;
          const competitorPosition = data.domain_1_ranked_serp_element?.rank_absolute ?? 0;

          if (keyword) {
            const gap: KeywordGap = {
              keyword,
              competitorDomain: input.target1,
              competitorPosition,
              searchVolume,
              cpc,
              difficulty,
              trafficPotential: calculateOpportunityScore({
                keyword,
                competitorDomain: input.target1,
                competitorPosition,
                searchVolume,
                cpc,
                difficulty,
                trafficPotential: 0, // Will be calculated
              }),
            };
            gaps.push(gap);
          }
        }
      }
    }
  }

  return {
    data: gaps,
    billing: buildTaskBilling(task),
  };
}

/**
 * Calculate opportunity score for a keyword gap.
 *
 * Formula: searchVolume * cpc * (100 - difficulty) / 100
 *
 * This weights high-volume, high-value keywords while penalizing difficulty.
 * A keyword with 10k volume, $5 CPC, and 30 difficulty scores:
 * 10000 * 5 * (100-30)/100 = 10000 * 5 * 0.7 = 35000
 *
 * @param gap - Keyword gap to score
 * @returns Traffic potential score (higher is better opportunity)
 */
export function calculateOpportunityScore(gap: KeywordGap): number {
  const { searchVolume, cpc, difficulty } = gap;

  // Edge cases
  if (searchVolume <= 0 || cpc <= 0) return 0;
  if (difficulty >= 100) return 0;

  // Calculate score
  const difficultyFactor = (100 - difficulty) / 100;
  return Math.round(searchVolume * cpc * difficultyFactor);
}

// Re-export types
export type { DomainIntersectionItem };
