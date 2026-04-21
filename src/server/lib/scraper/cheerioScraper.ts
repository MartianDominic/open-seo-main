/**
 * Cheerio-based web scraper for static HTML pages.
 *
 * Handles ~80% of websites that serve static HTML content.
 * Falls back to DataForSEO On-Page API for JS-rendered sites.
 *
 * Features:
 * - Timeout handling with AbortController
 * - Redirect following (max 5 by default)
 * - Title extraction (with og:title fallback)
 * - Meta description extraction (with og:description fallback)
 * - Heading extraction (h1-h6)
 * - Link extraction
 * - Body text extraction (cleaned, truncated)
 * - Graceful error handling (no throws)
 *
 * @module scraper/cheerioScraper
 */
import * as cheerio from "cheerio";
import type { ScrapedPage, ScrapeOptions, ScrapeError } from "./types";
import { DEFAULT_SCRAPE_OPTIONS } from "./types";

/**
 * Scrape a URL and extract structured content.
 *
 * @param url - The URL to scrape
 * @param options - Scrape configuration options
 * @returns ScrapedPage result (never throws)
 */
export async function scrapeUrl(
  url: string,
  options?: ScrapeOptions,
): Promise<ScrapedPage> {
  const opts = { ...DEFAULT_SCRAPE_OPTIONS, ...options };
  const fetchedAt = new Date();

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": opts.userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle HTTP errors
    if (!response.ok) {
      return createErrorResult(url, fetchedAt, response.status, {
        code: "HTTP_ERROR",
        message: `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
      });
    }

    // Parse HTML with cheerio
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title (with og:title fallback)
    const title =
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      null;

    // Extract meta description (with og:description fallback)
    const metaDescription =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      null;

    // Extract headings (h1-h6)
    const headings: { level: number; text: string }[] = [];
    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      const tagName = (el as { tagName: string }).tagName.toLowerCase();
      const level = parseInt(tagName.replace("h", ""), 10);
      const text = $(el).text().trim();
      if (text) {
        headings.push({ level, text });
      }
    });

    // Extract all links
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        links.push(href);
      }
    });

    // Extract body text (cleaned)
    const bodyText = extractBodyText($, opts.maxBodyLength);

    return {
      url: response.url, // Use final URL after redirects
      statusCode: response.status,
      title,
      metaDescription,
      headings,
      bodyText,
      links,
      fetchedAt,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      return createErrorResult(url, fetchedAt, 0, {
        code: "TIMEOUT",
        message: `Request timed out after ${opts.timeout}ms`,
      });
    }

    // Handle network errors
    return createErrorResult(url, fetchedAt, 0, {
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Unknown network error",
    });
  }
}

/**
 * Extract cleaned body text from HTML.
 *
 * Removes:
 * - script, style, noscript elements
 * - nav, header, footer, aside elements
 *
 * @param $ - Cheerio instance
 * @param maxLength - Maximum text length
 * @returns Cleaned body text
 */
function extractBodyText($: cheerio.CheerioAPI, maxLength: number): string {
  // Clone body to avoid modifying original
  const $body = $("body").clone();

  // Remove elements that don't contain main content
  $body
    .find("script, style, noscript, nav, header, footer, aside, iframe, svg")
    .remove();

  // Get text content
  let text = $body.text();

  // Collapse whitespace and trim
  text = text.replace(/\s+/g, " ").trim();

  // Truncate if needed
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + "...";
  }

  return text;
}

/**
 * Create an error result with consistent structure.
 */
function createErrorResult(
  url: string,
  fetchedAt: Date,
  statusCode: number,
  error: ScrapeError,
): ScrapedPage {
  return {
    url,
    statusCode,
    title: null,
    metaDescription: null,
    headings: [],
    bodyText: "",
    links: [],
    fetchedAt,
    error,
  };
}
