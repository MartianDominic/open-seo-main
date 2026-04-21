/**
 * Tests for OpportunityKeywordsTable component.
 * Phase 29: AI Opportunity Discovery - Task 29-04
 */
import { describe, it, expect } from "vitest";
import {
  sortOpportunityKeywords,
  filterByCategory,
  calculateOpportunitySummary,
  type OpportunitySortColumn,
} from "./OpportunityKeywordsTable";
import type { OpportunityKeyword } from "@/db/prospect-schema";

describe("OpportunityKeywordsTable utilities", () => {
  const mockKeywords: OpportunityKeyword[] = [
    {
      keyword: "barrel sauna price",
      category: "product",
      searchVolume: 1000,
      cpc: 2.5,
      difficulty: 35,
      opportunityScore: 1625,
      source: "ai_generated",
    },
    {
      keyword: "Harvia heater reviews",
      category: "brand",
      searchVolume: 500,
      cpc: 1.2,
      difficulty: 45,
      opportunityScore: 330,
      source: "ai_generated",
    },
    {
      keyword: "sauna installation Helsinki",
      category: "service",
      searchVolume: 800,
      cpc: 3.0,
      difficulty: 55,
      opportunityScore: 1080,
      source: "ai_generated",
    },
    {
      keyword: "buy outdoor sauna",
      category: "commercial",
      searchVolume: 600,
      cpc: 2.0,
      difficulty: 40,
      opportunityScore: 720,
      source: "ai_generated",
    },
    {
      keyword: "how to build a sauna",
      category: "informational",
      searchVolume: 1500,
      cpc: 0.5,
      difficulty: 30,
      opportunityScore: 525,
      source: "ai_generated",
    },
  ];

  describe("sortOpportunityKeywords", () => {
    it("should sort by opportunityScore descending by default", () => {
      const sorted = sortOpportunityKeywords(mockKeywords, "opportunityScore", "desc");

      expect(sorted[0].keyword).toBe("barrel sauna price");
      expect(sorted[1].keyword).toBe("sauna installation Helsinki");
    });

    it("should sort by keyword alphabetically", () => {
      const sorted = sortOpportunityKeywords(mockKeywords, "keyword", "asc");

      expect(sorted[0].keyword).toBe("barrel sauna price");
      expect(sorted[1].keyword).toBe("buy outdoor sauna");
    });

    it("should sort by searchVolume descending", () => {
      const sorted = sortOpportunityKeywords(mockKeywords, "searchVolume", "desc");

      expect(sorted[0].keyword).toBe("how to build a sauna");
      expect(sorted[0].searchVolume).toBe(1500);
    });

    it("should sort by cpc ascending", () => {
      const sorted = sortOpportunityKeywords(mockKeywords, "cpc", "asc");

      expect(sorted[0].keyword).toBe("how to build a sauna");
      expect(sorted[0].cpc).toBe(0.5);
    });

    it("should sort by difficulty ascending", () => {
      const sorted = sortOpportunityKeywords(mockKeywords, "difficulty", "asc");

      expect(sorted[0].keyword).toBe("how to build a sauna");
      expect(sorted[0].difficulty).toBe(30);
    });

    it("should sort by category alphabetically", () => {
      const sorted = sortOpportunityKeywords(mockKeywords, "category", "asc");

      expect(sorted[0].category).toBe("brand");
      expect(sorted[1].category).toBe("commercial");
    });

    it("should return new array (immutable)", () => {
      const sorted = sortOpportunityKeywords(mockKeywords, "opportunityScore", "desc");

      expect(sorted).not.toBe(mockKeywords);
    });

    it("should handle empty array", () => {
      const sorted = sortOpportunityKeywords([], "opportunityScore", "desc");

      expect(sorted).toEqual([]);
    });
  });

  describe("filterByCategory", () => {
    it("should return all keywords when category is null", () => {
      const filtered = filterByCategory(mockKeywords, null);

      expect(filtered).toHaveLength(5);
    });

    it("should filter by product category", () => {
      const filtered = filterByCategory(mockKeywords, "product");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe("product");
    });

    it("should filter by brand category", () => {
      const filtered = filterByCategory(mockKeywords, "brand");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe("brand");
    });

    it("should filter by service category", () => {
      const filtered = filterByCategory(mockKeywords, "service");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe("service");
    });

    it("should filter by commercial category", () => {
      const filtered = filterByCategory(mockKeywords, "commercial");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe("commercial");
    });

    it("should filter by informational category", () => {
      const filtered = filterByCategory(mockKeywords, "informational");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].category).toBe("informational");
    });

    it("should handle empty array", () => {
      const filtered = filterByCategory([], "product");

      expect(filtered).toEqual([]);
    });
  });

  describe("calculateOpportunitySummary", () => {
    it("should calculate total keywords", () => {
      const summary = calculateOpportunitySummary(mockKeywords);

      expect(summary.totalKeywords).toBe(5);
    });

    it("should calculate total volume", () => {
      const summary = calculateOpportunitySummary(mockKeywords);

      // 1000 + 500 + 800 + 600 + 1500 = 4400
      expect(summary.totalVolume).toBe(4400);
    });

    it("should calculate average opportunity score", () => {
      const summary = calculateOpportunitySummary(mockKeywords);

      // (1625 + 330 + 1080 + 720 + 525) / 5 = 856
      expect(summary.avgOpportunity).toBe(856);
    });

    it("should count by category", () => {
      const summary = calculateOpportunitySummary(mockKeywords);

      expect(summary.byCategory.product).toBe(1);
      expect(summary.byCategory.brand).toBe(1);
      expect(summary.byCategory.service).toBe(1);
      expect(summary.byCategory.commercial).toBe(1);
      expect(summary.byCategory.informational).toBe(1);
    });

    it("should handle empty array", () => {
      const summary = calculateOpportunitySummary([]);

      expect(summary.totalKeywords).toBe(0);
      expect(summary.totalVolume).toBe(0);
      expect(summary.avgOpportunity).toBe(0);
    });

    it("should handle multiple keywords in same category", () => {
      const multipleProducts: OpportunityKeyword[] = [
        ...mockKeywords,
        {
          keyword: "indoor sauna kit",
          category: "product",
          searchVolume: 400,
          cpc: 1.8,
          difficulty: 42,
          opportunityScore: 418,
          source: "ai_generated",
        },
      ];

      const summary = calculateOpportunitySummary(multipleProducts);

      expect(summary.byCategory.product).toBe(2);
    });
  });
});
