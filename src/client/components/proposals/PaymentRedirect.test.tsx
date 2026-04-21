/**
 * Tests for PaymentRedirect component.
 * Phase 30-06: Payment (Stripe)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PaymentRedirect } from "./PaymentRedirect";

// Mock server function
vi.mock("@/serverFunctions/proposals", () => ({
  createProposalPayment: vi.fn(),
}));

describe("PaymentRedirect", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "", reload: vi.fn() },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("should show loading state while redirecting", async () => {
    const { createProposalPayment } = await import("@/serverFunctions/proposals");
    vi.mocked(createProposalPayment).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<PaymentRedirect token="test-token" />);

    expect(screen.getByText(/nukreipiame/i)).toBeTruthy();
  });

  it("should redirect to checkout URL on success", async () => {
    const { createProposalPayment } = await import("@/serverFunctions/proposals");
    vi.mocked(createProposalPayment).mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/test",
    });

    render(<PaymentRedirect token="test-token" />);

    await waitFor(() => {
      expect(window.location.href).toBe("https://checkout.stripe.com/test");
    });
  });

  it("should call createProposalPayment with correct token", async () => {
    const { createProposalPayment } = await import("@/serverFunctions/proposals");
    vi.mocked(createProposalPayment).mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/test",
    });

    render(<PaymentRedirect token="my-proposal-token" />);

    await waitFor(() => {
      expect(createProposalPayment).toHaveBeenCalledWith({
        data: { token: "my-proposal-token" },
      });
    });
  });

  it("should show error state when payment fails", async () => {
    const { createProposalPayment } = await import("@/serverFunctions/proposals");
    vi.mocked(createProposalPayment).mockRejectedValue(
      new Error("Payment failed")
    );

    const onError = vi.fn();
    render(<PaymentRedirect token="test-token" onError={onError} />);

    await waitFor(() => {
      expect(screen.getByText(/mokejimo klaida/i)).toBeTruthy();
      expect(screen.getByText(/Payment failed/i)).toBeTruthy();
    });

    expect(onError).toHaveBeenCalledWith("Payment failed");
  });

  it("should show retry button on error", async () => {
    const { createProposalPayment } = await import("@/serverFunctions/proposals");
    vi.mocked(createProposalPayment).mockRejectedValue(
      new Error("Network error")
    );

    render(<PaymentRedirect token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText(/bandyti dar karta/i)).toBeTruthy();
    });
  });
});
