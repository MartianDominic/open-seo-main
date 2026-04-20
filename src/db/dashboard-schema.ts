/**
 * Schema for agency dashboard metrics and views.
 * Phase 21: Agency Command Center
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";

/**
 * Pre-computed dashboard metrics for each client.
 * Updated every 5 minutes by BullMQ worker.
 */
export const clientDashboardMetrics = pgTable(
  "client_dashboard_metrics",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    healthScore: integer("health_score").notNull().default(100),
    healthBreakdown: jsonb("health_breakdown").$type<{
      traffic: number;
      rankings: number;
      technical: number;
      backlinks: number;
      content: number;
    }>(),
    trafficCurrent: integer("traffic_current").default(0),
    trafficPrevious: integer("traffic_previous").default(0),
    trafficTrendPct: text("traffic_trend_pct"), // stored as text, convert to decimal in app
    keywordsTotal: integer("keywords_total").default(0),
    keywordsTop10: integer("keywords_top_10").default(0),
    keywordsTop3: integer("keywords_top_3").default(0),
    keywordsPosition1: integer("keywords_position_1").default(0),
    keywordsDistribution: jsonb("keywords_distribution").$type<Record<string, number>>(),
    backlinksTotal: integer("backlinks_total").default(0),
    backlinksNewMonth: integer("backlinks_new_month").default(0),
    alertsOpen: integer("alerts_open").default(0),
    alertsCritical: integer("alerts_critical").default(0),
    lastReportAt: timestamp("last_report_at", { withTimezone: true, mode: "date" }),
    lastAuditAt: timestamp("last_audit_at", { withTimezone: true, mode: "date" }),
    // Goal-based metrics (Phase 22)
    goalAttainmentPct: numeric("goal_attainment_pct"),
    goalsMetCount: integer("goals_met_count").default(0),
    goalsTotalCount: integer("goals_total_count").default(0),
    primaryGoalName: text("primary_goal_name"),
    primaryGoalPct: numeric("primary_goal_pct"),
    primaryGoalTrend: text("primary_goal_trend"),
    priorityScore: integer("priority_score").default(0),
    computedAt: timestamp("computed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_dashboard_metrics_computed").on(table.computedAt),
  ],
);

/**
 * Portfolio-level activity feed for real-time updates.
 */
export const portfolioActivity = pgTable(
  "portfolio_activity",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    clientId: text("client_id"), // nullable for workspace-level events
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_activity_workspace_created").on(table.workspaceId, table.createdAt),
    index("ix_activity_client").on(table.clientId),
  ],
);

/**
 * Saved dashboard views (filters, layout, card order).
 */
export const dashboardViews = pgTable(
  "dashboard_views",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id"), // nullable for shared views
    name: text("name").notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
    layout: jsonb("layout").$type<{ cardOrder: string[] }>(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("ix_views_workspace_user").on(table.workspaceId, table.userId),
    index("ix_views_default").on(table.workspaceId, table.isDefault),
  ],
);

export type ClientDashboardMetricsSelect = typeof clientDashboardMetrics.$inferSelect;
export type ClientDashboardMetricsInsert = typeof clientDashboardMetrics.$inferInsert;
export type PortfolioActivitySelect = typeof portfolioActivity.$inferSelect;
export type PortfolioActivityInsert = typeof portfolioActivity.$inferInsert;
export type DashboardViewSelect = typeof dashboardViews.$inferSelect;
export type DashboardViewInsert = typeof dashboardViews.$inferInsert;
