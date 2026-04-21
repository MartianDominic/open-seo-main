/**
 * Tests for KeywordGapTable utility functions
 * Phase 28: Keyword Gap Analysis UI
 *
 * Tests sorting logic for keyword gap table columns.
 */
import { describe, it, expect } from "vitest";
import {
  sortKeywordGaps,
  calculateGapSummary,
  type SortColumn,
  type SortDirection,
} from "./KeywordGapTable";
import type { KeywordGap } from "@/db/prospect-schema";

const mockGaps: KeywordGap[] = [
  {
    keyword: "seo tools",
    competitorDomain: "competitor1.com",
    competitorPosition: 3,
    searchVolume: 5000,
    cpc: 2.5,
    difficulty: 45,
    trafficPotential: 6875,
  },
  {
    keyword: "keyword research",
    competitorDomain: "competitor2.com",
    competitorPosition: 1,
    searchVolume: 8000,
    cpc: 3.0,
    difficulty: 60,
    trafficPotential: 9600,
  },
  {
    keyword: "backlink analysis",
    competitorDomain: "competitor1.com",
    competitorPosition: 5,
    searchVolume: 3000,
    cpc: 1.5,
    difficulty: 30,
    trafficPotential: 3150,
  },
];

describe("sortKeywordGaps", () => {
  it("should sort by trafficPotential descending by default", () => {
    const sorted = sortKeywordGaps(mockGaps, "trafficPotential", "desc");

    expect(sorted[0].keyword).toBe("keyword research");
    expect(sorted[1].keyword).toBe("seo tools");
    expect(sorted[2].keyword).toBe("backlink analysis");
  });

  it("should sort by trafficPotential ascending", () => {
    const sorted = sortKeywordGaps(mockGaps, "trafficPotential", "asc");

    expect(sorted[0].keyword).toBe("backlink analysis");
    expect(sorted[1].keyword).toBe("seo tools");
    expect(sorted[2].keyword).toBe("keyword research");
  });

  it("should sort by keyword alphabetically ascending", () => {
    const sorted = sortKeywordGaps(mockGaps, "keyword", "asc");

    expect(sorted[0].keyword).toBe("backlink analysis");
    expect(sorted[1].keyword).toBe("keyword research");
    expect(sorted[2].keyword).toBe("seo tools");
  });

  it("should sort by keyword alphabetically descending", () => {
    const sorted = sortKeywordGaps(mockGaps, "keyword", "desc");

    expect(sorted[0].keyword).toBe("seo tools");
    expect(sorted[1].keyword).toBe("keyword research");
    expect(sorted[2].keyword).toBe("backlink analysis");
  });

  it("should sort by searchVolume descending", () => {
    const sorted = sortKeywordGaps(mockGaps, "searchVolume", "desc");

    expect(sorted[0].searchVolume).toBe(8000);
    expect(sorted[1].searchVolume).toBe(5000);
    expect(sorted[2].searchVolume).toBe(3000);
  });

  it("should sort by difficulty ascending", () => {
    const sorted = sortKeywordGaps(mockGaps, "difficulty", "asc");

    expect(sorted[0].difficulty).toBe(30);
    expect(sorted[1].difficulty).toBe(45);
    expect(sorted[2].difficulty).toBe(60);
  });

  it("should sort by cpc descending", () => {
    const sorted = sortKeywordGaps(mockGaps, "cpc", "desc");

    expect(sorted[0].cpc).toBe(3.0);
    expect(sorted[1].cpc).toBe(2.5);
    expect(sorted[2].cpc).toBe(1.5);
  });

  it("should sort by competitorPosition ascending", () => {
    const sorted = sortKeywordGaps(mockGaps, "competitorPosition", "asc");

    expect(sorted[0].competitorPosition).toBe(1);
    expect(sorted[1].competitorPosition).toBe(3);
    expect(sorted[2].competitorPosition).toBe(5);
  });

  it("should not mutate the original array", () => {
    const original = [...mockGaps];
    sortKeywordGaps(mockGaps, "trafficPotential", "desc");

    expect(mockGaps).toEqual(original);
  });

  it("should handle empty array", () => {
    const sorted = sortKeywordGaps([], "trafficPotential", "desc");
    expect(sorted).toEqual([]);
  });
});

describe("calculateGapSummary", () => {
  it("should calculate total gaps count", () => {
    const summary = calculateGapSummary(mockGaps);
    expect(summary.totalGaps).toBe(3);
  });

  it("should calculate average opportunity score", () => {
    const summary = calculateGapSummary(mockGaps);
    // (6875 + 9600 + 3150) / 3 = 6541.67
    expect(summary.avgOpportunity).toBeCloseTo(6541.67, 0);
  });

  it("should calculate total search volume", () => {
    const summary = calculateGapSummary(mockGaps);
    expect(summary.totalVolume).toBe(16000); // 5000 + 8000 + 3000
  });

  it("should calculate average difficulty", () => {
    const summary = calculateGapSummary(mockGaps);
    // (45 + 60 + 30) / 3 = 45
    expect(summary.avgDifficulty).toBe(45);
  });

  it("should count unique competitors", () => {
    const summary = calculateGapSummary(mockGaps);
    expect(summary.uniqueCompetitors).toBe(2); // competitor1.com and competitor2.com
  });

  it("should handle empty array", () => {
    const summary = calculateGapSummary([]);

    expect(summary.totalGaps).toBe(0);
    expect(summary.avgOpportunity).toBe(0);
    expect(summary.totalVolume).toBe(0);
    expect(summary.avgDifficulty).toBe(0);
    expect(summary.uniqueCompetitors).toBe(0);
  });

  it("should handle single item array", () => {
    const summary = calculateGapSummary([mockGaps[0]]);

    expect(summary.totalGaps).toBe(1);
    expect(summary.avgOpportunity).toBe(6875);
    expect(summary.avgDifficulty).toBe(45);
  });
});
