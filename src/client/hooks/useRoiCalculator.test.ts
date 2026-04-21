/**
 * Tests for useRoiCalculator hook.
 * Phase 30: Interactive Proposal Page
 *
 * TDD: Tests written FIRST before implementation.
 * Tests ROI calculator state management and calculations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("useRoiCalculator", () => {
  const defaultInitialData = {
    trafficGain: 1000,
    trafficValue: 5000,
    monthlyFee: 1500,
    defaultConversionRate: 2,
    defaultAov: 150,
  };

  describe("initialization", () => {
    it("should initialize with provided default values", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

      expect(result.current.conversionRate).toBe(2);
      expect(result.current.aov).toBe(150);
    });

    it("should use fallback defaults when not provided", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
        }),
      );

      expect(result.current.conversionRate).toBe(2);
      expect(result.current.aov).toBe(150);
    });
  });

  describe("state updates", () => {
    it("should update conversion rate", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

      act(() => {
        result.current.setConversionRate(3.5);
      });

      expect(result.current.conversionRate).toBe(3.5);
    });

    it("should update average order value", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

      act(() => {
        result.current.setAov(200);
      });

      expect(result.current.aov).toBe(200);
    });
  });

  describe("calculations", () => {
    it("should calculate projected conversions correctly", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
          defaultConversionRate: 2,
          defaultAov: 150,
        }),
      );

      // 1000 traffic * 2% conversion = 20 conversions
      expect(result.current.calculations.projectedConversions).toBe(20);
    });

    it("should calculate projected revenue correctly", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
          defaultConversionRate: 2,
          defaultAov: 150,
        }),
      );

      // 20 conversions * 150 AOV = 3000 revenue
      expect(result.current.calculations.projectedRevenue).toBe(3000);
    });

    it("should calculate ROI percentage correctly", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
          defaultConversionRate: 2,
          defaultAov: 150,
        }),
      );

      // ROI = ((3000 - 1500) / 1500) * 100 = 100%
      expect(result.current.calculations.roi).toBe(100);
    });

    it("should calculate payback months correctly", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
          defaultConversionRate: 2,
          defaultAov: 150,
        }),
      );

      // Payback = monthlyFee / (monthlyRevenue / 12) = 1500 / (3000/12) = 6 months
      expect(result.current.calculations.paybackMonths).toBe("6.0");
    });

    it("should recalculate when conversion rate changes", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

      const initialRevenue = result.current.calculations.projectedRevenue;

      act(() => {
        result.current.setConversionRate(4); // Double the conversion rate
      });

      // Revenue should double
      expect(result.current.calculations.projectedRevenue).toBe(initialRevenue * 2);
    });

    it("should recalculate when AOV changes", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

      const initialRevenue = result.current.calculations.projectedRevenue;

      act(() => {
        result.current.setAov(300); // Double the AOV
      });

      // Revenue should double
      expect(result.current.calculations.projectedRevenue).toBe(initialRevenue * 2);
    });

    it("should include traffic value in calculations", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
        }),
      );

      expect(result.current.calculations.trafficValue).toBe(5000);
    });
  });

  describe("resetToDefaults", () => {
    it("should reset to initial default values", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
          defaultConversionRate: 2,
          defaultAov: 150,
        }),
      );

      // Change values
      act(() => {
        result.current.setConversionRate(5);
        result.current.setAov(500);
      });

      expect(result.current.conversionRate).toBe(5);
      expect(result.current.aov).toBe(500);

      // Reset
      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.conversionRate).toBe(2);
      expect(result.current.aov).toBe(150);
    });

    it("should reset to fallback defaults when no custom defaults provided", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
        }),
      );

      act(() => {
        result.current.setConversionRate(10);
        result.current.setAov(1000);
      });

      act(() => {
        result.current.resetToDefaults();
      });

      // Should reset to fallback defaults (2% and 150)
      expect(result.current.conversionRate).toBe(2);
      expect(result.current.aov).toBe(150);
    });
  });

  describe("edge cases", () => {
    it("should handle zero traffic gain", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 0,
          trafficValue: 0,
          monthlyFee: 1500,
        }),
      );

      expect(result.current.calculations.projectedConversions).toBe(0);
      expect(result.current.calculations.projectedRevenue).toBe(0);
    });

    it("should handle zero monthly fee", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 0,
        }),
      );

      // ROI should be very high (infinite in theory, but we cap or handle it)
      expect(result.current.calculations.roi).toBeDefined();
    });

    it("should handle very small conversion rates", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
          defaultConversionRate: 0.1, // 0.1%
        }),
      );

      // 1000 * 0.1% = 1 conversion
      expect(result.current.calculations.projectedConversions).toBe(1);
    });

    it("should round conversions to whole numbers", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 100,
          trafficValue: 500,
          monthlyFee: 1500,
          defaultConversionRate: 3,
        }),
      );

      // 100 * 3% = 3 conversions (should be a whole number)
      expect(Number.isInteger(result.current.calculations.projectedConversions)).toBe(true);
    });

    it("should round revenue to whole numbers", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 100,
          trafficValue: 500,
          monthlyFee: 1500,
          defaultConversionRate: 3.33,
          defaultAov: 99.99,
        }),
      );

      expect(Number.isInteger(result.current.calculations.projectedRevenue)).toBe(true);
    });

    it("should round ROI to whole numbers", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() =>
        useRoiCalculator({
          trafficGain: 1000,
          trafficValue: 5000,
          monthlyFee: 1500,
        }),
      );

      expect(Number.isInteger(result.current.calculations.roi)).toBe(true);
    });
  });

  describe("industry defaults", () => {
    it("should provide industry default presets", async () => {
      const { INDUSTRY_DEFAULTS } = await import("./useRoiCalculator");

      expect(INDUSTRY_DEFAULTS).toBeDefined();
      expect(INDUSTRY_DEFAULTS.ecommerce).toBeDefined();
      expect(INDUSTRY_DEFAULTS.ecommerce.conversionRate).toBeDefined();
      expect(INDUSTRY_DEFAULTS.ecommerce.aov).toBeDefined();
    });

    it("should have presets for common industries", async () => {
      const { INDUSTRY_DEFAULTS } = await import("./useRoiCalculator");

      expect(INDUSTRY_DEFAULTS.ecommerce).toBeDefined();
      expect(INDUSTRY_DEFAULTS.saas).toBeDefined();
      expect(INDUSTRY_DEFAULTS.services).toBeDefined();
    });

    it("should provide applyIndustryDefaults function", async () => {
      const { useRoiCalculator } = await import("./useRoiCalculator");
      const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

      expect(typeof result.current.applyIndustryDefaults).toBe("function");
    });

    it("should apply industry defaults when called", async () => {
      const { useRoiCalculator, INDUSTRY_DEFAULTS } = await import("./useRoiCalculator");
      const { result } = renderHook(() => useRoiCalculator(defaultInitialData));

      act(() => {
        result.current.applyIndustryDefaults("ecommerce");
      });

      expect(result.current.conversionRate).toBe(INDUSTRY_DEFAULTS.ecommerce.conversionRate);
      expect(result.current.aov).toBe(INDUSTRY_DEFAULTS.ecommerce.aov);
    });
  });
});
