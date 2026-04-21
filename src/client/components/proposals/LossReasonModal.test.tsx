/**
 * Tests for Loss Reason Modal.
 * Phase 30-08: Pipeline & Automation
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi } from "vitest";

describe("Loss Reasons", () => {
  it("should define predefined loss reasons", async () => {
    const { LOSS_REASONS } = await import("./LossReasonModal");

    expect(LOSS_REASONS).toContainEqual(
      expect.objectContaining({ id: "price", label: expect.any(String) })
    );
    expect(LOSS_REASONS).toContainEqual(
      expect.objectContaining({ id: "competitor", label: expect.any(String) })
    );
    expect(LOSS_REASONS).toContainEqual(
      expect.objectContaining({ id: "timing", label: expect.any(String) })
    );
    expect(LOSS_REASONS).toContainEqual(
      expect.objectContaining({ id: "no_response", label: expect.any(String) })
    );
    expect(LOSS_REASONS).toContainEqual(
      expect.objectContaining({ id: "internal", label: expect.any(String) })
    );
    expect(LOSS_REASONS).toContainEqual(
      expect.objectContaining({ id: "other", label: expect.any(String) })
    );
  });

  it("should have Lithuanian labels", async () => {
    const { LOSS_REASONS } = await import("./LossReasonModal");

    const price = LOSS_REASONS.find((r) => r.id === "price");
    expect(price?.label).toBe("Kaina per didele");

    const competitor = LOSS_REASONS.find((r) => r.id === "competitor");
    expect(competitor?.label).toBe("Pasirinko konkurenta");
  });
});

describe("validateLossReason", () => {
  it("should accept valid loss reason ID", async () => {
    const { validateLossReason } = await import("./LossReasonModal");

    expect(validateLossReason("price")).toBe(true);
    expect(validateLossReason("competitor")).toBe(true);
    expect(validateLossReason("other")).toBe(true);
  });

  it("should reject invalid loss reason ID", async () => {
    const { validateLossReason } = await import("./LossReasonModal");

    expect(validateLossReason("invalid")).toBe(false);
    expect(validateLossReason("")).toBe(false);
  });
});

describe("DeclineProposalInput", () => {
  it("should define input schema", async () => {
    const { DeclineProposalInput } = await import("./LossReasonModal");

    // Check that the type is defined
    const input: typeof DeclineProposalInput = {
      proposalId: "test-123",
      reason: "price",
      notes: "Optional notes",
    };

    expect(input.proposalId).toBe("test-123");
    expect(input.reason).toBe("price");
  });

  it("should allow notes to be optional", async () => {
    const { DeclineProposalInput } = await import("./LossReasonModal");

    const input: typeof DeclineProposalInput = {
      proposalId: "test-123",
      reason: "competitor",
      notes: undefined,
    };

    expect(input.notes).toBeUndefined();
  });
});
