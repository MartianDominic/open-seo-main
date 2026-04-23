/**
 * Types for internal link analysis.
 * Phase 35-01: Link Graph Schema + Extraction
 */

import type { LinkPosition, LinkType } from "@/db/link-schema";

/**
 * Detailed link extracted from HTML.
 * Used by graph-builder to populate link_graph table.
 */
export interface DetailedLink {
  /** Normalized absolute URL of target page */
  targetUrl: string;
  /** Page ID from audit_pages if resolved */
  targetPageId: string | null;
  /** Visible anchor text (trimmed) */
  anchorText: string;
  /** Surrounding text context (~50 chars) */
  context: string;
  /** Position in page structure */
  position: LinkPosition;
  /** Paragraph index if in body (1-indexed), null otherwise */
  paragraphIndex: number | null;
  /** Whether link is dofollow (no rel="nofollow") */
  isDoFollow: boolean;
  /** Link type classification */
  linkType: LinkType;
  /** Whether link has title attribute */
  hasTitle: boolean;
  /** Whether link has rel="noopener" */
  hasNoOpener: boolean;
}

/**
 * URL to page ID mapping for resolving target page IDs.
 */
export type UrlToPageMap = Map<string, string>;

/**
 * Options for link extraction.
 */
export interface ExtractLinksOptions {
  /** HTML content to parse */
  html: string;
  /** Source page URL (for resolving relative URLs) */
  pageUrl: string;
  /** Site origin (for filtering internal links) */
  siteOrigin: string;
  /** URL to page ID mapping */
  urlToPageMap?: UrlToPageMap;
}

/**
 * Result of link extraction.
 */
export interface ExtractLinksResult {
  /** All internal links found */
  links: DetailedLink[];
  /** Count of external links skipped */
  externalLinksSkipped: number;
  /** Count of invalid links skipped (javascript:, mailto:, etc.) */
  invalidLinksSkipped: number;
}
