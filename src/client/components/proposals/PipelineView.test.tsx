/**
 * Tests for Pipeline View (Kanban board).
 * Phase 30-08: Pipeline & Automation
 *
 * TDD: Tests written FIRST before implementation.
 * Tests the pure utility functions which don't require DnD library.
 */

import { describe, it, expect } from "vitest";

describe("Pipeline Stages", () => {
  it("should define all pipeline stages", async () => {
    const { PIPELINE_STAGES } = await import("./pipeline-utils");

    expect(PIPELINE_STAGES).toContainEqual(
      expect.objectContaining({ id: "draft", label: expect.any(String) })
    );
    expect(PIPELINE_STAGES).toContainEqual(
      expect.objectContaining({ id: "sent", label: expect.any(String) })
    );
    expect(PIPELINE_STAGES).toContainEqual(
      expect.objectContaining({ id: "viewed", label: expect.any(String) })
    );
    expect(PIPELINE_STAGES).toContainEqual(
      expect.objectContaining({ id: "accepted", label: expect.any(String) })
    );
    expect(PIPELINE_STAGES).toContainEqual(
      expect.objectContaining({ id: "signed", label: expect.any(String) })
    );
    expect(PIPELINE_STAGES).toContainEqual(
      expect.objectContaining({ id: "paid", label: expect.any(String) })
    );
  });

  it("should have Lithuanian labels for stages", async () => {
    const { PIPELINE_STAGES } = await import("./pipeline-utils");

    const draft = PIPELINE_STAGES.find((s) => s.id === "draft");
    expect(draft?.label).toBe("Juodrastis");

    const sent = PIPELINE_STAGES.find((s) => s.id === "sent");
    expect(sent?.label).toBe("Issiusta");

    const viewed = PIPELINE_STAGES.find((s) => s.id === "viewed");
    expect(viewed?.label).toBe("Perziureta");
  });

  it("should assign colors to each stage", async () => {
    const { PIPELINE_STAGES } = await import("./pipeline-utils");

    for (const stage of PIPELINE_STAGES) {
      expect(stage.color).toBeTruthy();
    }
  });
});

describe("Stage Transitions", () => {
  it("should define valid stage transitions", async () => {
    const { STAGE_TRANSITIONS } = await import("./pipeline-utils");

    expect(STAGE_TRANSITIONS.draft).toContain("sent");
    expect(STAGE_TRANSITIONS.sent).toContain("viewed");
    expect(STAGE_TRANSITIONS.viewed).toContain("accepted");
    expect(STAGE_TRANSITIONS.accepted).toContain("signed");
    expect(STAGE_TRANSITIONS.signed).toContain("paid");
  });

  it("should allow declined from most active stages", async () => {
    const { STAGE_TRANSITIONS } = await import("./pipeline-utils");

    expect(STAGE_TRANSITIONS.sent).toContain("declined");
    expect(STAGE_TRANSITIONS.viewed).toContain("declined");
    expect(STAGE_TRANSITIONS.accepted).toContain("declined");
  });

  it("should mark terminal stages with no transitions", async () => {
    const { STAGE_TRANSITIONS } = await import("./pipeline-utils");

    expect(STAGE_TRANSITIONS.onboarded).toEqual([]);
    expect(STAGE_TRANSITIONS.declined).toEqual([]);
  });
});

describe("groupProposalsByStage", () => {
  it("should group proposals by their status", async () => {
    const { groupProposalsByStage } = await import("./pipeline-utils");

    const proposals = [
      { id: "1", status: "draft" },
      { id: "2", status: "sent" },
      { id: "3", status: "sent" },
      { id: "4", status: "viewed" },
    ];

    const grouped = groupProposalsByStage(proposals as Parameters<typeof groupProposalsByStage>[0]);

    expect(grouped.draft).toHaveLength(1);
    expect(grouped.sent).toHaveLength(2);
    expect(grouped.viewed).toHaveLength(1);
    expect(grouped.accepted).toHaveLength(0);
  });

  it("should handle empty proposals array", async () => {
    const { groupProposalsByStage } = await import("./pipeline-utils");

    const grouped = groupProposalsByStage([]);

    expect(grouped.draft).toHaveLength(0);
    expect(grouped.sent).toHaveLength(0);
  });
});

describe("formatTimeInStage", () => {
  it("should format minutes correctly", async () => {
    const { formatTimeInStage } = await import("./pipeline-utils");

    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const result = formatTimeInStage(thirtyMinutesAgo);

    expect(result).toContain("30");
    expect(result).toContain("min");
  });

  it("should format hours correctly", async () => {
    const { formatTimeInStage } = await import("./pipeline-utils");

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const result = formatTimeInStage(twoHoursAgo);

    expect(result).toContain("2");
    expect(result).toContain("val");
  });

  it("should format days correctly", async () => {
    const { formatTimeInStage } = await import("./pipeline-utils");

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const result = formatTimeInStage(threeDaysAgo);

    expect(result).toContain("3");
    expect(result).toContain("d");
  });
});

describe("canTransitionTo", () => {
  it("should return true for valid transitions", async () => {
    const { canTransitionTo } = await import("./pipeline-utils");

    expect(canTransitionTo("draft", "sent")).toBe(true);
    expect(canTransitionTo("sent", "viewed")).toBe(true);
    expect(canTransitionTo("viewed", "accepted")).toBe(true);
  });

  it("should return false for invalid transitions", async () => {
    const { canTransitionTo } = await import("./pipeline-utils");

    expect(canTransitionTo("draft", "paid")).toBe(false);
    expect(canTransitionTo("sent", "onboarded")).toBe(false);
    expect(canTransitionTo("declined", "sent")).toBe(false);
  });
});
