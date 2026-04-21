/**
 * Tests for StickyCtaButton component.
 * Phase 30: Interactive Proposal Page
 *
 * Tests sticky call-to-action button behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StickyCtaButton } from "./StickyCtaButton";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      ...props
    }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className} data-testid="motion-wrapper" {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock the Button component
vi.mock("@/client/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    size,
    className,
    style,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    size?: string;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-size={size}
      className={className}
      style={style}
      data-testid="cta-button"
    >
      {children}
    </button>
  ),
}));

// Mock cn utility
vi.mock("@/client/lib/utils", () => ({
  cn: (...classes: (string | undefined | false | null)[]) =>
    classes.filter(Boolean).join(" "),
}));

describe("StickyCtaButton", () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("visibility", () => {
    it("should render when isVisible is true", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      expect(screen.getByTestId("cta-button")).toBeTruthy();
    });

    it("should not render when isVisible is false", () => {
      render(<StickyCtaButton isVisible={false} onClick={mockOnClick} />);
      expect(screen.queryByTestId("cta-button")).toBeNull();
    });

    it("should toggle visibility correctly", () => {
      const { rerender } = render(
        <StickyCtaButton isVisible={false} onClick={mockOnClick} />
      );
      expect(screen.queryByTestId("cta-button")).toBeNull();

      rerender(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      expect(screen.getByTestId("cta-button")).toBeTruthy();

      rerender(<StickyCtaButton isVisible={false} onClick={mockOnClick} />);
      expect(screen.queryByTestId("cta-button")).toBeNull();
    });
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      expect(screen.getByTestId("motion-wrapper")).toBeTruthy();
    });

    it("should render default label", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      expect(screen.getByText("Sutinku su pasiulymu")).toBeTruthy();
    });

    it("should render custom label", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          label="Accept Proposal"
        />
      );
      expect(screen.getByText("Accept Proposal")).toBeTruthy();
    });

    it("should apply custom className", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          className="custom-sticky"
        />
      );
      const wrapper = screen.getByTestId("motion-wrapper");
      expect(wrapper.className).toContain("custom-sticky");
    });

    it("should render Button with lg size", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      const button = screen.getByTestId("cta-button");
      expect(button.getAttribute("data-size")).toBe("lg");
    });
  });

  describe("interaction", () => {
    it("should call onClick when button is clicked", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      fireEvent.click(screen.getByTestId("cta-button"));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it("should not call onClick when disabled", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          isLoading={true}
        />
      );
      fireEvent.click(screen.getByTestId("cta-button"));
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("should show loading spinner when isLoading is true", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          isLoading={true}
        />
      );
      expect(screen.getByText("Palaukite...")).toBeTruthy();
    });

    it("should show label when not loading", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          isLoading={false}
        />
      );
      expect(screen.getByText("Sutinku su pasiulymu")).toBeTruthy();
      expect(screen.queryByText("Palaukite...")).toBeNull();
    });

    it("should disable button when loading", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          isLoading={true}
        />
      );
      const button = screen.getByTestId("cta-button");
      expect(button.hasAttribute("disabled")).toBe(true);
    });

    it("should not disable button when not loading", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          isLoading={false}
        />
      );
      const button = screen.getByTestId("cta-button");
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("should render SVG spinner when loading", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          isLoading={true}
        />
      );
      const spinner = document.querySelector("svg.animate-spin");
      expect(spinner).toBeTruthy();
    });
  });

  describe("primaryColor prop", () => {
    it("should apply custom primaryColor to button style", () => {
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          primaryColor="#ff5500"
        />
      );
      const button = screen.getByTestId("cta-button");
      expect(button.style.backgroundColor).toBe("rgb(255, 85, 0)");
      expect(button.style.color).toBe("white");
    });

    it("should not apply custom style when primaryColor is not provided", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      const button = screen.getByTestId("cta-button");
      expect(button.style.backgroundColor).toBe("");
    });
  });

  describe("default props", () => {
    it("should use default label of 'Sutinku su pasiulymu'", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      expect(screen.getByText("Sutinku su pasiulymu")).toBeTruthy();
    });

    it("should default isLoading to false", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      const button = screen.getByTestId("cta-button");
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(screen.queryByText("Palaukite...")).toBeNull();
    });
  });

  describe("layout classes", () => {
    it("should have fixed positioning", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      const wrapper = screen.getByTestId("motion-wrapper");
      expect(wrapper.className).toContain("fixed");
    });

    it("should have bottom-0 for mobile positioning", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      const wrapper = screen.getByTestId("motion-wrapper");
      expect(wrapper.className).toContain("bottom-0");
    });

    it("should have z-50 for proper stacking", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      const wrapper = screen.getByTestId("motion-wrapper");
      expect(wrapper.className).toContain("z-50");
    });
  });

  describe("animation props", () => {
    it("should render within AnimatePresence", () => {
      render(<StickyCtaButton isVisible={true} onClick={mockOnClick} />);
      // AnimatePresence is mocked to render children directly
      expect(screen.getByTestId("motion-wrapper")).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle empty label", () => {
      render(
        <StickyCtaButton isVisible={true} onClick={mockOnClick} label="" />
      );
      const button = screen.getByTestId("cta-button");
      expect(button.textContent).toBe("");
    });

    it("should handle long label text", () => {
      const longLabel =
        "This is a very long call to action button label that might wrap";
      render(
        <StickyCtaButton
          isVisible={true}
          onClick={mockOnClick}
          label={longLabel}
        />
      );
      expect(screen.getByText(longLabel)).toBeTruthy();
    });

    it("should handle rapid visibility changes", () => {
      const { rerender } = render(
        <StickyCtaButton isVisible={true} onClick={mockOnClick} />
      );

      for (let i = 0; i < 5; i++) {
        rerender(
          <StickyCtaButton isVisible={i % 2 === 0} onClick={mockOnClick} />
        );
      }

      // Final state should be visible (4 is even)
      expect(screen.getByTestId("cta-button")).toBeTruthy();
    });
  });
});
