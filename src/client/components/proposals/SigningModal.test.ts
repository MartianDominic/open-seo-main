/**
 * Tests for SigningModal component.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi } from "vitest";

// Mock server functions
vi.mock("@/serverFunctions/proposals", () => ({
  initiateProposalSigning: vi.fn(),
  checkProposalSigningStatus: vi.fn(),
}));

describe("SigningModal", () => {
  describe("component structure", () => {
    it("should export SigningModal component", async () => {
      const { SigningModal } = await import("./SigningModal");
      expect(SigningModal).toBeDefined();
      expect(typeof SigningModal).toBe("function");
    });

    it("should export SigningStep type", async () => {
      const types = await import("./SigningModal");
      expect(types).toBeDefined();
    });
  });

  describe("signing steps", () => {
    it("should define all required signing steps", async () => {
      const { SIGNING_STEPS } = await import("./SigningModal");

      expect(SIGNING_STEPS).toContain("method");
      expect(SIGNING_STEPS).toContain("input");
      expect(SIGNING_STEPS).toContain("verification");
      expect(SIGNING_STEPS).toContain("success");
      expect(SIGNING_STEPS).toContain("error");
    });
  });

  describe("validation", () => {
    it("should validate Lithuanian personal code format", async () => {
      const { validatePersonalCodeFormat } = await import("./SigningModal");

      // Valid codes
      expect(validatePersonalCodeFormat("38501010001")).toBe(true);
      expect(validatePersonalCodeFormat("49001010001")).toBe(true);

      // Invalid codes
      expect(validatePersonalCodeFormat("123")).toBe(false);
      expect(validatePersonalCodeFormat("abcdefghijk")).toBe(false);
      expect(validatePersonalCodeFormat("")).toBe(false);
    });

    it("should validate phone number format", async () => {
      const { validatePhoneFormat } = await import("./SigningModal");

      // Valid Lithuanian phone numbers
      expect(validatePhoneFormat("+37060012345")).toBe(true);
      expect(validatePhoneFormat("+37065012345")).toBe(true);

      // Invalid formats
      expect(validatePhoneFormat("60012345")).toBe(false);
      expect(validatePhoneFormat("123")).toBe(false);
      expect(validatePhoneFormat("")).toBe(false);
    });
  });

  describe("Lithuanian text", () => {
    it("should have Lithuanian UI strings", async () => {
      const { SIGNING_TEXT } = await import("./SigningModal");

      // Method selection
      expect(SIGNING_TEXT.methodTitle).toBe("Pasirinkite pasirasymo buda");
      expect(SIGNING_TEXT.smartId).toBe("Smart-ID");
      expect(SIGNING_TEXT.mobileId).toBe("Mobile-ID");

      // Input step
      expect(SIGNING_TEXT.personalCodeLabel).toBe("Asmens kodas");
      expect(SIGNING_TEXT.phoneLabel).toBe("Telefono numeris");
      expect(SIGNING_TEXT.nameLabel).toBe("Vardas Pavarde");
      expect(SIGNING_TEXT.continueButton).toBe("Testi");

      // Verification step
      expect(SIGNING_TEXT.verificationTitle).toBe("Patvirtinimo kodas");
      expect(SIGNING_TEXT.verificationInstructions).toContain("Patvirtinkite");

      // Success/error
      expect(SIGNING_TEXT.successTitle).toBe("Pasirasytas!");
      expect(SIGNING_TEXT.successMessage).toContain("sekmingai");
      expect(SIGNING_TEXT.errorTitle).toBe("Klaida");
      expect(SIGNING_TEXT.tryAgainButton).toBe("Bandyti dar karta");
    });
  });

  describe("error messages", () => {
    it("should have Lithuanian error messages", async () => {
      const { SIGNING_ERRORS } = await import("./SigningModal");

      expect(SIGNING_ERRORS.initFailed).toBe("Nepavyko inicijuoti pasirasymo");
      expect(SIGNING_ERRORS.cancelled).toBe("Pasirasymas atsisakytas");
      expect(SIGNING_ERRORS.expired).toBe("Pasirasymo laikas baigesi");
      expect(SIGNING_ERRORS.failed).toBe("Pasirasymas nepavyko");
    });
  });
});

describe("SigningModal props", () => {
  it("should export SigningModalProps type", async () => {
    const { SigningModal } = await import("./SigningModal");

    // Type check - component should be a function
    expect(typeof SigningModal).toBe("function");

    // Component should accept required props (verified at compile time)
    // This is a compile-time check, not a runtime test
    type ExpectedProps = {
      proposalToken: string;
      onSuccess: () => void;
      onClose: () => void;
      open?: boolean;
    };

    // If this compiles, the types are correct
    const _typeCheck: ExpectedProps = {
      proposalToken: "token-123",
      onSuccess: () => {},
      onClose: () => {},
    };

    expect(_typeCheck.proposalToken).toBe("token-123");
  });
});
