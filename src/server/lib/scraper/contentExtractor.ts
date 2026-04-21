/**
 * Content extractor for HTML pages.
 *
 * Extracts structured content from HTML:
 * - Title (with og:title fallback)
 * - Meta description (with og:description fallback)
 * - Headings (h1-h6 with level and text)
 * - Body text (cleaned of scripts, styles, nav elements)
 * - JSON-LD structured data
 *
 * @module scraper/contentExtractor
 */
import * as cheerio from "cheerio";
import type { ExtractedContent, Heading } from "./types";

/** Maximum body text length in characters */
const MAX_BODY_LENGTH = 50000;

/**
 * Extract structured content from HTML.
 *
 * @param html - Raw HTML string to parse
 * @returns Extracted content with title, meta, headings, body text, and structured data
 */
export function extractContent(html: string): ExtractedContent {
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
  const headings: Heading[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tagName = (el as { tagName: string }).tagName.toLowerCase();
    const level = parseInt(tagName.replace("h", ""), 10);
    const text = $(el).text().trim();
    if (text) {
      headings.push({ level, text });
    }
  });

  // Extract body text (cleaned)
  const bodyText = extractBodyText($);

  // Extract JSON-LD structured data
  const structuredData = extractJsonLd($);

  return {
    title,
    metaDescription,
    headings,
    bodyText,
    structuredData,
  };
}

/**
 * Extract and clean body text from HTML.
 *
 * Removes:
 * - script, style, noscript elements
 * - nav, header, footer, aside elements
 * - iframe, svg elements
 *
 * @param $ - Cheerio instance
 * @returns Cleaned body text
 */
function extractBodyText($: cheerio.CheerioAPI): string {
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
  if (text.length > MAX_BODY_LENGTH) {
    text = text.slice(0, MAX_BODY_LENGTH) + "...";
  }

  return text;
}

/**
 * Extract JSON-LD structured data from the page.
 *
 * @param $ - Cheerio instance
 * @returns First valid JSON-LD object, or null if none found
 */
function extractJsonLd($: cheerio.CheerioAPI): Record<string, unknown> | null {
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    const scriptContent = $(scripts[i]).html();
    if (!scriptContent) continue;

    try {
      const parsed = JSON.parse(scriptContent);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Invalid JSON, try next script
      continue;
    }
  }

  return null;
}

export type { ExtractedContent };
