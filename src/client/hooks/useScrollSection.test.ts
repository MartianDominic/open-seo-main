/**
 * Tests for useScrollSection hook.
 * Phase 30: Interactive Proposal Page
 *
 * TDD: Tests written FIRST before implementation.
 * Tests intersection observer behavior for scroll-triggered animations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

let observerCallback: IntersectionObserverCallback | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: readonly number[] = [];

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }

  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
  takeRecords = (): IntersectionObserverEntry[] => [];
}

// Simulate intersection entry
function createIntersectionEntry(
  target: Element,
  isIntersecting: boolean,
  ratio: number = 0,
): IntersectionObserverEntry {
  return {
    target,
    isIntersecting,
    intersectionRatio: ratio,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  };
}

describe("useScrollSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observerCallback = null;
    global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should return section refs for each section", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current", "opportunities", "roi", "investment", "cta"],
        }),
      );

      expect(result.current.sectionRefs).toBeDefined();
      expect(result.current.sectionRefs.current).toHaveProperty("hero");
      expect(result.current.sectionRefs.current).toHaveProperty("current");
      expect(result.current.sectionRefs.current).toHaveProperty("opportunities");
      expect(result.current.sectionRefs.current).toHaveProperty("roi");
      expect(result.current.sectionRefs.current).toHaveProperty("investment");
      expect(result.current.sectionRefs.current).toHaveProperty("cta");
    });

    it("should start with first section as active", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current", "opportunities"],
        }),
      );

      expect(result.current.activeSection).toBe("hero");
    });

    it("should provide visibility state for each section", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current"],
        }),
      );

      expect(result.current.visibleSections).toBeDefined();
      expect(typeof result.current.visibleSections.hero).toBe("boolean");
      expect(typeof result.current.visibleSections.current).toBe("boolean");
    });
  });

  describe("intersection observer behavior", () => {
    it("should create IntersectionObserver on mount", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current"],
        }),
      );

      expect(observerCallback).toBeDefined();
    });

    it("should observe all section elements when refs are set", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current"],
        }),
      );

      // Simulate setting refs
      const mockElement = document.createElement("div");
      result.current.sectionRefs.current.hero = mockElement;

      // Trigger observer attachment
      act(() => {
        result.current.observeSection("hero");
      });

      expect(mockObserve).toHaveBeenCalledWith(mockElement);
    });

    it("should update activeSection when section comes into view", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current", "opportunities"],
        }),
      );

      const mockElement = document.createElement("div");
      mockElement.setAttribute("data-section", "current");

      // Simulate intersection
      act(() => {
        if (observerCallback) {
          observerCallback(
            [createIntersectionEntry(mockElement, true, 0.6)],
            {} as IntersectionObserver,
          );
        }
      });

      expect(result.current.activeSection).toBe("current");
    });

    it("should update visibleSections when sections enter/exit viewport", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current"],
        }),
      );

      const heroElement = document.createElement("div");
      heroElement.setAttribute("data-section", "hero");

      // Section enters viewport
      act(() => {
        if (observerCallback) {
          observerCallback(
            [createIntersectionEntry(heroElement, true, 0.5)],
            {} as IntersectionObserver,
          );
        }
      });

      expect(result.current.visibleSections.hero).toBe(true);

      // Section exits viewport
      act(() => {
        if (observerCallback) {
          observerCallback(
            [createIntersectionEntry(heroElement, false, 0)],
            {} as IntersectionObserver,
          );
        }
      });

      expect(result.current.visibleSections.hero).toBe(false);
    });
  });

  describe("scrollToSection", () => {
    it("should provide scrollToSection function", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current"],
        }),
      );

      expect(typeof result.current.scrollToSection).toBe("function");
    });

    it("should scroll to section element smoothly", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current"],
        }),
      );

      const mockElement = document.createElement("div");
      mockElement.scrollIntoView = vi.fn();
      result.current.sectionRefs.current.current = mockElement;

      act(() => {
        result.current.scrollToSection("current");
      });

      expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  describe("cleanup", () => {
    it("should disconnect observer on unmount", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { unmount } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero", "current"],
        }),
      );

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("threshold configuration", () => {
    it("should use default threshold of 0.5", async () => {
      const { useScrollSection, DEFAULT_THRESHOLD } = await import("./useScrollSection");

      expect(DEFAULT_THRESHOLD).toBe(0.5);
    });

    it("should accept custom threshold option", async () => {
      const { useScrollSection } = await import("./useScrollSection");
      const { result } = renderHook(() =>
        useScrollSection({
          sectionIds: ["hero"],
          threshold: 0.3,
        }),
      );

      expect(result.current).toBeDefined();
      // Threshold is passed to IntersectionObserver internally
    });
  });
});
