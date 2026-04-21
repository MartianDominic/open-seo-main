/**
 * Web scraper module for prospect website analysis.
 *
 * Provides tools for:
 * - Scraping static HTML pages (Cheerio-based)
 * - Detecting business-relevant links
 * - Extracting structured content
 *
 * @module scraper
 */

// Types
export type {
  ScrapedPage,
  ScrapeOptions,
  ScrapeError,
  ScrapeErrorCode,
  BusinessLinks,
  ExtractedContent,
  Heading,
} from "./types";
export { DEFAULT_SCRAPE_OPTIONS } from "./types";

// Cheerio scraper
export { scrapeUrl } from "./cheerioScraper";

// Link detector
export { detectBusinessLinks } from "./linkDetector";

// Content extractor
export { extractContent } from "./contentExtractor";
