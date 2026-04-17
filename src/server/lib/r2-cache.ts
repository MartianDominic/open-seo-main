import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { sortBy } from "remeda";

export const CACHE_TTL = {
  /** Related keyword research results */
  researchResult: 86400,
} as const;

const CACHE_ROOT = path.resolve(process.cwd(), ".data", "dataforseo-cache");

interface CacheEnvelope<T> {
  expiresAt: number; // ms epoch
  data: T;
}

export async function buildCacheKey(
  prefix: string,
  params: Record<string, unknown>,
): Promise<string> {
  const raw = JSON.stringify(
    Object.fromEntries(sortBy(Object.entries(params), ([key]) => key)),
  );
  return `${prefix}:${sha256Hex(raw)}`;
}

function keyToPath(key: string): string {
  const safe = key.replace(/[\0]/g, "_").replace(/\.\.\//g, "_").replace(/[/:]/g, "__");
  return path.join(CACHE_ROOT, `${safe}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CACHE_ROOT, { recursive: true });
}

export async function getCached(key: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(keyToPath(key), "utf8");
    const envelope = JSON.parse(raw) as CacheEnvelope<unknown>;
    if (typeof envelope.expiresAt !== "number" || envelope.expiresAt < Date.now()) {
      return null;
    }
    return envelope.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

export async function setCached<T>(
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  await ensureDir();
  const envelope: CacheEnvelope<T> = {
    expiresAt: Date.now() + ttlSeconds * 1000,
    data,
  };
  await fs.writeFile(keyToPath(key), JSON.stringify(envelope), "utf8");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
