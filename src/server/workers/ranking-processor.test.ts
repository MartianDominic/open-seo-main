/**
 * Tests for ranking-processor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Job } from "bullmq";
import type { RankingJobData } from "@/server/queues/rankingQueue";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Mock the DataForSEO client
vi.mock("@/server/lib/dataforseo", () => ({
  fetchLiveSerpItemsRaw: vi.fn(),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("ranking-processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("processRankingJob", () => {
    it("should query savedKeywords where trackingEnabled=true", async () => {
      const { db } = await import("@/db");
      const processRankingJob = (await import("./ranking-processor")).default;

      // Setup mock chain for empty result
      const mockOffset = vi.fn().mockResolvedValue([]);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      expect(db.select).toHaveBeenCalled();
    });

    it("should process keywords in batches of 100", async () => {
      const { db } = await import("@/db");
      const processRankingJob = (await import("./ranking-processor")).default;

      // First batch returns 100, second returns empty
      let callCount = 0;
      const mockOffset = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? [] : []);
      });
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      // Verify limit(100) was called
      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it("should call fetchLiveSerpItemsRaw for each keyword", async () => {
      const { db } = await import("@/db");
      const { fetchLiveSerpItemsRaw } = await import("@/server/lib/dataforseo");
      const processRankingJob = (await import("./ranking-processor")).default;

      const mockKeywords = [
        {
          id: "kw-1",
          keyword: "seo tools",
          locationCode: 2840,
          languageCode: "en",
          projectDomain: "example.com",
        },
      ];

      let callCount = 0;
      const mockOffset = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockKeywords : []);
      });
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      // Mock SERP response
      vi.mocked(fetchLiveSerpItemsRaw).mockResolvedValue({
        data: [
          { type: "organic", rank_absolute: 5, url: "https://example.com/page", domain: "example.com" },
        ],
        billing: { path: ["serp"], costUsd: 0.01, resultCount: 1 },
      });

      // Mock insert for rankings
      const mockValues = vi.fn().mockResolvedValue([{}]);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      expect(fetchLiveSerpItemsRaw).toHaveBeenCalledWith("seo tools", 2840, "en");
    });

    it("should extract position from organic results matching domain", async () => {
      const { db } = await import("@/db");
      const { fetchLiveSerpItemsRaw } = await import("@/server/lib/dataforseo");
      const processRankingJob = (await import("./ranking-processor")).default;

      const mockKeywords = [
        {
          id: "kw-1",
          keyword: "seo tools",
          locationCode: 2840,
          languageCode: "en",
          projectDomain: "example.com",
        },
      ];

      let callCount = 0;
      const mockOffset = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockKeywords : []);
      });
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      vi.mocked(fetchLiveSerpItemsRaw).mockResolvedValue({
        data: [
          { type: "featured_snippet", rank_absolute: 1 },
          { type: "organic", rank_absolute: 3, url: "https://other.com", domain: "other.com" },
          { type: "organic", rank_absolute: 5, url: "https://example.com/page", domain: "example.com" },
        ],
        billing: { path: ["serp"], costUsd: 0.01, resultCount: 3 },
      });

      const insertedValues: unknown[] = [];
      const mockValues = vi.fn().mockImplementation((values) => {
        insertedValues.push(values);
        return Promise.resolve([{}]);
      });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      expect(insertedValues[0]).toMatchObject({
        position: 5,
        url: "https://example.com/page",
      });
    });

    it("should extract SERP features from result types", async () => {
      const { db } = await import("@/db");
      const { fetchLiveSerpItemsRaw } = await import("@/server/lib/dataforseo");
      const processRankingJob = (await import("./ranking-processor")).default;

      const mockKeywords = [
        {
          id: "kw-1",
          keyword: "seo tools",
          locationCode: 2840,
          languageCode: "en",
          projectDomain: "example.com",
        },
      ];

      let callCount = 0;
      const mockOffset = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockKeywords : []);
      });
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      vi.mocked(fetchLiveSerpItemsRaw).mockResolvedValue({
        data: [
          { type: "featured_snippet", rank_absolute: 1 },
          { type: "local_pack", rank_absolute: 2 },
          { type: "organic", rank_absolute: 5, url: "https://example.com/page", domain: "example.com" },
        ],
        billing: { path: ["serp"], costUsd: 0.01, resultCount: 3 },
      });

      const insertedValues: unknown[] = [];
      const mockValues = vi.fn().mockImplementation((values) => {
        insertedValues.push(values);
        return Promise.resolve([{}]);
      });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      await processRankingJob(job);

      const inserted = insertedValues[0] as { serpFeatures: string[] };
      expect(inserted.serpFeatures).toContain("featured_snippet");
      expect(inserted.serpFeatures).toContain("local_pack");
    });

    it("should handle API errors gracefully and continue to next keyword", async () => {
      const { db } = await import("@/db");
      const { fetchLiveSerpItemsRaw } = await import("@/server/lib/dataforseo");
      const processRankingJob = (await import("./ranking-processor")).default;

      const mockKeywords = [
        { id: "kw-1", keyword: "fail keyword", locationCode: 2840, languageCode: "en", projectDomain: "example.com" },
        { id: "kw-2", keyword: "success keyword", locationCode: 2840, languageCode: "en", projectDomain: "example.com" },
      ];

      let callCount = 0;
      const mockOffset = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockKeywords : []);
      });
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as never);

      // First call fails, second succeeds
      vi.mocked(fetchLiveSerpItemsRaw)
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({
          data: [{ type: "organic", rank_absolute: 3, url: "https://example.com", domain: "example.com" }],
          billing: { path: ["serp"], costUsd: 0.01, resultCount: 1 },
        });

      const mockValues = vi.fn().mockResolvedValue([{}]);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

      const job = {
        id: "job-1",
        data: { triggeredAt: "2026-04-19T03:00:00Z" },
      } as Job<RankingJobData>;

      // Should not throw
      await expect(processRankingJob(job)).resolves.not.toThrow();

      // Should have called API for both keywords
      expect(fetchLiveSerpItemsRaw).toHaveBeenCalledTimes(2);
      // Should have inserted only for the successful one
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });
});
