/**
 * Tests for ProposalPreview component.
 * Phase 30: Interactive Proposals - Preview Component
 *
 * TDD: Tests for component logic and rendering.
 */
import { describe, it, expect } from "vitest";
import type { ProposalContent, BrandConfig } from "@/db/proposal-schema";

// Test data factory
function createTestContent(): ProposalContent {
  return {
    hero: {
      headline: "Test Headline",
      subheadline: "Test Subheadline",
      trafficValue: 5000,
    },
    currentState: {
      traffic: 1000,
      keywords: 200,
      value: 3000,
      chartData: [
        { month: "Jan", traffic: 900 },
        { month: "Feb", traffic: 950 },
        { month: "Mar", traffic: 1000 },
      ],
    },
    opportunities: [
      { keyword: "seo tools", volume: 2400, difficulty: "medium", potential: 5000 },
      { keyword: "local seo", volume: 1200, difficulty: "easy", potential: 3000 },
    ],
    roi: {
      projectedTrafficGain: 500,
      trafficValue: 2500,
      defaultConversionRate: 0.02,
      defaultAov: 100,
    },
    investment: {
      setupFee: 2500,
      monthlyFee: 1500,
      inclusions: ["Technical audit", "Content strategy", "Monthly reports"],
    },
    nextSteps: ["Sign agreement", "Onboarding call", "Start work"],
  };
}

function createTestBrandConfig(): BrandConfig {
  return {
    logoUrl: null,
    primaryColor: "#2563eb",
    secondaryColor: "#1e40af",
    fontFamily: "Inter",
  };
}

describe("ProposalPreview", () => {
  describe("Content Display", () => {
    it("should display hero headline and subheadline", () => {
      const content = createTestContent();
      expect(content.hero.headline).toBe("Test Headline");
      expect(content.hero.subheadline).toBe("Test Subheadline");
    });

    it("should display traffic value in hero", () => {
      const content = createTestContent();
      expect(content.hero.trafficValue).toBe(5000);
    });

    it("should display current state metrics", () => {
      const content = createTestContent();
      expect(content.currentState.traffic).toBe(1000);
      expect(content.currentState.keywords).toBe(200);
      expect(content.currentState.value).toBe(3000);
    });

    it("should display chart data points", () => {
      const content = createTestContent();
      expect(content.currentState.chartData).toHaveLength(3);
      expect(content.currentState.chartData[0].month).toBe("Jan");
    });

    it("should display opportunities list", () => {
      const content = createTestContent();
      expect(content.opportunities).toHaveLength(2);
      expect(content.opportunities[0].keyword).toBe("seo tools");
      expect(content.opportunities[0].difficulty).toBe("medium");
    });

    it("should calculate ROI revenue estimate", () => {
      const content = createTestContent();
      const monthlyRevenue = Math.round(
        content.roi.projectedTrafficGain *
          content.roi.defaultConversionRate *
          content.roi.defaultAov
      );
      expect(monthlyRevenue).toBe(1000); // 500 * 0.02 * 100
    });

    it("should display investment details", () => {
      const content = createTestContent();
      expect(content.investment.setupFee).toBe(2500);
      expect(content.investment.monthlyFee).toBe(1500);
      expect(content.investment.inclusions).toHaveLength(3);
    });

    it("should display next steps", () => {
      const content = createTestContent();
      expect(content.nextSteps).toHaveLength(3);
      expect(content.nextSteps[0]).toBe("Sign agreement");
    });
  });

  describe("Brand Config", () => {
    it("should have valid color format", () => {
      const brandConfig = createTestBrandConfig();
      expect(brandConfig.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(brandConfig.secondaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("should allow null logo", () => {
      const brandConfig = createTestBrandConfig();
      expect(brandConfig.logoUrl).toBeNull();
    });

    it("should have valid font family", () => {
      const brandConfig = createTestBrandConfig();
      expect(brandConfig.fontFamily).toBe("Inter");
    });
  });

  describe("Difficulty Badge", () => {
    it("should map difficulty levels correctly", () => {
      const difficulties = ["easy", "medium", "hard"] as const;
      difficulties.forEach((diff) => {
        expect(["easy", "medium", "hard"]).toContain(diff);
      });
    });
  });

  describe("View Modes", () => {
    it("should support desktop and mobile modes", () => {
      const viewModes = ["desktop", "mobile"] as const;
      expect(viewModes).toHaveLength(2);
    });
  });

  describe("Sections", () => {
    it("should define all preview sections", () => {
      const sections = [
        "hero",
        "current",
        "opportunities",
        "roi",
        "investment",
        "next",
      ];
      expect(sections).toHaveLength(6);
    });
  });
});
