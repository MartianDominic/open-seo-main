/**
 * Alert service for managing alerts and rules.
 * Phase 18: Monitoring & Alerts
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  alerts,
  alertRules,
  type AlertInsert,
  type AlertRuleInsert,
} from "@/db/alert-schema";

export interface CreateAlertParams {
  clientId: string;
  ruleId?: string;
  alertType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  sourceEventId?: string;
}

export interface AlertFilters {
  status?: "pending" | "acknowledged" | "resolved" | "dismissed";
  alertType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create a new alert.
 */
export async function createAlert(params: CreateAlertParams): Promise<string> {
  const id = crypto.randomUUID();
  const alertData: AlertInsert = {
    id,
    clientId: params.clientId,
    ruleId: params.ruleId,
    alertType: params.alertType,
    severity: params.severity,
    title: params.title,
    message: params.message,
    metadata: params.metadata,
    sourceEventId: params.sourceEventId,
  };

  await db.insert(alerts).values(alertData);
  return id;
}

/**
 * Get alerts for a client with optional filters.
 */
export async function getClientAlerts(clientId: string, filters: AlertFilters = {}) {
  const { status, alertType, limit = 50, offset = 0 } = filters;

  let query = db
    .select()
    .from(alerts)
    .where(eq(alerts.clientId, clientId))
    .orderBy(desc(alerts.createdAt))
    .limit(limit)
    .offset(offset);

  if (status) {
    query = db
      .select()
      .from(alerts)
      .where(and(eq(alerts.clientId, clientId), eq(alerts.status, status)))
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset(offset);
  }

  if (alertType) {
    query = db
      .select()
      .from(alerts)
      .where(and(eq(alerts.clientId, clientId), eq(alerts.alertType, alertType)))
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return query;
}

/**
 * Get count of unacknowledged alerts for badge display.
 */
export async function getUnacknowledgedCount(clientId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(eq(alerts.clientId, clientId), eq(alerts.status, "pending")));

  return result[0]?.count ?? 0;
}

/**
 * Acknowledge an alert.
 */
export async function acknowledgeAlert(id: string): Promise<void> {
  await db
    .update(alerts)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
    })
    .where(eq(alerts.id, id));
}

/**
 * Resolve an alert.
 */
export async function resolveAlert(id: string): Promise<void> {
  await db
    .update(alerts)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
    })
    .where(eq(alerts.id, id));
}

/**
 * Dismiss an alert.
 */
export async function dismissAlert(id: string): Promise<void> {
  await db
    .update(alerts)
    .set({ status: "dismissed" })
    .where(eq(alerts.id, id));
}

/**
 * Get alert rule for a client and type.
 */
export async function getAlertRule(
  clientId: string,
  alertType: "ranking_drop" | "sync_failure" | "connection_expiry",
) {
  const [rule] = await db
    .select()
    .from(alertRules)
    .where(
      and(eq(alertRules.clientId, clientId), eq(alertRules.alertType, alertType)),
    );

  return rule ?? null;
}

/**
 * Get all alert rules for a client.
 */
export async function getClientAlertRules(clientId: string) {
  return db
    .select()
    .from(alertRules)
    .where(eq(alertRules.clientId, clientId));
}

/**
 * Create or update an alert rule.
 */
export async function upsertAlertRule(data: {
  clientId: string;
  alertType: "ranking_drop" | "sync_failure" | "connection_expiry";
  enabled?: boolean;
  threshold?: number;
  severity?: "info" | "warning" | "critical";
  emailNotify?: boolean;
}): Promise<void> {
  const existing = await getAlertRule(data.clientId, data.alertType);

  if (existing) {
    await db
      .update(alertRules)
      .set({
        enabled: data.enabled ?? existing.enabled,
        threshold: data.threshold ?? existing.threshold,
        severity: data.severity ?? existing.severity,
        emailNotify: data.emailNotify ?? existing.emailNotify,
        updatedAt: new Date(),
      })
      .where(eq(alertRules.id, existing.id));
  } else {
    const rule: AlertRuleInsert = {
      id: crypto.randomUUID(),
      clientId: data.clientId,
      alertType: data.alertType as "ranking_drop" | "sync_failure" | "connection_expiry",
      enabled: data.enabled ?? true,
      threshold: data.threshold,
      severity: data.severity ?? "warning",
      emailNotify: data.emailNotify ?? false,
    };
    await db.insert(alertRules).values(rule);
  }
}

/**
 * Update alert with email notification result.
 */
export async function updateAlertEmailStatus(
  id: string,
  sentAt: Date | null,
  error: string | null,
): Promise<void> {
  await db
    .update(alerts)
    .set({
      emailSentAt: sentAt,
      emailError: error,
    })
    .where(eq(alerts.id, id));
}
