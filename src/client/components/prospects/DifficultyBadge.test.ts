/**
 * Tests for DifficultyBadge utility functions
 * Phase 28: Keyword Gap Analysis UI
 *
 * Tests difficulty badge logic:
 * - 0-30: green (Easy)
 * - 31-60: yellow (Medium)
 * - 61-100: red (Hard)
 */
import { describe, it, expect } from "vitest";
import {
  getDifficultyLevel,
  getDifficultyConfig,
  type DifficultyLevel,
} from "./DifficultyBadge";

describe("getDifficultyLevel", () => {
  it("should return Easy for difficulty 0-30", () => {
    expect(getDifficultyLevel(0)).toBe("Easy");
    expect(getDifficultyLevel(15)).toBe("Easy");
    expect(getDifficultyLevel(30)).toBe("Easy");
  });

  it("should return Medium for difficulty 31-60", () => {
    expect(getDifficultyLevel(31)).toBe("Medium");
    expect(getDifficultyLevel(45)).toBe("Medium");
    expect(getDifficultyLevel(60)).toBe("Medium");
  });

  it("should return Hard for difficulty 61-100", () => {
    expect(getDifficultyLevel(61)).toBe("Hard");
    expect(getDifficultyLevel(80)).toBe("Hard");
    expect(getDifficultyLevel(100)).toBe("Hard");
  });

  it("should handle edge cases", () => {
    // Clamp to Easy for negative values
    expect(getDifficultyLevel(-10)).toBe("Easy");
    // Clamp to Hard for values over 100
    expect(getDifficultyLevel(150)).toBe("Hard");
  });

  it("should handle null/undefined difficulty gracefully", () => {
    // @ts-expect-error Testing runtime edge case
    expect(getDifficultyLevel(null)).toBe("Easy");
    // @ts-expect-error Testing runtime edge case
    expect(getDifficultyLevel(undefined)).toBe("Easy");
  });
});

describe("getDifficultyConfig", () => {
  it("should return green styling for Easy difficulty", () => {
    const config = getDifficultyConfig("Easy");
    expect(config.label).toBe("Easy");
    expect(config.className).toContain("bg-green");
    expect(config.className).toContain("text-green");
  });

  it("should return yellow/amber styling for Medium difficulty", () => {
    const config = getDifficultyConfig("Medium");
    expect(config.label).toBe("Medium");
    expect(config.className).toContain("bg-yellow");
    expect(config.className).toContain("text-yellow");
  });

  it("should return red styling for Hard difficulty", () => {
    const config = getDifficultyConfig("Hard");
    expect(config.label).toBe("Hard");
    expect(config.className).toContain("bg-red");
    expect(config.className).toContain("text-red");
  });
});

describe("DifficultyBadge integration", () => {
  it("should map difficulty value to correct config", () => {
    // Easy range
    const easyConfig = getDifficultyConfig(getDifficultyLevel(25));
    expect(easyConfig.label).toBe("Easy");

    // Medium range
    const mediumConfig = getDifficultyConfig(getDifficultyLevel(50));
    expect(mediumConfig.label).toBe("Medium");

    // Hard range
    const hardConfig = getDifficultyConfig(getDifficultyLevel(85));
    expect(hardConfig.label).toBe("Hard");
  });
});
