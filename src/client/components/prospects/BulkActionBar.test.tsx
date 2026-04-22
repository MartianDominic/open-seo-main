/**
 * BulkActionBar component tests.
 * Phase 30.5: Prospect Pipeline Automation
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkActionBar } from "./BulkActionBar";
import type { ProspectSelect } from "@/db/prospect-schema";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock server functions
vi.mock("@/serverFunctions/prospects", () => ({
  bulkAnalyzeProspects: vi.fn().mockResolvedValue({ queuedCount: 2 }),
  bulkArchiveProspects: vi.fn().mockResolvedValue({ archived: 2 }),
}));

// Mock CSV utils
vi.mock("@/client/lib/csv", () => ({
  buildCsv: vi.fn().mockReturnValue("domain,companyName\nexample.com,Example"),
  downloadCsv: vi.fn(),
}));

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

describe("BulkActionBar", () => {
  it("renders selection count", () => {
    const onClear = vi.fn();
    const onActionComplete = vi.fn();

    render(
      <BulkActionBar
        selectedProspects={mockProspects}
        remainingQuota={10}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />
    );

    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("renders all action buttons", () => {
    const onClear = vi.fn();
    const onActionComplete = vi.fn();

    render(
      <BulkActionBar
        selectedProspects={mockProspects}
        remainingQuota={10}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />
    );

    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("Archive")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("does not render when no prospects selected", () => {
    const onClear = vi.fn();
    const onActionComplete = vi.fn();

    const { container } = render(
      <BulkActionBar
        selectedProspects={[]}
        remainingQuota={10}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />
    );

    expect(container.querySelector(".fixed")).toBeNull();
  });

  it("disables analyze button when quota is 0", () => {
    const onClear = vi.fn();
    const onActionComplete = vi.fn();

    render(
      <BulkActionBar
        selectedProspects={mockProspects}
        remainingQuota={0}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />
    );

    const analyzeButton = screen.getByText("Analyze").closest("button");
    expect(analyzeButton).toBeDisabled();
  });

  it("shows quota warning when quota is less than selected count", () => {
    const onClear = vi.fn();
    const onActionComplete = vi.fn();

    render(
      <BulkActionBar
        selectedProspects={mockProspects}
        remainingQuota={1}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />
    );

    expect(screen.getByText(/Daily quota: 1 analyses remaining/)).toBeInTheDocument();
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    const onActionComplete = vi.fn();

    render(
      <BulkActionBar
        selectedProspects={mockProspects}
        remainingQuota={10}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />
    );

    // Find and click the X button (clear)
    const clearButton = screen.getByRole("button", { name: "" });
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalled();
  });

  it("calls downloadCsv when export is clicked", async () => {
    const onClear = vi.fn();
    const onActionComplete = vi.fn();
    const { downloadCsv } = await import("@/client/lib/csv");

    render(
      <BulkActionBar
        selectedProspects={mockProspects}
        remainingQuota={10}
        onClear={onClear}
        onActionComplete={onActionComplete}
      />
    );

    fireEvent.click(screen.getByText("Export CSV"));

    expect(downloadCsv).toHaveBeenCalled();
  });
});
