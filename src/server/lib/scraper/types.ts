/**
 * Shared type definitions for the web scraper module.
 *
 * These types define the contract for:
 * - Scraping individual pages (ScrapedPage)
 * - Detecting business-relevant links (BusinessLinks)
 * - Extracting structured content (ExtractedContent)
 * - Configuring scrape behavior (ScrapeOptions)
 */

/**
 * Error codes for scraping failures.
 * Used to distinguish between different failure modes.
 */
export type ScrapeErrorCode =
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "PARSE_ERROR"
  | "NETWORK_ERROR"
  | "ROBOTS_BLOCKED";

/**
 * Error details when scraping fails.
 */
export interface ScrapeError {
  code: ScrapeErrorCode;
  message: string;
}

/**
 * A heading extracted from HTML.
 */
export interface Heading {
  level: number;
  text: string;
}

/**
 * Result of scraping a single URL.
 */
export interface ScrapedPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  headings: Heading[];
  bodyText: string;
  links: string[];
  fetchedAt: Date;
  error?: ScrapeError;
}

/**
 * Options for configuring scrape behavior.
 */
export interface ScrapeOptions {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** User-Agent header value (default: "TeveroBot/1.0") */
  userAgent?: string;
  /** Maximum redirects to follow (default: 5) */
  maxRedirects?: number;
  /** Maximum body text length in characters (default: 50000) */
  maxBodyLength?: number;
}

/**
 * Business-relevant links detected from a homepage.
 * Each field represents a canonical business page type.
 */
export interface BusinessLinks {
  /** Products/shop page: /products, /shop, /store, /catalog, /buy */
  products: string | null;
  /** About page: /about, /about-us, /company, /who-we-are, /our-story */
  about: string | null;
  /** Services page: /services, /what-we-do, /solutions, /offerings */
  services: string | null;
  /** Contact page: /contact, /contact-us, /get-in-touch, /reach-us */
  contact: string | null;
  /** Category pages: /category/*, /categories/*, /collections/*, /c/* (max 5) */
  categories: string[];
}

/**
 * Structured content extracted from HTML.
 */
export interface ExtractedContent {
  title: string | null;
  metaDescription: string | null;
  headings: Heading[];
  /** Cleaned body text with scripts, styles, nav removed (max 50000 chars) */
  bodyText: string;
  /** JSON-LD structured data if present */
  structuredData: Record<string, unknown> | null;
}

/**
 * Default scrape options.
 */
export const DEFAULT_SCRAPE_OPTIONS: Required<ScrapeOptions> = {
  timeout: 10000,
  userAgent: "TeveroBot/1.0 (+https://tevero.com/bot)",
  maxRedirects: 5,
  maxBodyLength: 50000,
};
