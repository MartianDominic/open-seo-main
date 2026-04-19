/**
 * Sandboxed BullMQ processor for analytics sync jobs.
 *
 * Runs in a child process to isolate Google API calls from the main event loop.
 *
 * Job types:
 *   - sync-all-clients: Fan-out to per-client jobs
 *   - sync-client-analytics: Actual GSC/GA4 sync for one client
 */
import type { Job } from "bullmq";
import type {
  AnalyticsSyncJobData,
  SyncAllClientsJobData,
} from "@/server/queues/analyticsQueue";
import { analyticsQueue } from "@/server/queues/analyticsQueue";
import { getValidCredentials } from "@/server/services/analytics/google-auth";
import {
  fetchGSCDateMetrics,
  fetchGSCTopQueries,
  getGSCDateRange,
} from "@/server/services/analytics/gsc-client";
import {
  fetchGA4Metrics,
  getGA4DateRange,
} from "@/server/services/analytics/ga4-client";
import { db } from "@/db";
import {
  gscSnapshots,
  gscQuerySnapshots,
  ga4Snapshots,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processAnalyticsJob(
  job: Job<AnalyticsSyncJobData | SyncAllClientsJobData>,
): Promise<void> {
  if (job.name === "sync-all-clients") {
    const data = job.data as SyncAllClientsJobData;
    await fanOutToClients(data.mode);
    return;
  }

  if (job.name === "sync-client-analytics") {
    const data = job.data as AnalyticsSyncJobData;
    await syncClientAnalytics(data);
    return;
  }

  console.error(`[analytics-processor] Unknown job name: ${job.name}`);
}

/**
 * Fan-out: Query all clients with active Google tokens, enqueue per-client jobs.
 */
async function fanOutToClients(
  mode: "incremental" | "backfill",
): Promise<void> {
  console.log(`[analytics-processor] Fan-out: querying active Google clients`);

  // Query AI-Writer DB for active Google tokens
  // The open-seo worker has ALWRITY_DATABASE_URL for shared DB access
  const pool = new Pool({
    connectionString: process.env.ALWRITY_DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT DISTINCT client_id::text as client_id
      FROM client_oauth_tokens
      WHERE provider = 'google' AND is_active = true
    `);

    const clientIds = result.rows.map((r) => r.client_id);
    console.log(
      `[analytics-processor] Found ${clientIds.length} clients with active Google tokens`,
    );

    for (const clientId of clientIds) {
      await analyticsQueue.add(
        "sync-client-analytics",
        {
          clientId,
          provider: "google",
          mode,
        },
        {
          jobId: `sync-${clientId}-${Date.now()}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 10_000 },
        },
      );
    }

    console.log(
      `[analytics-processor] Enqueued ${clientIds.length} per-client sync jobs`,
    );
  } finally {
    await pool.end();
  }
}

/**
 * Per-client sync: Fetch tokens, call GSC/GA4 APIs, write snapshots.
 */
async function syncClientAnalytics(data: AnalyticsSyncJobData): Promise<void> {
  const { clientId, mode } = data;
  console.log(
    `[analytics-processor] Syncing client ${clientId}, mode=${mode}`,
  );

  // Step 1: Get valid credentials (refreshes if needed)
  let creds;
  try {
    creds = await getValidCredentials(clientId);
  } catch (err) {
    console.error(
      `[analytics-processor] Failed to get credentials for ${clientId}:`,
      err,
    );
    throw err; // Let BullMQ retry
  }

  const { accessToken, gscSiteUrl, ga4PropertyId } = creds;

  // Step 2: Sync GSC data if site URL configured
  if (gscSiteUrl) {
    await syncGSCData(clientId, accessToken, gscSiteUrl, mode);
  } else {
    console.log(
      `[analytics-processor] No GSC site URL for client ${clientId}, skipping GSC sync`,
    );
  }

  // Step 3: Sync GA4 data if property ID configured
  if (ga4PropertyId) {
    await syncGA4Data(clientId, accessToken, ga4PropertyId, mode);
  } else {
    console.log(
      `[analytics-processor] No GA4 property ID for client ${clientId}, skipping GA4 sync`,
    );
  }

  console.log(`[analytics-processor] Sync complete for client ${clientId}`);
}

async function syncGSCData(
  clientId: string,
  accessToken: string,
  siteUrl: string,
  mode: "incremental" | "backfill",
): Promise<void> {
  const { startDate, endDate } = getGSCDateRange(mode);
  console.log(
    `[analytics-processor] Fetching GSC data for ${clientId}: ${startDate} to ${endDate}`,
  );

  // Fetch daily metrics
  const dateMetrics = await fetchGSCDateMetrics(
    accessToken,
    siteUrl,
    startDate,
    endDate,
  );
  console.log(
    `[analytics-processor] Got ${dateMetrics.length} GSC daily rows`,
  );

  // Upsert daily snapshots
  for (const row of dateMetrics) {
    await db
      .insert(gscSnapshots)
      .values({
        clientId,
        date: row.date,
        siteUrl,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
      .onConflictDoUpdate({
        target: [gscSnapshots.clientId, gscSnapshots.date],
        set: {
          clicks: sql`excluded.clicks`,
          impressions: sql`excluded.impressions`,
          ctr: sql`excluded.ctr`,
          position: sql`excluded.position`,
          syncedAt: sql`NOW()`,
        },
      });
  }

  // Fetch top queries
  const queryMetrics = await fetchGSCTopQueries(
    accessToken,
    siteUrl,
    startDate,
    endDate,
  );
  console.log(
    `[analytics-processor] Got ${queryMetrics.length} GSC query rows`,
  );

  // Upsert query snapshots
  for (const row of queryMetrics) {
    await db
      .insert(gscQuerySnapshots)
      .values({
        clientId,
        date: row.date,
        query: row.query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
      .onConflictDoUpdate({
        target: [
          gscQuerySnapshots.clientId,
          gscQuerySnapshots.date,
          gscQuerySnapshots.query,
        ],
        set: {
          clicks: sql`excluded.clicks`,
          impressions: sql`excluded.impressions`,
          ctr: sql`excluded.ctr`,
          position: sql`excluded.position`,
        },
      });
  }
}

async function syncGA4Data(
  clientId: string,
  accessToken: string,
  propertyId: string,
  mode: "incremental" | "backfill",
): Promise<void> {
  const { startDate, endDate } = getGA4DateRange(mode);
  console.log(
    `[analytics-processor] Fetching GA4 data for ${clientId}: ${startDate} to ${endDate}`,
  );

  const metrics = await fetchGA4Metrics(
    accessToken,
    propertyId,
    startDate,
    endDate,
  );
  console.log(`[analytics-processor] Got ${metrics.length} GA4 daily rows`);

  // Upsert GA4 snapshots
  for (const row of metrics) {
    await db
      .insert(ga4Snapshots)
      .values({
        clientId,
        date: row.date,
        propertyId,
        sessions: row.sessions,
        users: row.users,
        newUsers: row.newUsers,
        bounceRate: row.bounceRate,
        avgSessionDuration: row.avgSessionDuration,
        conversions: row.conversions,
        revenue: row.revenue,
      })
      .onConflictDoUpdate({
        target: [ga4Snapshots.clientId, ga4Snapshots.date],
        set: {
          sessions: sql`excluded.sessions`,
          users: sql`excluded.users`,
          newUsers: sql`excluded.new_users`,
          bounceRate: sql`excluded.bounce_rate`,
          avgSessionDuration: sql`excluded.avg_session_duration`,
          conversions: sql`excluded.conversions`,
          revenue: sql`excluded.revenue`,
          syncedAt: sql`NOW()`,
        },
      });
  }
}
