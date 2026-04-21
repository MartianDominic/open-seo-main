/**
 * Tests for Cheerio-based web scraper.
 *
 * Tests cover:
 * - Successful scraping with title, meta, headings
 * - HTTP error handling (404)
 * - Timeout handling
 * - Redirect chain following
 * - Error result format (no throws)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrapeUrl } from "./cheerioScraper";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("cheerioScraper", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("scrapeUrl", () => {
    it("returns ScrapedPage with title, meta, headings for valid URL", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page Title</title>
          <meta name="description" content="Test meta description">
        </head>
        <body>
          <h1>Main Heading</h1>
          <p>Some paragraph text.</p>
          <h2>Secondary Heading</h2>
          <a href="/about">About Us</a>
          <a href="/products">Products</a>
        </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        url: "https://example.com/",
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl("https://example.com/");

      expect(result.statusCode).toBe(200);
      expect(result.title).toBe("Test Page Title");
      expect(result.metaDescription).toBe("Test meta description");
      expect(result.headings).toContainEqual({ level: 1, text: "Main Heading" });
      expect(result.headings).toContainEqual({
        level: 2,
        text: "Secondary Heading",
      });
      expect(result.bodyText).toContain("Some paragraph text");
      expect(result.links).toContain("/about");
      expect(result.links).toContain("/products");
      expect(result.fetchedAt).toBeInstanceOf(Date);
      expect(result.error).toBeUndefined();
    });

    it("returns statusCode 404 for non-existent page (no throw)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        redirected: false,
        url: "https://example.com/not-found",
        text: () => Promise.resolve("Not Found"),
      });

      const result = await scrapeUrl("https://example.com/not-found");

      expect(result.statusCode).toBe(404);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("HTTP_ERROR");
      expect(result.error?.message).toContain("404");
    });

    it("times out after configured timeout and returns error result", async () => {
      // Mock fetch to respect the abort signal
      mockFetch.mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  redirected: false,
                  url: "https://example.com/slow",
                  text: () => Promise.resolve("<html></html>"),
                }),
              200,
            );

            // Listen for abort signal
            options?.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              const abortError = new Error("The operation was aborted");
              abortError.name = "AbortError";
              reject(abortError);
            });
          }),
      );

      const result = await scrapeUrl("https://example.com/slow", {
        timeout: 50, // Very short timeout
      });

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("TIMEOUT");
      expect(result.statusCode).toBe(0);
    });

    it("handles redirect chains and captures final URL", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Final Page</title></head>
        <body><h1>You made it!</h1></body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: true,
        url: "https://example.com/final-destination",
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl("https://example.com/redirect-me");

      expect(result.statusCode).toBe(200);
      expect(result.url).toBe("https://example.com/final-destination");
      expect(result.title).toBe("Final Page");
    });

    it("uses configured User-Agent header (TeveroBot)", async () => {
      const html = "<html><head><title>Test</title></head><body></body></html>";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        url: "https://example.com/",
        text: () => Promise.resolve(html),
      });

      await scrapeUrl("https://example.com/", { userAgent: "CustomBot/2.0" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "CustomBot/2.0",
          }),
        }),
      );
    });

    it("falls back to og:title when title tag is missing", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta property="og:title" content="OpenGraph Title">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        url: "https://example.com/",
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl("https://example.com/");

      expect(result.title).toBe("OpenGraph Title");
    });

    it("falls back to og:description when meta description is missing", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test</title>
          <meta property="og:description" content="OpenGraph Description">
        </head>
        <body><p>Content</p></body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        url: "https://example.com/",
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl("https://example.com/");

      expect(result.metaDescription).toBe("OpenGraph Description");
    });

    it("handles network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const result = await scrapeUrl("https://example.com/");

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("NETWORK_ERROR");
      expect(result.statusCode).toBe(0);
    });

    it("truncates body text to maxBodyLength", async () => {
      const longText = "x".repeat(60000);
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Long Page</title></head>
        <body><p>${longText}</p></body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        redirected: false,
        url: "https://example.com/",
        text: () => Promise.resolve(html),
      });

      const result = await scrapeUrl("https://example.com/", {
        maxBodyLength: 50000,
      });

      expect(result.bodyText.length).toBeLessThanOrEqual(50003); // 50000 + "..."
    });
  });
});
