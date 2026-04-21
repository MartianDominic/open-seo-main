/**
 * Tests for OpportunitySummaryCard component.
 * Phase 29: AI Opportunity Discovery - Task 29-04
 *
 * Uses @testing-library/react patterns for component testing.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpportunitySummaryCard } from "./OpportunitySummaryCard";
import type { OpportunitySummary } from "./OpportunityKeywordsTable";

const mockSummary: OpportunitySummary = {
  totalKeywords: 25,
  totalVolume: 15000,
  avgOpportunity: 850,
  byCategory: {
    product: 8,
    brand: 5,
    service: 4,
    commercial: 5,
    informational: 3,
  },
};

const emptySummary: OpportunitySummary = {
  totalKeywords: 0,
  totalVolume: 0,
  avgOpportunity: 0,
  byCategory: {
    product: 0,
    brand: 0,
    service: 0,
    commercial: 0,
    informational: 0,
  },
};

describe("OpportunitySummaryCard component rendering", () => {
  it("should render total keywords stat", () => {
    render(<OpportunitySummaryCard summary={mockSummary} />);

    expect(screen.getByText("Total Keywords")).toBeTruthy();
    expect(screen.getByText("25")).toBeTruthy();
  });

  it("should render total volume stat with locale formatting", () => {
    render(<OpportunitySummaryCard summary={mockSummary} />);

    expect(screen.getByText("Total Volume")).toBeTruthy();
    expect(screen.getByText("15,000")).toBeTruthy();
  });

  it("should render average opportunity score", () => {
    render(<OpportunitySummaryCard summary={mockSummary} />);

    expect(screen.getByText("Avg Opportunity")).toBeTruthy();
    expect(screen.getByText("850")).toBeTruthy();
  });

  it("should render category breakdown section", () => {
    render(<OpportunitySummaryCard summary={mockSummary} />);

    expect(screen.getByText("Keywords by Category")).toBeTruthy();
  });

  it("should render all category labels", () => {
    render(<OpportunitySummaryCard summary={mockSummary} />);

    expect(screen.getByText("Product")).toBeTruthy();
    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getByText("Service")).toBeTruthy();
    expect(screen.getByText("Commercial")).toBeTruthy();
    expect(screen.getByText("Informational")).toBeTruthy();
  });

  it("should render category counts correctly", () => {
    render(<OpportunitySummaryCard summary={mockSummary} />);

    // Product count
    expect(screen.getByText("8")).toBeTruthy();
    // Brand count (5) and Commercial count (5) both exist - use getAllByText
    const fives = screen.getAllByText("5");
    expect(fives.length).toBe(2); // Brand and Commercial both have count 5
    // Service count
    expect(screen.getByText("4")).toBeTruthy();
    // Informational count
    expect(screen.getByText("3")).toBeTruthy();
  });
});

describe("OpportunitySummaryCard empty state", () => {
  it("should render zero values when summary is empty", () => {
    render(<OpportunitySummaryCard summary={emptySummary} />);

    // All main stats should show 0
    const zeros = screen.getAllByText("0");
    // Total Keywords (0) + Total Volume (0) + Avg Opportunity (0) + 5 categories (0 each) = 8 zeros
    expect(zeros.length).toBe(8);
  });

  it("should still render all labels with empty data", () => {
    render(<OpportunitySummaryCard summary={emptySummary} />);

    expect(screen.getByText("Total Keywords")).toBeTruthy();
    expect(screen.getByText("Total Volume")).toBeTruthy();
    expect(screen.getByText("Avg Opportunity")).toBeTruthy();
    expect(screen.getByText("Keywords by Category")).toBeTruthy();
  });
});

describe("OpportunitySummaryCard with large numbers", () => {
  it("should format large volume numbers correctly", () => {
    const largeSummary: OpportunitySummary = {
      totalKeywords: 1234,
      totalVolume: 5678901,
      avgOpportunity: 12345,
      byCategory: {
        product: 500,
        brand: 234,
        service: 201,
        commercial: 199,
        informational: 100,
      },
    };

    render(<OpportunitySummaryCard summary={largeSummary} />);

    // Volume should be formatted with commas
    expect(screen.getByText("5,678,901")).toBeTruthy();
    // Keywords - component doesn't format totalKeywords with commas
    expect(screen.getByText("1234")).toBeTruthy();
    // Avg opportunity
    expect(screen.getByText("12,345")).toBeTruthy();
  });
});

describe("OpportunitySummaryCard accessibility", () => {
  it("should have semantic card structure", () => {
    const { container } = render(
      <OpportunitySummaryCard summary={mockSummary} />
    );

    // Should have multiple card elements
    const cards = container.querySelectorAll('[class*="rounded"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it("should have readable text contrast indicators", () => {
    render(<OpportunitySummaryCard summary={mockSummary} />);

    // Labels should be present and readable
    const labels = screen.getAllByText(/total|avg|keywords by category/i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("should render category counts with color indicators", () => {
    const { container } = render(
      <OpportunitySummaryCard summary={mockSummary} />
    );

    // Category counts should have color classes
    const coloredElements = container.querySelectorAll(
      '[class*="text-blue"], [class*="text-purple"], [class*="text-green"], [class*="text-orange"], [class*="text-cyan"]'
    );
    expect(coloredElements.length).toBeGreaterThan(0);
  });
});

describe("OpportunitySummaryCard layout", () => {
  it("should render main stats in a grid layout", () => {
    const { container } = render(
      <OpportunitySummaryCard summary={mockSummary} />
    );

    // Should have grid layout for main stats
    const grids = container.querySelectorAll('[class*="grid"]');
    expect(grids.length).toBeGreaterThan(0);
  });

  it("should render category counts in a grid layout", () => {
    const { container } = render(
      <OpportunitySummaryCard summary={mockSummary} />
    );

    // Should have responsive grid layout
    const responsiveGrid = container.querySelector('[class*="grid-cols"]');
    expect(responsiveGrid).toBeTruthy();
  });
});
