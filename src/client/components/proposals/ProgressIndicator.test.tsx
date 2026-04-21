/**
 * Tests for ProgressIndicator component.
 * Phase 30: Interactive Proposal Page
 *
 * Tests navigation dots for scrollytelling sections.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProgressIndicator } from "./ProgressIndicator";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      ...props
    }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    span: ({
      children,
      className,
      ...props
    }: React.PropsWithChildren<{ className?: string }>) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
}));

// Mock the cn utility
vi.mock("@/client/lib/utils", () => ({
  cn: (...classes: (string | undefined | false | null)[]) =>
    classes.filter(Boolean).join(" "),
}));

describe("ProgressIndicator", () => {
  const mockSections = [
    { id: "hero", label: "Intro" },
    { id: "current", label: "Current State" },
    { id: "opportunities", label: "Opportunities" },
    { id: "roi", label: "ROI" },
    { id: "investment", label: "Investment" },
    { id: "cta", label: "Get Started" },
  ];

  const mockOnSectionClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );
      expect(screen.getByRole("navigation")).toBeTruthy();
    });

    it("should render a button for each section", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(mockSections.length);
    });

    it("should have navigation landmark", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      const nav = screen.getByRole("navigation");
      expect(nav.getAttribute("aria-label")).toBe("Section navigation");
    });

    it("should apply custom className", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
          className="custom-indicator"
        />
      );

      const nav = screen.getByRole("navigation");
      expect(nav.className).toContain("custom-indicator");
    });
  });

  describe("accessibility", () => {
    it("should have aria-label on each button", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button, index) => {
        expect(button.getAttribute("aria-label")).toBe(
          `Go to ${mockSections[index].label}`
        );
      });
    });

    it("should mark active section with aria-current", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="current"
          onSectionClick={mockOnSectionClick}
        />
      );

      const buttons = screen.getAllByRole("button");
      const currentButton = buttons.find(
        (btn) => btn.getAttribute("aria-current") === "true"
      );
      expect(currentButton).toBeTruthy();
      expect(currentButton?.getAttribute("aria-label")).toBe(
        "Go to Current State"
      );
    });

    it("should not have aria-current on non-active sections", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      const buttons = screen.getAllByRole("button");
      // First button is active, others should not have aria-current
      buttons.slice(1).forEach((button) => {
        expect(button.getAttribute("aria-current")).toBeNull();
      });
    });
  });

  describe("interaction", () => {
    it("should call onSectionClick with section id when clicked", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[2]); // Click "opportunities"

      expect(mockOnSectionClick).toHaveBeenCalledWith("opportunities");
    });

    it("should call onSectionClick for each section", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      const buttons = screen.getAllByRole("button");

      buttons.forEach((button, index) => {
        fireEvent.click(button);
        expect(mockOnSectionClick).toHaveBeenCalledWith(mockSections[index].id);
      });

      expect(mockOnSectionClick).toHaveBeenCalledTimes(mockSections.length);
    });
  });

  describe("position prop", () => {
    it("should default to right position", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      const nav = screen.getByRole("navigation");
      expect(nav.className).toContain("right-6");
    });

    it("should apply left position when specified", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
          position="left"
        />
      );

      const nav = screen.getByRole("navigation");
      expect(nav.className).toContain("left-6");
    });

    it("should apply right position when specified", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
          position="right"
        />
      );

      const nav = screen.getByRole("navigation");
      expect(nav.className).toContain("right-6");
    });
  });

  describe("active section styling", () => {
    it("should update when activeSection changes", () => {
      const { rerender } = render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      let buttons = screen.getAllByRole("button");
      expect(buttons[0].getAttribute("aria-current")).toBe("true");
      expect(buttons[1].getAttribute("aria-current")).toBeNull();

      rerender(
        <ProgressIndicator
          sections={mockSections}
          activeSection="current"
          onSectionClick={mockOnSectionClick}
        />
      );

      buttons = screen.getAllByRole("button");
      expect(buttons[0].getAttribute("aria-current")).toBeNull();
      expect(buttons[1].getAttribute("aria-current")).toBe("true");
    });
  });

  describe("labels", () => {
    it("should render label tooltips for each section", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="hero"
          onSectionClick={mockOnSectionClick}
        />
      );

      mockSections.forEach((section) => {
        expect(screen.getByText(section.label)).toBeTruthy();
      });
    });
  });

  describe("edge cases", () => {
    it("should handle single section", () => {
      render(
        <ProgressIndicator
          sections={[{ id: "only", label: "Only Section" }]}
          activeSection="only"
          onSectionClick={mockOnSectionClick}
        />
      );

      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("should handle empty sections array", () => {
      render(
        <ProgressIndicator
          sections={[]}
          activeSection=""
          onSectionClick={mockOnSectionClick}
        />
      );

      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });

    it("should handle activeSection not in sections list", () => {
      render(
        <ProgressIndicator
          sections={mockSections}
          activeSection="nonexistent"
          onSectionClick={mockOnSectionClick}
        />
      );

      const buttons = screen.getAllByRole("button");
      // No button should have aria-current
      buttons.forEach((button) => {
        expect(button.getAttribute("aria-current")).toBeNull();
      });
    });
  });
});
