/**
 * Phase-2 in-memory crawl progress store. Entries expire after 30 minutes.
 *
 * Phase 3 replaces this with ioredis (keeping the same exported surface).
 * In-memory is acceptable for Phase 2 because audits themselves are stubbed
 * until BullMQ is wired — this file only needs to type-check and not break
 * the few existing reads from the UI polling endpoint.
 */
import { z } from "zod";

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ENTRIES = 300;

const crawledUrlEntrySchema = z.object({
  url: z.string(),
  statusCode: z.number(),
  title: z.string(),
  crawledAt: z.number(),
});

type CrawledUrlEntry = z.infer<typeof crawledUrlEntrySchema>;

interface Bucket {
  entries: CrawledUrlEntry[];
  expiresAt: number;
}

const store = new Map<string, Bucket>();

function isExpired(bucket: Bucket | undefined): boolean {
  return !bucket || bucket.expiresAt <= Date.now();
}

async function pushCrawledUrl(auditId: string, entry: CrawledUrlEntry): Promise<void> {
  await pushCrawledUrls(auditId, [entry]);
}

async function pushCrawledUrls(auditId: string, nextEntries: CrawledUrlEntry[]): Promise<void> {
  if (nextEntries.length === 0) return;
  const existing = store.get(auditId);
  const current = isExpired(existing) ? [] : (existing?.entries ?? []);
  const merged = [...nextEntries, ...current].slice(0, MAX_ENTRIES);
  store.set(auditId, { entries: merged, expiresAt: Date.now() + TTL_MS });
}

async function getCrawledUrls(auditId: string): Promise<CrawledUrlEntry[]> {
  const bucket = store.get(auditId);
  if (isExpired(bucket)) {
    if (bucket) store.delete(auditId);
    return [];
  }
  return bucket!.entries;
}

async function clear(auditId: string): Promise<void> {
  store.delete(auditId);
}

export const AuditProgressKV = {
  pushCrawledUrl,
  pushCrawledUrls,
  getCrawledUrls,
  clear,
} as const;
