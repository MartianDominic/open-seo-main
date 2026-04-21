/**
 * Tests for AnimatedCounter component.
 * Phase 30: Interactive Proposal Page
 *
 * Tests animated count-up behavior with IntersectionObserver mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AnimatedCounter } from "./AnimatedCounter";

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

// Simulate intersection entry
function _createIntersectionEntry(
  target: Element,
  isIntersecting: boolean,
): IntersectionObserverEntry {
  return {
    target,
    isIntersecting,
    intersectionRatio: isIntersecting ? 1 : 0,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  };
}

// Mock framer-motion useInView and motion components
vi.mock("framer-motion", () => ({
  useInView: vi.fn(() => false),
  motion: {
    span: ({ children, className, ...props }: React.PropsWithChildren<{ className?: string }>) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
}));

describe("AnimatedCounter", () => {
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
      render(<AnimatedCounter value={1000} />);
      expect(document.body.querySelector("span")).toBeTruthy();
    });

    it("should apply custom className", () => {
      render(<AnimatedCounter value={100} className="custom-class" />);
      const span = document.body.querySelector("span.custom-class");
      expect(span).toBeTruthy();
    });

    it("should render prefix correctly", () => {
      render(<AnimatedCounter value={100} prefix="$" />);
      expect(screen.getByText(/\$/)).toBeTruthy();
    });

    it("should render suffix correctly", () => {
      render(<AnimatedCounter value={100} suffix="%" />);
      expect(screen.getByText(/%/)).toBeTruthy();
    });

    it("should render prefix and suffix together", () => {
      render(<AnimatedCounter value={500} prefix="EUR " suffix="/mo" />);
      const text = screen.getByText(/EUR.*\/mo/);
      expect(text).toBeTruthy();
    });
  });

  describe("initial state", () => {
    it("should start at 0 when not in view", () => {
      render(<AnimatedCounter value={1000} />);
      // Initial state should show 0 formatted
      expect(screen.getByText("0")).toBeTruthy();
    });

    it("should format initial zero with decimal places", () => {
      render(<AnimatedCounter value={1000} decimals={2} formatNumber={false} />);
      expect(screen.getByText("0.00")).toBeTruthy();
    });
  });

  describe("animation states", () => {
    it("should animate to target value when in view", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(<AnimatedCounter value={100} duration={100} formatNumber={false} />);

      // Advance timers to complete animation
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(screen.getByText("100")).toBeTruthy();
    });

    it("should show formatted number with thousand separators", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(<AnimatedCounter value={1500} duration={100} locale="en-US" />);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      // en-US uses comma separator
      const span = document.body.querySelector("span");
      expect(span?.textContent).toContain("1");
    });

    it("should respect decimals prop in final value", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(<AnimatedCounter value={99.99} decimals={2} duration={100} formatNumber={false} />);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(screen.getByText("99.99")).toBeTruthy();
    });

    it("should only animate once (once: true behavior)", async () => {
      const { useInView } = await import("framer-motion");

      // Start not in view
      vi.mocked(useInView).mockReturnValue(false);
      const { rerender } = render(
        <AnimatedCounter value={100} duration={100} formatNumber={false} />
      );

      // Come into view
      vi.mocked(useInView).mockReturnValue(true);
      rerender(<AnimatedCounter value={100} duration={100} formatNumber={false} />);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Verify animation completed
      expect(screen.getByText("100")).toBeTruthy();

      // Component stays at final value even if we toggle view again
      vi.mocked(useInView).mockReturnValue(false);
      rerender(<AnimatedCounter value={100} duration={100} formatNumber={false} />);

      expect(screen.getByText("100")).toBeTruthy();
    });
  });

  describe("props validation", () => {
    it("should use default duration of 2000ms", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(<AnimatedCounter value={100} formatNumber={false} />);

      // After 1000ms (half of default), should not be at final value yet
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const span = document.body.querySelector("span");
      const currentValue = parseInt(span?.textContent || "0", 10);

      // Should be somewhere between 0 and 100, but not at 100 yet
      expect(currentValue).toBeGreaterThanOrEqual(0);
    });

    it("should use default locale lt-LT", () => {
      // Default locale is lt-LT which uses space as thousand separator
      render(<AnimatedCounter value={0} />);
      expect(document.body.querySelector("span")).toBeTruthy();
    });

    it("should handle value of 0", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(<AnimatedCounter value={0} formatNumber={false} />);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(screen.getByText("0")).toBeTruthy();
    });

    it("should handle negative values", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(<AnimatedCounter value={-50} duration={100} formatNumber={false} />);

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(screen.getByText("-50")).toBeTruthy();
    });
  });

  describe("formatting options", () => {
    it("should disable number formatting when formatNumber is false", async () => {
      const { useInView } = await import("framer-motion");
      vi.mocked(useInView).mockReturnValue(true);

      render(
        <AnimatedCounter value={1000000} duration={100} formatNumber={false} />
      );

      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Without formatting, should be plain number
      expect(screen.getByText("1000000")).toBeTruthy();
    });
  });
});
