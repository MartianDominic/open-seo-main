/**
 * Data access layer for audit check findings.
 * Phase 32: 107 SEO Checks Implementation
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditFindings } from "@/db/schema";
import type { CheckResult, CheckCategory } from "@/server/lib/audit/checks/types";

const DB_BATCH_SIZE = 100;

/**
 * Extract tier number from check ID (e.g., "T1-01" -> 1)
 */
function getTierFromCheckId(checkId: string): number {
  const match = checkId.match(/^T(\d)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Insert check results as findings for a page.
 */
async function insertFindings(
  auditId: string,
  pageId: string,
  results: CheckResult[],
  category?: CheckCategory
): Promise<void> {
  if (results.length === 0) return;

  // Process in batches to avoid overwhelming the database
  for (let i = 0; i < results.length; i += DB_BATCH_SIZE) {
    const batch = results.slice(i, i + DB_BATCH_SIZE);
    const values = batch.map((result) => ({
      id: crypto.randomUUID(),
      auditId,
      pageId,
      checkId: result.checkId,
      tier: getTierFromCheckId(result.checkId),
      category: category ?? "unknown",
      passed: result.passed,
      severity: result.severity,
      message: result.message,
      details: result.details ?? null,
      autoEditable: result.autoEditable,
      editRecipe: result.editRecipe ?? null,
    }));

    await db.insert(auditFindings).values(values);
  }
}

/**
 * Get all findings for an audit.
 */
async function getFindingsByAudit(auditId: string) {
  return db.query.auditFindings.findMany({
    where: eq(auditFindings.auditId, auditId),
  });
}

/**
 * Get findings for a specific page.
 */
async function getFindingsByPage(pageId: string) {
  return db.query.auditFindings.findMany({
    where: eq(auditFindings.pageId, pageId),
  });
}

/**
 * Get failed findings by severity for an audit.
 */
async function getFailedFindingsBySeverity(auditId: string, severity: string) {
  return db.query.auditFindings.findMany({
    where: and(
      eq(auditFindings.auditId, auditId),
      eq(auditFindings.severity, severity),
      eq(auditFindings.passed, false)
    ),
  });
}

/**
 * Get all failed findings for an audit.
 */
async function getFailedFindingsByAudit(auditId: string) {
  return db.query.auditFindings.findMany({
    where: and(
      eq(auditFindings.auditId, auditId),
      eq(auditFindings.passed, false)
    ),
  });
}

/**
 * Delete all findings for an audit.
 */
async function deleteFindingsByAudit(auditId: string): Promise<void> {
  await db.delete(auditFindings).where(eq(auditFindings.auditId, auditId));
}

/**
 * Get finding counts by tier for an audit.
 */
async function getFindingCountsByTier(auditId: string): Promise<{
  tier1: { passed: number; failed: number };
  tier2: { passed: number; failed: number };
  tier3: { passed: number; failed: number };
  tier4: { passed: number; failed: number };
}> {
  const findings = await getFindingsByAudit(auditId);

  const counts = {
    tier1: { passed: 0, failed: 0 },
    tier2: { passed: 0, failed: 0 },
    tier3: { passed: 0, failed: 0 },
    tier4: { passed: 0, failed: 0 },
  };

  for (const finding of findings) {
    const tierKey = `tier${finding.tier}` as keyof typeof counts;
    if (counts[tierKey]) {
      if (finding.passed) {
        counts[tierKey].passed++;
      } else {
        counts[tierKey].failed++;
      }
    }
  }

  return counts;
}

export const FindingsRepository = {
  insertFindings,
  getFindingsByAudit,
  getFindingsByPage,
  getFailedFindingsBySeverity,
  getFailedFindingsByAudit,
  deleteFindingsByAudit,
  getFindingCountsByTier,
} as const;
