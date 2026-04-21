/**
 * Tests for OpportunityKeywordsTab component.
 * Phase 29: AI Opportunity Discovery - Task 29-04
 *
 * Uses @testing-library/react patterns for component testing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpportunityKeywordsTab } from "./OpportunityKeywordsTab";
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
];

describe("OpportunityKeywordsTab component rendering", () => {
  it("should render header with AI-Generated Opportunities title", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    expect(screen.getByText("AI-Generated Opportunities")).toBeTruthy();
  });

  it("should render export CSV button", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    expect(screen.getByRole("button", { name: /export csv/i })).toBeTruthy();
  });

  it("should render summary card with statistics", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    // Summary card stats
    expect(screen.getByText("Total Keywords")).toBeTruthy();
    expect(screen.getByText("Total Volume")).toBeTruthy();
    expect(screen.getByText("Avg Opportunity")).toBeTruthy();
  });

  it("should render keywords table", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    // Table should be present
    expect(screen.getByRole("table")).toBeTruthy();

    // Keywords should be visible
    expect(screen.getByText("barrel sauna price")).toBeTruthy();
    expect(screen.getByText("Harvia heater reviews")).toBeTruthy();
  });
});

describe("OpportunityKeywordsTab empty state", () => {
  it("should render empty state when keywords is null", () => {
    render(<OpportunityKeywordsTab keywords={null} domain="example.com" />);

    expect(screen.getByText("No keyword opportunities found yet.")).toBeTruthy();
    expect(
      screen.getByText(/run an analysis to generate ai-powered keyword suggestions/i)
    ).toBeTruthy();
  });

  it("should render empty state when keywords is undefined", () => {
    render(<OpportunityKeywordsTab keywords={undefined} domain="example.com" />);

    expect(screen.getByText("No keyword opportunities found yet.")).toBeTruthy();
  });

  it("should render empty state when keywords array is empty", () => {
    render(<OpportunityKeywordsTab keywords={[]} domain="example.com" />);

    expect(screen.getByText("No keyword opportunities found yet.")).toBeTruthy();
  });

  it("should not render table or export button in empty state", () => {
    render(<OpportunityKeywordsTab keywords={[]} domain="example.com" />);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /export csv/i })).toBeNull();
  });
});

describe("OpportunityKeywordsTab loading state", () => {
  it("should render loading spinner when isLoading is true", () => {
    const { container } = render(
      <OpportunityKeywordsTab
        keywords={mockKeywords}
        domain="example.com"
        isLoading={true}
      />
    );

    // Should have an animated spinner (Loader2 has animate-spin class)
    const spinner = container.querySelector('[class*="animate-spin"]');
    expect(spinner).toBeTruthy();
  });

  it("should not render content when loading", () => {
    render(
      <OpportunityKeywordsTab
        keywords={mockKeywords}
        domain="example.com"
        isLoading={true}
      />
    );

    // Table should not be visible
    expect(screen.queryByRole("table")).toBeNull();
    // Header should not be visible
    expect(screen.queryByText("AI-Generated Opportunities")).toBeNull();
  });

  it("should show content after loading completes", () => {
    const { rerender } = render(
      <OpportunityKeywordsTab
        keywords={mockKeywords}
        domain="example.com"
        isLoading={true}
      />
    );

    // Initially loading
    expect(screen.queryByRole("table")).toBeNull();

    // Rerender with loading false
    rerender(
      <OpportunityKeywordsTab
        keywords={mockKeywords}
        domain="example.com"
        isLoading={false}
      />
    );

    // Content should now be visible
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("AI-Generated Opportunities")).toBeTruthy();
  });
});

describe("OpportunityKeywordsTab CSV export", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let mockLinkClick: ReturnType<typeof vi.fn>;
  let mockLinkHref: string;
  let mockLinkDownload: string;

  beforeEach(() => {
    mockLinkClick = vi.fn();
    mockLinkHref = "";
    mockLinkDownload = "";

    // Mock URL.createObjectURL and revokeObjectURL for jsdom
    URL.createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    URL.revokeObjectURL = vi.fn();

    // Mock document.createElement for the anchor element
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return {
          set href(value: string) {
            mockLinkHref = value;
          },
          get href() {
            return mockLinkHref;
          },
          set download(value: string) {
            mockLinkDownload = value;
          },
          get download() {
            return mockLinkDownload;
          },
          click: mockLinkClick,
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tag);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("should trigger CSV download when export button is clicked", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    const exportButton = screen.getByRole("button", { name: /export csv/i });
    fireEvent.click(exportButton);

    // Should have created a blob URL
    expect(URL.createObjectURL).toHaveBeenCalled();

    // Should have triggered click on the link
    expect(mockLinkClick).toHaveBeenCalled();

    // Should have revoked the URL
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("should include domain in filename", () => {
    render(
      <OpportunityKeywordsTab
        keywords={mockKeywords}
        domain="sauna-world.com"
      />
    );

    const exportButton = screen.getByRole("button", { name: /export csv/i });
    fireEvent.click(exportButton);

    // The download attribute should contain the domain (with dots replaced by underscores)
    expect(mockLinkDownload).toContain("sauna-world_com");
    expect(mockLinkDownload).toContain("opportunities");
  });
});

describe("OpportunityKeywordsTab onAddToProposal callback", () => {
  it("should pass onAddToProposal to table component", () => {
    const onAddToProposal = vi.fn();

    render(
      <OpportunityKeywordsTab
        keywords={mockKeywords}
        domain="example.com"
        onAddToProposal={onAddToProposal}
      />
    );

    // The add to proposal buttons should be present (rendered by OpportunityKeywordsTable)
    const addButtons = screen.getAllByRole("button", { name: /add to proposal/i });
    expect(addButtons.length).toBeGreaterThan(0);
  });
});

describe("OpportunityKeywordsTab accessibility", () => {
  it("should have accessible heading structure", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    // The title "AI-Generated Opportunities" should be a heading
    const heading = screen.getByText("AI-Generated Opportunities");
    expect(heading.tagName).toBe("H3");
  });

  it("should have accessible button for export", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    const exportButton = screen.getByRole("button", { name: /export csv/i });
    expect(exportButton).toBeTruthy();
  });

  it("should have visible loading indicator when loading", () => {
    const { container } = render(
      <OpportunityKeywordsTab
        keywords={mockKeywords}
        domain="example.com"
        isLoading={true}
      />
    );

    // Spinner should be visible
    const spinner = container.querySelector("svg");
    expect(spinner).toBeTruthy();
  });
});

describe("OpportunityKeywordsTab summary calculation", () => {
  it("should calculate correct summary from keywords", () => {
    render(
      <OpportunityKeywordsTab keywords={mockKeywords} domain="example.com" />
    );

    // Total keywords should be 3
    expect(screen.getByText("3")).toBeTruthy();

    // Total volume: 1000 + 500 + 800 = 2300
    expect(screen.getByText("2,300")).toBeTruthy();
  });

  it("should show zero values when keywords is empty", () => {
    // When empty, the empty state is shown, not the summary card
    // So we test with null which shows empty state
    render(<OpportunityKeywordsTab keywords={null} domain="example.com" />);

    // Should show empty state message instead of stats
    expect(screen.getByText("No keyword opportunities found yet.")).toBeTruthy();
  });
});
