/**
 * ioredis singleton client and BullMQ connection factory.
 *
 * - `redis` — shared singleton for KV operations (progress-kv.ts etc.)
 * - `createRedisConnection()` — returns a NEW connection for BullMQ Queue/Worker
 *   (BullMQ requires each Queue and Worker to have its own connection)
 * - `closeRedis()` — graceful shutdown helper (wired in server shutdown handler)
 */

import IORedis, { type Redis, type RedisOptions } from "ioredis";

const SHARED_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
};

function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing required environment variable: REDIS_URL. " +
        "Set it in .env or the deployment environment before starting.",
    );
  }
  return url;
}

export const redis: Redis = new IORedis(getRedisUrl(), SHARED_OPTIONS);

redis.on("error", (err) => {
  console.error("[redis] connection error:", err);
});

redis.on("end", () => {
  console.error("[redis] connection closed unexpectedly — exiting process");
  process.exit(1);
});

/**
 * Create a new ioredis connection for use by a BullMQ Queue or Worker.
 * BullMQ requires each Queue and each Worker to have its own dedicated
 * connection — do NOT pass the `redis` singleton here.
 */
export function createRedisConnection(): Redis {
  return new IORedis(getRedisUrl(), SHARED_OPTIONS);
}

/**
 * Gracefully close the shared redis singleton.
 * Call during server shutdown (SIGTERM handler) before process.exit().
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
}
