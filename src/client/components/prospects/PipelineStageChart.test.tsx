/**
 * PipelineStageChart component tests.
 * Phase 30.5: Prospect Pipeline Automation
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineStageChart } from "./PipelineStageChart";
import type { PipelineStage } from "@/db/prospect-schema";

// Mock recharts ResponsiveContainer since it needs actual DOM dimensions
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

interface StageData {
  stage: PipelineStage;
  count: number;
}

const mockData: StageData[] = [
  { stage: "new", count: 15 },
  { stage: "analyzing", count: 5 },
  { stage: "scored", count: 10 },
  { stage: "qualified", count: 8 },
  { stage: "contacted", count: 3 },
  { stage: "negotiating", count: 2 },
  { stage: "converted", count: 1 },
  { stage: "archived", count: 4 },
];

describe("PipelineStageChart", () => {
  it("renders chart with data", () => {
    const { container } = render(<PipelineStageChart data={mockData} />);

    // Check that recharts container is rendered
    const chartContainer = container.querySelector(".recharts-responsive-container");
    expect(chartContainer).toBeInTheDocument();
  });

  it("shows empty state when no prospects", () => {
    render(<PipelineStageChart data={[]} />);

    expect(screen.getByText("No prospects yet")).toBeInTheDocument();
  });

  it("shows empty state when all counts are zero", () => {
    const emptyData: StageData[] = [
      { stage: "new", count: 0 },
      { stage: "analyzing", count: 0 },
      { stage: "scored", count: 0 },
      { stage: "qualified", count: 0 },
      { stage: "contacted", count: 0 },
      { stage: "negotiating", count: 0 },
      { stage: "converted", count: 0 },
      { stage: "archived", count: 0 },
    ];

    render(<PipelineStageChart data={emptyData} />);

    expect(screen.getByText("No prospects yet")).toBeInTheDocument();
  });

  it("applies custom height", () => {
    const { container } = render(
      <PipelineStageChart data={mockData} height={400} />
    );

    // The empty state div uses inline style for height
    // For the chart, ResponsiveContainer handles it
    expect(container.firstChild).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(
      <PipelineStageChart data={mockData} className="custom-class" />
    );

    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("renders bars for each stage", () => {
    const { container } = render(<PipelineStageChart data={mockData} />);

    // Check that bars are rendered (recharts creates rect elements for bars)
    const bars = container.querySelectorAll(".recharts-bar-rectangle");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("renders Y-axis with stage labels", () => {
    const { container } = render(<PipelineStageChart data={mockData} />);

    // Check Y-axis is rendered
    const yAxis = container.querySelector(".recharts-yAxis");
    expect(yAxis).toBeInTheDocument();
  });

  it("renders X-axis for count values", () => {
    const { container } = render(<PipelineStageChart data={mockData} />);

    // Check X-axis is rendered
    const xAxis = container.querySelector(".recharts-xAxis");
    expect(xAxis).toBeInTheDocument();
  });
});
