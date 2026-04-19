/**
 * Google Search Console API client for analytics sync.
 *
 * Wraps googleapis searchconsole v1 with typed interfaces.
 * Uses OAuth2 access token from internal API.
 *
 * IMPORTANT per RESEARCH.md Pitfall 1 (GSC Data Delay):
 * - GSC data is delayed 2-3 days
 * - For incremental: end_date = today - 3 days, start_date = end_date - 2 days
 * - For backfill: end_date = today - 3 days, start_date = end_date - 87 days (90 total)
 */
import { google } from "googleapis";

export interface GSCDateMetrics {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCQueryMetrics extends GSCDateMetrics {
  query: string;
}

/**
 * Fetch daily aggregate GSC metrics for a site.
 *
 * @param accessToken - Valid OAuth2 access token
 * @param siteUrl - GSC site URL (e.g., "sc-domain:example.com")
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 */
export async function fetchGSCDateMetrics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
): Promise<GSCDateMetrics[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const searchconsole = google.searchconsole({ version: "v1", auth });

  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date"],
      rowLimit: 1000,
    },
  });

  return (response.data.rows || []).map((row) => ({
    date: row.keys![0],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

/**
 * Fetch top queries per day for a site.
 *
 * Per CONTEXT.md: Top 50 queries per day stored in gsc_query_snapshots.
 * We fetch more (50 * days) and filter client-side to ensure top 50 per day.
 *
 * @param accessToken - Valid OAuth2 access token
 * @param siteUrl - GSC site URL
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param topN - Number of top queries per day (default 50)
 */
export async function fetchGSCTopQueries(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  topN: number = 50,
): Promise<GSCQueryMetrics[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const searchconsole = google.searchconsole({ version: "v1", auth });

  // Request more rows to ensure we get top N per day
  // For 90 days * 50 queries = 4500 rows max
  const response = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["date", "query"],
      rowLimit: 5000,
    },
  });

  const allRows = (response.data.rows || []).map((row) => ({
    date: row.keys![0],
    query: row.keys![1],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));

  // Group by date and take top N by clicks
  const byDate = new Map<string, GSCQueryMetrics[]>();
  for (const row of allRows) {
    const existing = byDate.get(row.date) || [];
    existing.push(row);
    byDate.set(row.date, existing);
  }

  const result: GSCQueryMetrics[] = [];
  for (const [, rows] of byDate) {
    // Sort by clicks descending, take top N
    rows.sort((a, b) => b.clicks - a.clicks);
    result.push(...rows.slice(0, topN));
  }

  return result;
}

/**
 * Calculate date range for GSC sync.
 * Accounts for 3-day data delay.
 */
export function getGSCDateRange(mode: "incremental" | "backfill"): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  // GSC data delayed 3 days
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 3);

  const startDate = new Date(endDate);
  if (mode === "backfill") {
    startDate.setDate(startDate.getDate() - 87); // 90 days total
  } else {
    startDate.setDate(startDate.getDate() - 2); // 3 days overlap
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}
