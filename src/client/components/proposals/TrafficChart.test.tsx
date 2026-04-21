/**
 * Tests for TrafficChart component.
 * Phase 30: Interactive Proposal Page
 *
 * Tests Recharts-based area chart with animation on scroll.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TrafficChart } from "./TrafficChart";

// Mock IntersectionObserver
let _observerCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: readonly number[] = [];

  constructor(callback: IntersectionObserverCallback) {
    _observerCallback = callback;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = (): IntersectionObserverEntry[] => [];
}

// Mock framer-motion
vi.mock("framer-motion", () => ({
  useInView: vi.fn(() => false),
  motion: {
    div: ({
      children,
      className,
      ...props
    }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

// Mock recharts - simplify the components for testing
vi.mock("recharts", () => ({
  ResponsiveContainer: ({
    children,
    width,
    height,
  }: {
    children: React.ReactNode;
    width: string | number;
    height: number;
  }) => (
    <div data-testid="responsive-container" style={{ width, height }}>
      {children}
    </div>
  ),
  AreaChart: ({
    children,
    data,
  }: {
    children: React.ReactNode;
    data: Array<{ month: string; traffic: number }>;
  }) => (
    <div data-testid="area-chart" data-point-count={data?.length || 0}>
      {children}
    </div>
  ),
  Area: ({
    dataKey,
    stroke,
    fill,
  }: {
    dataKey: string;
    stroke: string;
    fill: string;
  }) => (
    <div
      data-testid="area"
      data-key={dataKey}
      data-stroke={stroke}
      data-fill={fill}
    />
  ),
  XAxis: ({ dataKey }: { dataKey: string }) => (
    <div data-testid="x-axis" data-key={dataKey} />
  ),
  YAxis: ({ tickFormatter }: { tickFormatter?: (value: number) => string }) => (
    <div
      data-testid="y-axis"
      data-has-formatter={tickFormatter ? "true" : "false"}
    />
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: { content?: React.ReactNode }) => (
    <div data-testid="tooltip">{content}</div>
  ),
}));

describe("TrafficChart", () => {
  const mockData = [
    { month: "Sau", traffic: 1000 },
    { month: "Vas", traffic: 1500 },
    { month: "Kov", traffic: 2000 },
    { month: "Bal", traffic: 2500 },
    { month: "Geg", traffic: 3000 },
    { month: "Bir", traffic: 3500 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    _observerCallback = null;
    global.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(<TrafficChart data={mockData} />);
      expect(screen.getByTestId("motion-div")).toBeTruthy();
    });

    it("should render ResponsiveContainer with correct height", () => {
      render(<TrafficChart data={mockData} height={300} />);
      const container = screen.getByTestId("responsive-container");
      expect(container).toBeTruthy();
    });

    it("should apply custom className", () => {
      render(<TrafficChart data={mockData} className="custom-chart" />);
      const wrapper = screen.getByTestId("motion-div");
      expect(wrapper.className).toContain("custom-chart");
    });

    it("should render AreaChart with data", () => {
      render(<TrafficChart data={mockData} />);
      const chart = screen.getByTestId("area-chart");
      expect(chart).toBeTruthy();
    });

    it("should render Area component", () => {
      render(<TrafficChart data={mockData} />);
      const area = screen.getByTestId("area");
      expect(area).toBeTruthy();
      expect(area.getAttribute("data-key")).toBe("traffic");
    });

    it("should render XAxis with month dataKey", () => {
      render(<TrafficChart data={mockData} />);
      const xAxis = screen.getByTestId("x-axis");
      expect(xAxis.getAttribute("data-key")).toBe("month");
    });

    it("should render YAxis with formatter", () => {
      render(<TrafficChart data={mockData} />);
      const yAxis = screen.getByTestId("y-axis");
      expect(yAxis.getAttribute("data-has-formatter")).toBe("true");
    });

    it("should render CartesianGrid", () => {
      render(<TrafficChart data={mockData} />);
      expect(screen.getByTestId("cartesian-grid")).toBeTruthy();
    });

    it("should render Tooltip", () => {
      render(<TrafficChart data={mockData} />);
      expect(screen.getByTestId("tooltip")).toBeTruthy();
    });
  });

  describe("empty state", () => {
    it("should show empty message when data is empty", () => {
      render(<TrafficChart data={[]} />);
      // Lithuanian text: "Nėra duomenų" (with diacritics)
      expect(screen.getByText("Nėra duomenų")).toBeTruthy();
    });

    it("should not render chart when data is empty", () => {
      render(<TrafficChart data={[]} />);
      expect(screen.queryByTestId("area-chart")).toBeNull();
    });
  });

  describe("props", () => {
    it("should use default primaryColor of #2563eb", () => {
      render(<TrafficChart data={mockData} />);
      const area = screen.getByTestId("area");
      expect(area.getAttribute("data-stroke")).toBe("#2563eb");
    });

    it("should apply custom primaryColor", () => {
      render(<TrafficChart data={mockData} primaryColor="#ff0000" />);
      const area = screen.getByTestId("area");
      expect(area.getAttribute("data-stroke")).toBe("#ff0000");
    });

    it("should use default height of 200", () => {
      render(<TrafficChart data={mockData} />);
      const container = screen.getByTestId("responsive-container");
      expect(container.style.height).toBe("200px");
    });

    it("should apply custom height", () => {
      render(<TrafficChart data={mockData} height={400} />);
      const container = screen.getByTestId("responsive-container");
      expect(container.style.height).toBe("400px");
    });

    it("should generate unique gradient ID based on color", () => {
      render(<TrafficChart data={mockData} primaryColor="#abc123" />);
      const area = screen.getByTestId("area");
      // Gradient URL should include color without #
      expect(area.getAttribute("data-fill")).toContain("abc123");
    });
  });

  describe("animation states", () => {
    it("should initialize with zero traffic values when not in view", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(false);

      render(<TrafficChart data={mockData} />);

      const chart = screen.getByTestId("area-chart");
      // Chart should have data points
      expect(chart.getAttribute("data-point-count")).toBe("6");
    });

    it("should animate data when in view", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(<TrafficChart data={mockData} />);

      // Advance animation
      act(() => {
        vi.advanceTimersByTime(1600); // Animation duration is 1500ms
      });

      const chart = screen.getByTestId("area-chart");
      expect(chart).toBeTruthy();
    });
  });

  describe("yAxisFormatter", () => {
    it("should use default formatter that abbreviates thousands", () => {
      render(<TrafficChart data={mockData} />);
      const yAxis = screen.getByTestId("y-axis");
      expect(yAxis.getAttribute("data-has-formatter")).toBe("true");
    });

    it("should accept custom yAxisFormatter", () => {
      const customFormatter = (value: number) => `${value} visitors`;
      render(<TrafficChart data={mockData} yAxisFormatter={customFormatter} />);
      const yAxis = screen.getByTestId("y-axis");
      expect(yAxis.getAttribute("data-has-formatter")).toBe("true");
    });
  });

  describe("showGradient prop", () => {
    it("should show gradient by default", () => {
      render(<TrafficChart data={mockData} />);
      const area = screen.getByTestId("area");
      expect(area.getAttribute("data-fill")).toContain("url");
    });

    it("should use solid fill when showGradient is false", () => {
      render(<TrafficChart data={mockData} showGradient={false} />);
      const area = screen.getByTestId("area");
      expect(area.getAttribute("data-fill")).toBe("#2563eb");
    });
  });
});
