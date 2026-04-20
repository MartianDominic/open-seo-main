/**
 * Schema for prospects and prospect analyses.
 * Phase 26: Prospect Data Model
 *
 * Prospects are potential clients that have not yet converted.
 * Analyses are one-time DataForSEO runs to understand their SEO state.
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./user-schema";

// Status enum values
export const PROSPECT_STATUS = [
  "new",
  "analyzing",
  "analyzed",
  "converted",
  "archived",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUS)[number];

// Analysis type enum values
export const ANALYSIS_TYPE = [
  "quick_scan",
  "deep_dive",
  "opportunity_discovery",
] as const;
export type AnalysisType = (typeof ANALYSIS_TYPE)[number];

// Analysis status enum values
export const ANALYSIS_STATUS = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUS)[number];

// Domain metrics JSONB type
export interface DomainMetrics {
  domainRank?: number;
  organicTraffic?: number;
  organicKeywords?: number;
  backlinks?: number;
  referringDomains?: number;
}

// Organic keyword item type
export interface OrganicKeywordItem {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc?: number;
  url?: string;
}

// Competitor keyword item type
export interface CompetitorKeywordItem {
  keyword: string;
  searchVolume: number;
  difficulty?: number;
  competitorDomain: string;
  competitorPosition: number;
}

/**
 * Prospects table - potential clients stored by domain.
 * One prospect per domain per workspace (unique constraint).
 */
export const prospects = pgTable(
  "prospects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    companyName: text("company_name"),
    contactEmail: text("contact_email"),
    contactName: text("contact_name"),
    industry: text("industry"),
    notes: text("notes"),
    status: text("status").notNull().default("new"),
    source: text("source"),
    assignedTo: text("assigned_to"),
    convertedClientId: text("converted_client_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_prospects_workspace").on(table.workspaceId),
    index("ix_prospects_status").on(table.status),
    uniqueIndex("ix_prospects_workspace_domain").on(
      table.workspaceId,
      table.domain,
    ),
  ],
);

/**
 * Prospect analyses table - stores DataForSEO analysis results.
 * Each analysis captures domain metrics, keywords, and competitor data.
 * Cost is tracked in cents for billing/budgeting.
 */
export const prospectAnalyses = pgTable(
  "prospect_analyses",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    analysisType: text("analysis_type").notNull(),
    status: text("status").notNull().default("pending"),
    targetRegion: text("target_region"),
    targetLanguage: text("target_language"),
    competitorDomains: jsonb("competitor_domains").$type<string[]>(),
    domainMetrics: jsonb("domain_metrics").$type<DomainMetrics>(),
    organicKeywords: jsonb("organic_keywords").$type<OrganicKeywordItem[]>(),
    competitorKeywords: jsonb("competitor_keywords").$type<
      CompetitorKeywordItem[]
    >(),
    costCents: integer("cost_cents").default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_analyses_prospect").on(table.prospectId),
    index("ix_analyses_status").on(table.status),
  ],
);

// Inferred types for database operations
export type ProspectSelect = typeof prospects.$inferSelect;
export type ProspectInsert = typeof prospects.$inferInsert;
export type ProspectAnalysisSelect = typeof prospectAnalyses.$inferSelect;
export type ProspectAnalysisInsert = typeof prospectAnalyses.$inferInsert;
