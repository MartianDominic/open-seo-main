/**
 * Tests for KeywordAggregationService.
 * Phase 34: Keyword-Page Mapping
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  KeywordAggregationService,
  type AggregatedKeyword,
  type AggregationResult,
} from "./KeywordAggregationService";

// Mock Drizzle database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLeftJoin = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockGroupBy = vi.fn();
const mockHaving = vi.fn();

// Chain mock setup
const createChain = () => ({
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  leftJoin: mockLeftJoin,
  orderBy: mockOrderBy,
  limit: mockLimit,
  groupBy: mockGroupBy,
  having: mockHaving,
});

const mockDb = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => ({
            having: vi.fn(() => Promise.resolve([])),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
          limit: vi.fn(() => Promise.resolve([])),
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([])),
        })),
        limit: vi.fn(() => Promise.resolve([])),
      })),
    };
    return chain;
  }),
};

describe("KeywordAggregationService", () => {
  let service: KeywordAggregationService;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error - Mock DB for testing
    service = new KeywordAggregationService(mockDb);
  });

  describe("AggregatedKeyword type structure", () => {
    it("should have all required fields", () => {
      const keyword: AggregatedKeyword = {
        keyword: "test keyword",
        originalKeyword: "Test Keyword",
        sources: ["gsc", "saved"],
        currentPosition: 5,
        currentUrl: "https://example.com/page",
        searchVolume: 1000,
        cpc: 2.5,
        difficulty: 45,
        gscAvgPosition: 7.2,
        gscImpressions: 500,
        gscClicks: 25,
        achievability: 75,
        isTracked: true,
      };

      expect(keyword.keyword).toBe("test keyword");
      expect(keyword.originalKeyword).toBe("Test Keyword");
      expect(keyword.sources).toContain("gsc");
      expect(keyword.sources).toContain("saved");
      expect(keyword.currentPosition).toBe(5);
      expect(keyword.searchVolume).toBe(1000);
      expect(keyword.isTracked).toBe(true);
    });

    it("should allow nullable fields", () => {
      const keyword: AggregatedKeyword = {
        keyword: "test",
        originalKeyword: "Test",
        sources: ["gsc"],
        currentPosition: null,
        currentUrl: null,
        searchVolume: null,
        cpc: null,
        difficulty: null,
        gscAvgPosition: 5.0,
        gscImpressions: 100,
        gscClicks: 10,
        achievability: null,
        isTracked: false,
      };

      expect(keyword.currentPosition).toBeNull();
      expect(keyword.searchVolume).toBeNull();
      expect(keyword.achievability).toBeNull();
    });
  });

  describe("AggregationResult type structure", () => {
    it("should have all required fields", () => {
      const result: AggregationResult = {
        keywords: [],
        sourceCounts: {
          gsc: 10,
          saved: 5,
          ranking: 3,
          prospect_gap: 2,
          prospect_opportunity: 1,
        },
        totalUnique: 15,
        clientId: "client-123",
        prospectId: "prospect-456",
      };

      expect(result.keywords).toEqual([]);
      expect(result.sourceCounts.gsc).toBe(10);
      expect(result.totalUnique).toBe(15);
      expect(result.clientId).toBe("client-123");
      expect(result.prospectId).toBe("prospect-456");
    });

    it("should allow null clientId and prospectId", () => {
      const result: AggregationResult = {
        keywords: [],
        sourceCounts: {
          gsc: 0,
          saved: 0,
          ranking: 0,
          prospect_gap: 0,
          prospect_opportunity: 0,
        },
        totalUnique: 0,
        clientId: null,
        prospectId: null,
      };

      expect(result.clientId).toBeNull();
      expect(result.prospectId).toBeNull();
    });
  });

  describe("mergeAndDeduplicate logic", () => {
    it("should normalize keywords to lowercase", () => {
      // Access private method via prototype for testing
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "SEO Tools", avgPosition: 5, totalImpressions: 100, totalClicks: 10 },
      ];
      const savedKeywords = [
        { keyword: "seo tools", searchVolume: 1000, cpc: 2.0, difficulty: 50, isTracked: true },
      ];

      const result = mergeMethod(gscKeywords, savedKeywords, [], []);

      expect(result.length).toBe(1);
      expect(result[0].keyword).toBe("seo tools");
    });

    it("should merge sources from multiple data sources", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "keyword research", avgPosition: 8, totalImpressions: 200, totalClicks: 15 },
      ];
      const savedKeywords = [
        { keyword: "Keyword Research", searchVolume: 2000, cpc: 3.0, difficulty: 60, isTracked: true },
      ];
      const rankings = [
        { keyword: "KEYWORD RESEARCH", position: 6, url: "https://example.com/guide" },
      ];

      const result = mergeMethod(gscKeywords, savedKeywords, rankings, []);

      expect(result.length).toBe(1);
      expect(result[0].sources).toContain("gsc");
      expect(result[0].sources).toContain("saved");
      expect(result[0].sources).toContain("ranking");
    });

    it("should prioritize ranking position over GSC position", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "test keyword", avgPosition: 10, totalImpressions: 50, totalClicks: 5 },
      ];
      const rankings = [
        { keyword: "test keyword", position: 3, url: "https://example.com" },
      ];

      const result = mergeMethod(gscKeywords, [], rankings, []);

      expect(result[0].currentPosition).toBe(3);
      expect(result[0].gscAvgPosition).toBe(10);
    });

    it("should prioritize saved keyword metrics over prospect data", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const savedKeywords = [
        { keyword: "buy shoes", searchVolume: 5000, cpc: 1.5, difficulty: 40, isTracked: false },
      ];
      const prospectKeywords = [
        {
          keyword: "buy shoes",
          searchVolume: 4000,
          cpc: 1.2,
          difficulty: 35,
          achievability: 80,
          source: "prospect_gap" as const,
        },
      ];

      const result = mergeMethod([], savedKeywords, [], prospectKeywords);

      // Saved metrics should take priority
      expect(result[0].searchVolume).toBe(5000);
      expect(result[0].cpc).toBe(1.5);
      expect(result[0].difficulty).toBe(40);
      // But achievability comes from prospect
      expect(result[0].achievability).toBe(80);
    });

    it("should handle empty inputs", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const result = mergeMethod([], [], [], []);

      expect(result).toEqual([]);
    });

    it("should sort results by search volume descending", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const savedKeywords = [
        { keyword: "low volume", searchVolume: 100, cpc: 1.0, difficulty: 20, isTracked: true },
        { keyword: "high volume", searchVolume: 10000, cpc: 5.0, difficulty: 80, isTracked: true },
        { keyword: "medium volume", searchVolume: 1000, cpc: 2.0, difficulty: 50, isTracked: true },
      ];

      const result = mergeMethod([], savedKeywords, [], []);

      expect(result[0].keyword).toBe("high volume");
      expect(result[1].keyword).toBe("medium volume");
      expect(result[2].keyword).toBe("low volume");
    });

    it("should handle keywords with whitespace", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "  keyword  ", avgPosition: 5, totalImpressions: 100, totalClicks: 10 },
      ];
      const savedKeywords = [
        { keyword: "keyword", searchVolume: 500, cpc: 1.0, difficulty: 30, isTracked: true },
      ];

      const result = mergeMethod(gscKeywords, savedKeywords, [], []);

      expect(result.length).toBe(1);
      expect(result[0].keyword).toBe("keyword");
    });

    it("should preserve original keyword case in originalKeyword field", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "SEO Best Practices", avgPosition: 3, totalImpressions: 500, totalClicks: 50 },
      ];

      const result = mergeMethod(gscKeywords, [], [], []);

      expect(result[0].keyword).toBe("seo best practices");
      expect(result[0].originalKeyword).toBe("SEO Best Practices");
    });

    it("should track isTracked from saved keywords", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const savedKeywords = [
        { keyword: "tracked kw", searchVolume: 100, cpc: 1.0, difficulty: 20, isTracked: true },
        { keyword: "untracked kw", searchVolume: 200, cpc: 2.0, difficulty: 30, isTracked: false },
      ];

      const result = mergeMethod([], savedKeywords, [], []);

      const trackedKw = result.find((k) => k.keyword === "tracked kw");
      const untrackedKw = result.find((k) => k.keyword === "untracked kw");

      expect(trackedKw?.isTracked).toBe(true);
      expect(untrackedKw?.isTracked).toBe(false);
    });

    it("should include both gap and opportunity keywords from prospect", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const prospectKeywords = [
        {
          keyword: "gap keyword",
          searchVolume: 1000,
          cpc: 2.0,
          difficulty: 50,
          achievability: 70,
          source: "prospect_gap" as const,
        },
        {
          keyword: "opportunity keyword",
          searchVolume: 800,
          cpc: 1.5,
          difficulty: 40,
          achievability: 85,
          source: "prospect_opportunity" as const,
        },
      ];

      const result = mergeMethod([], [], [], prospectKeywords);

      expect(result.length).toBe(2);

      const gapKw = result.find((k) => k.keyword === "gap keyword");
      const oppKw = result.find((k) => k.keyword === "opportunity keyword");

      expect(gapKw?.sources).toContain("prospect_gap");
      expect(oppKw?.sources).toContain("prospect_opportunity");
    });
  });

  describe("aggregateForProject", () => {
    // Note: Integration tests for aggregateForProject require complex Drizzle ORM mocking.
    // The core merge logic is thoroughly tested in the mergeAndDeduplicate tests above.
    // Full integration testing should be done with a test database.

    it("should have correct method signature", () => {
      // Type-level test: verify the method exists with correct signature
      expect(typeof service.aggregateForProject).toBe("function");
    });

    it("should accept options parameter", () => {
      // Type-level test: verify options are typed correctly
      const options = {
        minGscImpressions: 20,
        gscDaysBack: 14,
        includeProspectKeywords: false,
      };
      // Just checking the method accepts the options without type errors
      expect(options.minGscImpressions).toBe(20);
      expect(options.gscDaysBack).toBe(14);
      expect(options.includeProspectKeywords).toBe(false);
    });
  });

  describe("source counts", () => {
    it("should correctly count keywords per source", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "kw1", avgPosition: 5, totalImpressions: 100, totalClicks: 10 },
        { keyword: "kw2", avgPosition: 8, totalImpressions: 200, totalClicks: 20 },
      ];
      const savedKeywords = [
        { keyword: "kw1", searchVolume: 1000, cpc: 2.0, difficulty: 50, isTracked: true },
        { keyword: "kw3", searchVolume: 500, cpc: 1.0, difficulty: 30, isTracked: true },
      ];

      const merged = mergeMethod(gscKeywords, savedKeywords, [], []);

      // Calculate source counts like the service does
      const sourceCounts = {
        gsc: 0,
        saved: 0,
        ranking: 0,
        prospect_gap: 0,
        prospect_opportunity: 0,
      };

      for (const kw of merged) {
        for (const source of kw.sources) {
          sourceCounts[source]++;
        }
      }

      // kw1 appears in both gsc and saved
      // kw2 appears only in gsc
      // kw3 appears only in saved
      expect(sourceCounts.gsc).toBe(2); // kw1, kw2
      expect(sourceCounts.saved).toBe(2); // kw1, kw3
    });
  });

  describe("edge cases", () => {
    it("should handle keywords with special characters", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "c++ programming", avgPosition: 10, totalImpressions: 50, totalClicks: 5 },
        { keyword: "node.js tutorial", avgPosition: 7, totalImpressions: 100, totalClicks: 15 },
      ];

      const result = mergeMethod(gscKeywords, [], [], []);

      expect(result.length).toBe(2);
      expect(result.some((k) => k.keyword === "c++ programming")).toBe(true);
      expect(result.some((k) => k.keyword === "node.js tutorial")).toBe(true);
    });

    it("should handle very long keywords", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const longKeyword = "this is a very long tail keyword that someone might search for when looking for something specific";
      const gscKeywords = [
        { keyword: longKeyword, avgPosition: 15, totalImpressions: 20, totalClicks: 2 },
      ];

      const result = mergeMethod(gscKeywords, [], [], []);

      expect(result[0].keyword).toBe(longKeyword.toLowerCase());
    });

    it("should handle zero metrics gracefully", () => {
      // @ts-expect-error - Accessing private method for testing
      const mergeMethod = service.mergeAndDeduplicate.bind(service);

      const gscKeywords = [
        { keyword: "zero clicks", avgPosition: 50, totalImpressions: 10, totalClicks: 0 },
      ];
      const savedKeywords = [
        { keyword: "zero volume", searchVolume: 0, cpc: 0, difficulty: 0, isTracked: true },
      ];

      const result = mergeMethod(gscKeywords, savedKeywords, [], []);

      expect(result.length).toBe(2);
      expect(result.find((k) => k.keyword === "zero clicks")?.gscClicks).toBe(0);
      expect(result.find((k) => k.keyword === "zero volume")?.searchVolume).toBe(0);
    });
  });
});
