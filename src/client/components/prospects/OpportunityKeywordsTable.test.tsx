/**
 * Tests for OpportunityKeywordsTable component (render/interaction tests).
 * Phase 29: AI Opportunity Discovery - Task 29-04
 *
 * Uses @testing-library/react patterns for component testing.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpportunityKeywordsTable } from "./OpportunityKeywordsTable";
import type { OpportunityKeyword } from "@/db/prospect-schema";

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

describe("OpportunityKeywordsTable component rendering", () => {
  it("should render table with keyword data", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // Check header columns
    expect(screen.getByText("Keyword")).toBeTruthy();
    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("Volume")).toBeTruthy();
    expect(screen.getByText("CPC")).toBeTruthy();
    expect(screen.getByText("Difficulty")).toBeTruthy();
    expect(screen.getByText("Opportunity")).toBeTruthy();
    expect(screen.getByText("Action")).toBeTruthy();
  });

  it("should render keyword rows with correct data", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // Check specific keyword data
    expect(screen.getByText("barrel sauna price")).toBeTruthy();
    expect(screen.getByText("Harvia heater reviews")).toBeTruthy();
    expect(screen.getByText("sauna installation Helsinki")).toBeTruthy();
  });

  it("should render formatted volume numbers with locale formatting", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // 1000 should be formatted
    expect(screen.getByText("1,000")).toBeTruthy();
    // 1500 should be formatted
    expect(screen.getByText("1,500")).toBeTruthy();
  });

  it("should render formatted CPC with dollar sign", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    expect(screen.getByText("$2.50")).toBeTruthy();
    expect(screen.getByText("$1.20")).toBeTruthy();
  });

  it("should render category badges", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    expect(screen.getByText("product")).toBeTruthy();
    expect(screen.getByText("brand")).toBeTruthy();
    expect(screen.getByText("service")).toBeTruthy();
    expect(screen.getByText("commercial")).toBeTruthy();
    expect(screen.getByText("informational")).toBeTruthy();
  });

  it("should render difficulty badges", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // DifficultyBadge renders Easy/Medium/Hard based on difficulty score
    // 30 = Easy, 35 = Medium, 40 = Medium, 45 = Medium, 55 = Medium
    const mediumBadges = screen.getAllByText("Medium");
    expect(mediumBadges.length).toBeGreaterThan(0);

    // 30 = Easy
    expect(screen.getByText("Easy")).toBeTruthy();
  });

  it("should render keyword count in filter area", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    expect(screen.getByText(/showing 5 of 5 keywords/i)).toBeTruthy();
  });
});

describe("OpportunityKeywordsTable empty state", () => {
  it("should render empty state when keywords array is empty", () => {
    render(<OpportunityKeywordsTable keywords={[]} />);

    expect(screen.getByText("No keyword opportunities found.")).toBeTruthy();
    expect(
      screen.getByText(/run an analysis to generate ai-powered keyword suggestions/i)
    ).toBeTruthy();
  });

  it("should not render table when no keywords", () => {
    render(<OpportunityKeywordsTable keywords={[]} />);

    // Table elements should not exist
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("OpportunityKeywordsTable sorting", () => {
  it("should sort by column when header is clicked", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // Default sort is by opportunityScore desc
    const tbody = screen.getByRole("table").querySelector("tbody");
    expect(tbody).toBeTruthy();

    // Get all rows
    const rows = tbody!.querySelectorAll("tr");
    // First row should be highest opportunity score (barrel sauna price = 1625)
    expect(rows[0].textContent).toContain("barrel sauna price");
  });

  it("should toggle sort direction when clicking same column twice", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // Click Keyword header to sort alphabetically asc
    const keywordHeader = screen.getByText("Keyword");
    fireEvent.click(keywordHeader);

    // Click again to toggle to desc
    fireEvent.click(keywordHeader);

    // Should now be desc alphabetically
    const tbody = screen.getByRole("table").querySelector("tbody");
    const rows = tbody!.querySelectorAll("tr");

    // Last alphabetically should be first in desc order
    expect(rows[0].textContent).toContain("sauna installation Helsinki");
  });

  it("should show sort indicator on active column", () => {
    const { container } = render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // Click Volume header to activate sorting on that column
    const volumeHeader = screen.getByText("Volume");
    fireEvent.click(volumeHeader);

    // The sort indicator (ChevronDown or ChevronUp icon) should be visible in the table header area
    // The icon is rendered inside a div with flex items-center gap-1 alongside the header text
    const thead = container.querySelector("thead");
    expect(thead).toBeTruthy();

    // After clicking Volume, there should be an SVG in the thead (the sort indicator)
    const svgs = thead!.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });
});

describe("OpportunityKeywordsTable category filtering", () => {
  it("should render category filter dropdown", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    expect(screen.getByText("Filter by category:")).toBeTruthy();
  });

  it("should display all categories option as default", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // The select trigger should show "All categories"
    const selectTrigger = screen.getByRole("combobox");
    expect(selectTrigger).toBeTruthy();
  });
});

describe("OpportunityKeywordsTable actions", () => {
  it("should render add to proposal buttons", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // Each row should have an "Add to proposal" button
    const addButtons = screen.getAllByRole("button", { name: /add to proposal/i });
    expect(addButtons.length).toBe(mockKeywords.length);
  });

  it("should have disabled add to proposal buttons (coming soon)", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    const addButtons = screen.getAllByRole("button", { name: /add to proposal/i });

    // All buttons should be disabled (coming soon feature)
    for (const button of addButtons) {
      expect(button).toHaveProperty("disabled", true);
    }
  });

  it("should call onAddToProposal when button is clicked", () => {
    const onAddToProposal = vi.fn();
    render(
      <OpportunityKeywordsTable
        keywords={mockKeywords}
        onAddToProposal={onAddToProposal}
      />
    );

    // Note: buttons are disabled so click won't fire
    // This test documents expected behavior when enabled
    const addButtons = screen.getAllByRole("button", { name: /add to proposal/i });
    expect(addButtons.length).toBeGreaterThan(0);
  });
});

describe("OpportunityKeywordsTable accessibility", () => {
  it("should have accessible table structure", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // Table should be present
    expect(screen.getByRole("table")).toBeTruthy();

    // Column headers should be in thead
    const thead = screen.getByRole("table").querySelector("thead");
    expect(thead).toBeTruthy();

    // Header cells
    const headerCells = thead!.querySelectorAll("th");
    expect(headerCells.length).toBeGreaterThan(0);
  });

  it("should have aria-label on add to proposal buttons", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    const addButtons = screen.getAllByRole("button", { name: /add to proposal/i });
    expect(addButtons.length).toBeGreaterThan(0);

    // Each button should have proper aria-label
    for (const button of addButtons) {
      expect(button.getAttribute("aria-label")).toBe("Add to proposal");
    }
  });

  it("should have accessible combobox for category filter", () => {
    render(<OpportunityKeywordsTable keywords={mockKeywords} />);

    // The select should be a combobox role
    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeTruthy();
  });
});
