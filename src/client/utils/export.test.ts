/**
 * Tests for CSV export utility
 * Phase 28: Keyword Gap Analysis UI
 */
import { describe, it, expect } from "vitest";
import { exportKeywordGaps } from "./export";
import type { KeywordGap } from "@/db/prospect-schema";

describe("exportKeywordGaps", () => {
  it("should generate CSV with headers and data rows", () => {
    const gaps: KeywordGap[] = [
      {
        keyword: "seo tools",
        competitorDomain: "competitor.com",
        competitorPosition: 3,
        searchVolume: 5000,
        cpc: 2.5,
        difficulty: 45,
        trafficPotential: 6875,
      },
      {
        keyword: "keyword research",
        competitorDomain: "example.com",
        competitorPosition: 1,
        searchVolume: 8000,
        cpc: 3.0,
        difficulty: 60,
        trafficPotential: 9600,
      },
    ];

    const csv = exportKeywordGaps(gaps);

    // Check headers
    expect(csv).toContain(
      "Keyword,Competitor,Position,Search Volume,CPC,Difficulty,Opportunity Score"
    );

    // Check data rows
    expect(csv).toContain("seo tools,competitor.com,3,5000,2.50,45,6875");
    expect(csv).toContain("keyword research,example.com,1,8000,3.00,60,9600");
  });

  it("should handle empty gaps array", () => {
    const csv = exportKeywordGaps([]);

    // Should still have headers
    expect(csv).toContain(
      "Keyword,Competitor,Position,Search Volume,CPC,Difficulty,Opportunity Score"
    );

    // Should have no data rows (only header line)
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(1);
  });

  it("should escape commas in keyword text", () => {
    const gaps: KeywordGap[] = [
      {
        keyword: "seo tools, best practices",
        competitorDomain: "competitor.com",
        competitorPosition: 3,
        searchVolume: 5000,
        cpc: 2.5,
        difficulty: 45,
        trafficPotential: 6875,
      },
    ];

    const csv = exportKeywordGaps(gaps);

    // Keyword with comma should be quoted
    expect(csv).toContain('"seo tools, best practices"');
  });

  it("should handle special characters in domain names", () => {
    const gaps: KeywordGap[] = [
      {
        keyword: "test",
        competitorDomain: "test-domain.co.uk",
        competitorPosition: 1,
        searchVolume: 100,
        cpc: 1.0,
        difficulty: 20,
        trafficPotential: 80,
      },
    ];

    const csv = exportKeywordGaps(gaps);

    expect(csv).toContain("test-domain.co.uk");
  });

  it("should format CPC with 2 decimal places", () => {
    const gaps: KeywordGap[] = [
      {
        keyword: "test",
        competitorDomain: "competitor.com",
        competitorPosition: 1,
        searchVolume: 100,
        cpc: 1.234567,
        difficulty: 20,
        trafficPotential: 80,
      },
    ];

    const csv = exportKeywordGaps(gaps);

    // CPC should be formatted to 2 decimal places
    expect(csv).toContain("1.23");
  });

  it("should handle zero values correctly", () => {
    const gaps: KeywordGap[] = [
      {
        keyword: "test",
        competitorDomain: "competitor.com",
        competitorPosition: 0,
        searchVolume: 0,
        cpc: 0,
        difficulty: 0,
        trafficPotential: 0,
      },
    ];

    const csv = exportKeywordGaps(gaps);

    expect(csv).toContain("test,competitor.com,0,0,0.00,0,0");
  });

  describe("CSV injection prevention", () => {
    it("should sanitize keywords starting with = (formula)", () => {
      const gaps: KeywordGap[] = [
        {
          keyword: "=CMD|'/C calc'!A0",
          competitorDomain: "competitor.com",
          competitorPosition: 1,
          searchVolume: 100,
          cpc: 1.0,
          difficulty: 20,
          trafficPotential: 80,
        },
      ];

      const csv = exportKeywordGaps(gaps);

      // Should be prefixed with tab to prevent formula execution
      expect(csv).toContain("\t=CMD|");
      // Should NOT start with = directly
      expect(csv).not.toMatch(/^=CMD/m);
    });

    it("should sanitize keywords starting with + (formula)", () => {
      const gaps: KeywordGap[] = [
        {
          keyword: "+1+1",
          competitorDomain: "competitor.com",
          competitorPosition: 1,
          searchVolume: 100,
          cpc: 1.0,
          difficulty: 20,
          trafficPotential: 80,
        },
      ];

      const csv = exportKeywordGaps(gaps);

      expect(csv).toContain("\t+1+1");
    });

    it("should sanitize keywords starting with - (formula)", () => {
      const gaps: KeywordGap[] = [
        {
          keyword: "-1-1",
          competitorDomain: "competitor.com",
          competitorPosition: 1,
          searchVolume: 100,
          cpc: 1.0,
          difficulty: 20,
          trafficPotential: 80,
        },
      ];

      const csv = exportKeywordGaps(gaps);

      expect(csv).toContain("\t-1-1");
    });

    it("should sanitize keywords starting with @ (formula)", () => {
      const gaps: KeywordGap[] = [
        {
          keyword: "@SUM(A1:A10)",
          competitorDomain: "competitor.com",
          competitorPosition: 1,
          searchVolume: 100,
          cpc: 1.0,
          difficulty: 20,
          trafficPotential: 80,
        },
      ];

      const csv = exportKeywordGaps(gaps);

      expect(csv).toContain("\t@SUM");
    });
  });

  describe("double-quote escaping", () => {
    it("should escape double quotes by doubling them", () => {
      const gaps: KeywordGap[] = [
        {
          keyword: 'keyword with "quotes" inside',
          competitorDomain: "competitor.com",
          competitorPosition: 1,
          searchVolume: 100,
          cpc: 1.0,
          difficulty: 20,
          trafficPotential: 80,
        },
      ];

      const csv = exportKeywordGaps(gaps);

      // Double quotes should be escaped as ""
      expect(csv).toContain('"keyword with ""quotes"" inside"');
    });

    it("should handle keywords with both commas and quotes", () => {
      const gaps: KeywordGap[] = [
        {
          keyword: 'seo "best practices", tips',
          competitorDomain: "competitor.com",
          competitorPosition: 1,
          searchVolume: 100,
          cpc: 1.0,
          difficulty: 20,
          trafficPotential: 80,
        },
      ];

      const csv = exportKeywordGaps(gaps);

      expect(csv).toContain('"seo ""best practices"", tips"');
    });

    it("should handle newlines within values", () => {
      const gaps: KeywordGap[] = [
        {
          keyword: "keyword with\nnewline",
          competitorDomain: "competitor.com",
          competitorPosition: 1,
          searchVolume: 100,
          cpc: 1.0,
          difficulty: 20,
          trafficPotential: 80,
        },
      ];

      const csv = exportKeywordGaps(gaps);

      // Value with newline should be quoted
      expect(csv).toContain('"keyword with\nnewline"');
    });
  });
});
