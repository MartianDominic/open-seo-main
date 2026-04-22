/**
 * ProspectsTable component tests.
 * Phase 30.5: Prospect Pipeline Automation
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProspectsTable } from "./ProspectsTable";
import type { ProspectSelect } from "@/db/prospect-schema";

const mockProspects: ProspectSelect[] = [
  {
    id: "prospect-1",
    workspaceId: "workspace-1",
    domain: "example.com",
    companyName: "Example Corp",
    contactEmail: "contact@example.com",
    contactName: "John Doe",
    industry: "Technology",
    notes: null,
    status: "new",
    source: "manual",
    assignedTo: null,
    convertedClientId: null,
    priorityScore: 75,
    pipelineStage: "qualified",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  {
    id: "prospect-2",
    workspaceId: "workspace-1",
    domain: "test.com",
    companyName: "Test Inc",
    contactEmail: null,
    contactName: null,
    industry: null,
    notes: null,
    status: "analyzing",
    source: "csv_import",
    assignedTo: null,
    convertedClientId: null,
    priorityScore: null,
    pipelineStage: "analyzing",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
  },
];

describe("ProspectsTable", () => {
  it("renders table with prospect data", () => {
    const onSelectionChange = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
      />
    );

    // Check headers
    expect(screen.getByText("Domain")).toBeInTheDocument();
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByText("Stage")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();

    // Check data rows
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("Example Corp")).toBeInTheDocument();
    expect(screen.getByText("test.com")).toBeInTheDocument();
    expect(screen.getByText("Test Inc")).toBeInTheDocument();
  });

  it("displays stage badges with correct labels", () => {
    const onSelectionChange = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByText("Kvalifikuotas")).toBeInTheDocument();
    expect(screen.getByText("Analizuojama")).toBeInTheDocument();
  });

  it("displays priority score with color coding", () => {
    const onSelectionChange = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
      />
    );

    // High score (75) should show green
    const scoreElement = screen.getByText("75");
    expect(scoreElement).toHaveClass("text-green-600");
  });

  it("shows checkboxes for row selection", () => {
    const onSelectionChange = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
      />
    );

    // Header checkbox + 2 row checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
  });

  it("calls onSelectionChange when rows are selected", () => {
    const onSelectionChange = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click the first row checkbox (index 1, as 0 is header)
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    // Should be called with the selected prospect ID
    expect(onSelectionChange).toHaveBeenCalledWith(["prospect-1"]);
  });

  it("selects all rows when header checkbox is clicked", () => {
    const onSelectionChange = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click header checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    // Should be called with all prospect IDs
    expect(onSelectionChange).toHaveBeenCalledWith(["prospect-1", "prospect-2"]);
  });

  it("shows empty state when no prospects", () => {
    const onSelectionChange = vi.fn();

    render(
      <ProspectsTable prospects={[]} onSelectionChange={onSelectionChange} />
    );

    expect(screen.getByText("No prospects found")).toBeInTheDocument();
  });

  it("calls onProspectClick when row is clicked", () => {
    const onSelectionChange = vi.fn();
    const onProspectClick = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
        onProspectClick={onProspectClick}
      />
    );

    // Click on the domain text (not checkbox)
    fireEvent.click(screen.getByText("example.com"));

    expect(onProspectClick).toHaveBeenCalledWith(mockProspects[0]);
  });

  it("does not trigger onProspectClick when checkbox is clicked", () => {
    const onSelectionChange = vi.fn();
    const onProspectClick = vi.fn();

    render(
      <ProspectsTable
        prospects={mockProspects}
        onSelectionChange={onSelectionChange}
        onProspectClick={onProspectClick}
      />
    );

    // Click the checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    expect(onProspectClick).not.toHaveBeenCalled();
  });
});
