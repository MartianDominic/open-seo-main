/**
 * Smart link detector for business-relevant pages.
 *
 * Analyzes links from a homepage to identify canonical business pages:
 * - Products/Shop pages
 * - About pages
 * - Services pages
 * - Contact pages
 * - Category/Collection pages
 *
 * @module scraper/linkDetector
 */
import type { BusinessLinks } from "./types";

/**
 * URL patterns for detecting business page types.
 * Patterns are matched case-insensitively against the URL pathname.
 */
const PATTERNS = {
  products: [
    /^\/products\/?$/i,
    /^\/shop\/?$/i,
    /^\/store\/?$/i,
    /^\/catalog\/?$/i,
    /^\/buy\/?$/i,
  ],
  about: [
    /^\/about\/?$/i,
    /^\/about-us\/?$/i,
    /^\/company\/?$/i,
    /^\/who-we-are\/?$/i,
    /^\/our-story\/?$/i,
  ],
  services: [
    /^\/services\/?$/i,
    /^\/what-we-do\/?$/i,
    /^\/solutions\/?$/i,
    /^\/offerings\/?$/i,
  ],
  contact: [
    /^\/contact\/?$/i,
    /^\/contact-us\/?$/i,
    /^\/get-in-touch\/?$/i,
    /^\/reach-us\/?$/i,
  ],
  category: [
    /^\/category\/.+/i,
    /^\/categories\/.+/i,
    /^\/collections?\/.+/i,
    /^\/c\/.+/i,
  ],
};

/** Maximum number of category URLs to return */
const MAX_CATEGORIES = 5;

/**
 * Detect business-relevant links from a list of URLs.
 *
 * @param links - Array of href values from the page
 * @param baseUrl - Base URL of the page for resolving relative URLs
 * @returns BusinessLinks object with detected page URLs
 */
export function detectBusinessLinks(
  links: string[],
  baseUrl: string,
): BusinessLinks {
  const result: BusinessLinks = {
    products: null,
    about: null,
    services: null,
    contact: null,
    categories: [],
  };

  // Normalize base URL (remove trailing slash for consistent joining)
  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;

  // Parse base URL to get the host for filtering external links
  let baseHost: string;
  try {
    baseHost = new URL(normalizedBase).host;
  } catch {
    return result; // Invalid base URL, return empty result
  }

  for (const link of links) {
    // Skip empty or invalid links
    if (!link || link === "#") continue;

    // Resolve relative URL to absolute
    let absoluteUrl: string;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(link, normalizedBase);
      absoluteUrl = parsedUrl.href;
    } catch {
      continue; // Skip malformed URLs
    }

    // Filter external domains
    if (parsedUrl.host !== baseHost) {
      continue;
    }

    // Get pathname for pattern matching (without query/fragment for matching)
    const pathname = parsedUrl.pathname;

    // Check each page type
    if (!result.products && matchesPatterns(pathname, PATTERNS.products)) {
      result.products = absoluteUrl;
    }

    if (!result.about && matchesPatterns(pathname, PATTERNS.about)) {
      result.about = absoluteUrl;
    }

    if (!result.services && matchesPatterns(pathname, PATTERNS.services)) {
      result.services = absoluteUrl;
    }

    if (!result.contact && matchesPatterns(pathname, PATTERNS.contact)) {
      result.contact = absoluteUrl;
    }

    // Category pages (collect up to MAX_CATEGORIES)
    if (
      result.categories.length < MAX_CATEGORIES &&
      matchesPatterns(pathname, PATTERNS.category)
    ) {
      result.categories.push(absoluteUrl);
    }
  }

  return result;
}

/**
 * Check if a pathname matches any of the given patterns.
 */
function matchesPatterns(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(pathname));
}

export type { BusinessLinks };
