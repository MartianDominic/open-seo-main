/**
 * Sandboxed BullMQ processor for report generation jobs.
 *
 * Steps:
 * 1. Fetch report data from database
 * 2. Check cache (content hash match)
 * 3. Render to HTML
 * 4. Generate PDF via Puppeteer
 * 5. Write PDF to filesystem
 * 6. Update database with path and status
 */
import type { Job } from "bullmq";
import type { ReportJobData } from "@/server/queues/reportQueue";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { reports, gscSnapshots, gscQuerySnapshots, ga4Snapshots } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { generatePDF } from "@/server/services/report/pdf-generator";
import {
  renderReportToHTML,
  type ReportRenderData,
  type ReportLabels,
} from "@/server/services/report/report-renderer";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const REPORTS_DIR = process.env.REPORTS_DIR ?? "/data/reports";

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processReportJob(
  job: Job<ReportJobData>,
): Promise<void> {
  const { reportId, clientId, reportType, dateRange, locale, contentHash } =
    job.data;

  const logger = createLogger({
    module: "report-processor",
    jobId: job.id,
    reportId,
    clientId,
  });

  logger.info("Starting report generation", { reportType, dateRange });

  try {
    // Update status to generating
    await db
      .update(reports)
      .set({ status: "generating" })
      .where(eq(reports.id, reportId));

    // Step 1: Fetch report data
    const [gscDaily, ga4Daily, topQueries] = await Promise.all([
      db
        .select()
        .from(gscSnapshots)
        .where(
          and(
            eq(gscSnapshots.clientId, clientId),
            gte(gscSnapshots.date, dateRange.start),
            lte(gscSnapshots.date, dateRange.end),
          ),
        )
        .orderBy(gscSnapshots.date),
      db
        .select()
        .from(ga4Snapshots)
        .where(
          and(
            eq(ga4Snapshots.clientId, clientId),
            gte(ga4Snapshots.date, dateRange.start),
            lte(ga4Snapshots.date, dateRange.end),
          ),
        )
        .orderBy(ga4Snapshots.date),
      db
        .select()
        .from(gscQuerySnapshots)
        .where(
          and(
            eq(gscQuerySnapshots.clientId, clientId),
            gte(gscQuerySnapshots.date, dateRange.start),
            lte(gscQuerySnapshots.date, dateRange.end),
          ),
        )
        .orderBy(desc(gscQuerySnapshots.clicks))
        .limit(20),
    ]);

    logger.info("Data fetched", {
      gscDays: gscDaily.length,
      ga4Days: ga4Daily.length,
      queries: topQueries.length,
    });

    // Step 2: Compute summaries
    const gscSummary = computeGSCSummary(gscDaily);
    const ga4Summary = computeGA4Summary(ga4Daily);

    // Step 3: Get client name (from AI-Writer DB via ALWRITY_DATABASE_URL)
    // For now, we use a placeholder - will be wired when internal API is ready
    const clientName = await getClientName(clientId);

    // Step 4: Build report data
    const reportData: ReportRenderData = {
      metadata: {
        id: reportId,
        clientId,
        clientName,
        reportType,
        dateRange,
        locale,
        generatedAt: new Date().toISOString(),
        contentHash,
      },
      gscDaily: gscDaily.map((row) => ({
        date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      gscSummary,
      ga4Daily: ga4Daily.map((row) => ({
        date: row.date,
        sessions: row.sessions ?? 0,
        users: row.users ?? 0,
        bounce_rate: row.bounceRate ?? 0,
      })),
      ga4Summary,
      topQueries: topQueries.map((row) => ({
        query: row.query,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
        position_delta: 0, // TODO: Compute from previous period
      })),
    };

    // Step 5: Get localized labels
    const labels = getDefaultLabels(locale);

    // Step 6: Render to HTML
    const html = renderReportToHTML(reportData, labels);
    logger.info("HTML rendered", { htmlLength: html.length });

    // Step 7: Generate PDF
    const pdfBuffer = await generatePDF(html);
    logger.info("PDF generated", { pdfSize: pdfBuffer.byteLength });

    // Step 8: Write to filesystem
    // File naming: {client_id}/{YYYY-MM-DD}_{report_type}.pdf per CONTEXT.md
    const dateStr = dateRange.end.replace(/-/g, "");
    const filename = `${dateStr}_${reportType}.pdf`;
    const clientDir = path.join(REPORTS_DIR, clientId);
    const pdfPath = path.join(clientDir, filename);

    await mkdir(clientDir, { recursive: true });
    await writeFile(pdfPath, pdfBuffer);
    logger.info("PDF written", { pdfPath });

    // Step 9: Update database
    await db
      .update(reports)
      .set({
        status: "complete",
        pdfPath,
        generatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

    logger.info("Report generation complete");
  } catch (error) {
    logger.error("Report generation failed", error as Error);

    // Update status to failed
    await db
      .update(reports)
      .set({
        status: "failed",
        errorMessage: (error as Error).message,
      })
      .where(eq(reports.id, reportId));

    throw error; // Re-throw for BullMQ retry
  }
}

/**
 * Compute GSC summary from daily data.
 */
function computeGSCSummary(
  data: Array<{
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
): { clicks: number; impressions: number; ctr: number; position: number } {
  if (data.length === 0) {
    return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  }
  const clicks = data.reduce((sum, d) => sum + d.clicks, 0);
  const impressions = data.reduce((sum, d) => sum + d.impressions, 0);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position = data.reduce((sum, d) => sum + d.position, 0) / data.length;
  return { clicks, impressions, ctr, position };
}

/**
 * Compute GA4 summary from daily data.
 */
function computeGA4Summary(
  data: Array<{
    sessions: number | null;
    users: number | null;
    bounceRate: number | null;
    conversions: number | null;
  }>,
): { sessions: number; users: number; conversions: number; bounce_rate: number } {
  if (data.length === 0) {
    return { sessions: 0, users: 0, conversions: 0, bounce_rate: 0 };
  }
  const sessions = data.reduce((sum, d) => sum + (d.sessions ?? 0), 0);
  const users = data.reduce((sum, d) => sum + (d.users ?? 0), 0);
  const conversions = data.reduce((sum, d) => sum + (d.conversions ?? 0), 0);
  const bounce_rate =
    data.reduce((sum, d) => sum + (d.bounceRate ?? 0), 0) / data.length;
  return { sessions, users, conversions, bounce_rate };
}

/**
 * Get client name from AI-Writer database.
 * Falls back to "Client" if not found.
 */
async function getClientName(clientId: string): Promise<string> {
  // TODO: Query AI-Writer's clients table via ALWRITY_DATABASE_URL
  // For now, return a placeholder
  return "Client";
}

/**
 * Get default English labels.
 * TODO: Load from i18n system based on locale.
 */
function getDefaultLabels(locale: string): ReportLabels {
  // TODO: Implement locale-based label loading
  return {
    title: "Monthly SEO Report",
    subtitle: "Performance Overview",
    dateRange: "Date Range",
    clicks: "Clicks",
    impressions: "Impressions",
    ctr: "CTR",
    position: "Avg Position",
    sessions: "Sessions",
    users: "Users",
    conversions: "Conversions",
    bounceRate: "Bounce Rate",
    topQueries: "Top Search Queries",
    query: "Query",
    wow: "WoW",
    generatedBy: "Generated by Tevero",
    generatedAt: "Generated at",
  };
}
