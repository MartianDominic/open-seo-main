/**
 * Schema for internal link graph analysis.
 * Phase 35-01: Link Graph Schema + Extraction
 *
 * Stores every internal link relationship with detailed position and anchor data,
 * aggregated page metrics, and orphan page detection.
 */
import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clients } from "./client-schema";
import { audits, auditPages } from "./app.schema";

// Constants
export const LINK_POSITIONS = [
  "body",
  "sidebar",
  "footer",
  "nav",
  "header",
] as const;
export type LinkPosition = (typeof LINK_POSITIONS)[number];

export const LINK_TYPES = [
  "contextual",
  "nav",
  "footer",
  "sidebar",
  "image",
] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const ORPHAN_STATUS = ["detected", "fixed", "ignored"] as const;
export type OrphanStatus = (typeof ORPHAN_STATUS)[number];

export const DISCOVERY_SOURCES = ["sitemap", "gsc", "manual"] as const;
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

/**
 * link_graph table - stores every internal link with detailed attributes.
 * Core of the internal linking analysis system.
 */
export const linkGraph = pgTable(
  "link_graph",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),

    // Source page (where the link is placed)
    sourceUrl: text("source_url").notNull(),
    sourcePageId: text("source_page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),

    // Target page (where the link points to)
    targetUrl: text("target_url").notNull(),
    targetPageId: text("target_page_id").references(() => auditPages.id, {
      onDelete: "set null",
    }),

    // Anchor text and context
    anchorText: text("anchor_text").notNull().default(""),
    anchorTextLower: text("anchor_text_lower").notNull().default(""),
    anchorContext: text("anchor_context"), // ~50 chars surrounding text

    // Position classification
    position: text("position").notNull().default("body"), // body, sidebar, footer, nav, header
    paragraphIndex: integer("paragraph_index"), // null if not in body paragraph
    isFirstParagraph: boolean("is_first_paragraph").notNull().default(false),
    isSecondParagraph: boolean("is_second_paragraph").notNull().default(false),

    // Link attributes
    isDoFollow: boolean("is_do_follow").notNull().default(true),
    hasNoOpener: boolean("has_no_opener").notNull().default(false),
    hasTitle: boolean("has_title").notNull().default(false),
    linkText: text("link_text"), // Full visible text (may differ from anchor if truncated)

    // Classification
    linkType: text("link_type").notNull().default("contextual"), // contextual, nav, footer, sidebar, image
    isExactMatch: boolean("is_exact_match").notNull().default(false), // Anchor = target keyword
    isBranded: boolean("is_branded").notNull().default(false), // Anchor contains brand name
    isUrl: boolean("is_url").notNull().default(false), // Anchor is a raw URL

    // Discovery tracking
    discoveredAt: timestamp("discovered_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    // Client+audit queries
    index("ix_link_graph_client_audit").on(table.clientId, table.auditId),
    // Source page queries
    index("ix_link_graph_source_url").on(table.sourceUrl),
    // Target page queries (for inbound link counting)
    index("ix_link_graph_target_url").on(table.targetUrl),
    index("ix_link_graph_target_page").on(table.targetPageId),
    // Unique constraint per source-target-anchor combination
    uniqueIndex("ix_link_graph_unique_link").on(
      table.auditId,
      table.sourceUrl,
      table.targetUrl,
      table.anchorTextLower
    ),
  ]
);

/**
 * page_links table - aggregated link metrics per page.
 * Pre-computed for dashboard display and opportunity scoring.
 */
export const pageLinks = pgTable(
  "page_links",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
    pageUrl: text("page_url").notNull(),

    // Inbound metrics
    inboundTotal: integer("inbound_total").notNull().default(0),
    inboundBody: integer("inbound_body").notNull().default(0),
    inboundNav: integer("inbound_nav").notNull().default(0),
    inboundFooter: integer("inbound_footer").notNull().default(0),
    inboundSidebar: integer("inbound_sidebar").notNull().default(0),
    inboundFirstParagraph: integer("inbound_first_paragraph").notNull().default(0),
    inboundExactMatch: integer("inbound_exact_match").notNull().default(0),
    inboundBranded: integer("inbound_branded").notNull().default(0),
    inboundDoFollow: integer("inbound_do_follow").notNull().default(0),

    // Outbound metrics
    outboundTotal: integer("outbound_total").notNull().default(0),
    outboundBody: integer("outbound_body").notNull().default(0),
    outboundInternal: integer("outbound_internal").notNull().default(0),
    outboundExternal: integer("outbound_external").notNull().default(0),

    // Anchor analysis
    uniqueAnchors: integer("unique_anchors").notNull().default(0),
    anchorDistribution: jsonb("anchor_distribution").$type<Record<string, number>>(), // anchor -> percentage
    topAnchors: jsonb("top_anchors").$type<Array<{ anchor: string; count: number }>>(),

    // Scoring
    clickDepthFromHome: integer("click_depth_from_home"),
    linkScore: real("link_score"), // 0-100 composite score
    opportunityScore: real("opportunity_score"), // Higher = more opportunity for improvement

    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Client+audit queries
    index("ix_page_links_client_audit").on(table.clientId, table.auditId),
    // Page URL lookup
    index("ix_page_links_page_url").on(table.pageUrl),
    // Opportunity ranking
    index("ix_page_links_opportunity").on(table.opportunityScore),
    // Click depth analysis
    index("ix_page_links_click_depth").on(table.clickDepthFromHome),
  ]
);

/**
 * orphan_pages table - pages with zero inbound internal links.
 * Critical SEO issue tracking for internal linking recommendations.
 */
export const orphanPages = pgTable(
  "orphan_pages",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .references(() => auditPages.id, { onDelete: "set null" }),
    pageUrl: text("page_url").notNull(),
    pageTitle: text("page_title"),

    // Discovery source
    discoverySource: text("discovery_source").notNull(), // sitemap, gsc, manual

    // Traffic data (from GSC or analytics)
    searchVolume: integer("search_volume"),
    monthlyTraffic: integer("monthly_traffic"),
    targetKeyword: text("target_keyword"),

    // Status tracking
    status: text("status").notNull().default("detected"), // detected, fixed, ignored
    fixedAt: timestamp("fixed_at", { withTimezone: true, mode: "date" }),
    fixedByChangeId: text("fixed_by_change_id"), // FK to site_changes when link is added

    detectedAt: timestamp("detected_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Client+audit queries
    index("ix_orphan_pages_client_audit").on(table.clientId, table.auditId),
    // Status filtering
    index("ix_orphan_pages_status").on(table.status),
  ]
);

// Relations
export const linkGraphRelations = relations(linkGraph, ({ one }) => ({
  client: one(clients, {
    fields: [linkGraph.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [linkGraph.auditId],
    references: [audits.id],
  }),
  sourcePage: one(auditPages, {
    fields: [linkGraph.sourcePageId],
    references: [auditPages.id],
  }),
  targetPage: one(auditPages, {
    fields: [linkGraph.targetPageId],
    references: [auditPages.id],
  }),
}));

export const pageLinksRelations = relations(pageLinks, ({ one }) => ({
  client: one(clients, {
    fields: [pageLinks.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [pageLinks.auditId],
    references: [audits.id],
  }),
  page: one(auditPages, {
    fields: [pageLinks.pageId],
    references: [auditPages.id],
  }),
}));

export const orphanPagesRelations = relations(orphanPages, ({ one }) => ({
  client: one(clients, {
    fields: [orphanPages.clientId],
    references: [clients.id],
  }),
  audit: one(audits, {
    fields: [orphanPages.auditId],
    references: [audits.id],
  }),
  page: one(auditPages, {
    fields: [orphanPages.pageId],
    references: [auditPages.id],
  }),
}));

// Inferred types
export type LinkGraphSelect = typeof linkGraph.$inferSelect;
export type LinkGraphInsert = typeof linkGraph.$inferInsert;
export type PageLinksSelect = typeof pageLinks.$inferSelect;
export type PageLinksInsert = typeof pageLinks.$inferInsert;
export type OrphanPagesSelect = typeof orphanPages.$inferSelect;
export type OrphanPagesInsert = typeof orphanPages.$inferInsert;
