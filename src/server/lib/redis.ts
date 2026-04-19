/**
 * ioredis singleton client and BullMQ connection factory.
 *
 * - `redis` — shared singleton for KV operations (progress-kv.ts etc.)
 * - `createRedisConnection()` — returns a NEW connection for BullMQ Queue/Worker
 *   (BullMQ requires each Queue and Worker to have its own connection)
 * - `closeRedis()` — graceful shutdown helper (wired in server shutdown handler)
 */

import IORedis, { type Redis, type RedisOptions } from "ioredis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "redis" });

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
  log.error("Connection error", err instanceof Error ? err : new Error(String(err)));
});

redis.on("end", () => {
  log.error("Connection closed unexpectedly, exiting process");
  process.exit(1);
});

/**
 * Create a new ioredis connection for use by a BullMQ Queue or Worker.
 * BullMQ requires each Queue and each Worker to have its own dedicated
 * connection — do NOT pass the `redis` singleton here.
 *
 * @deprecated Use `getSharedBullMQConnection()` instead to avoid connection leaks.
 */
export function createRedisConnection(): Redis {
  return new IORedis(getRedisUrl(), SHARED_OPTIONS);
}

/**
 * Shared connection pool for BullMQ Queues and Workers.
 * Each unique key gets its own connection, but repeated calls with the same key
 * return the existing connection. This prevents unbounded connection growth.
 *
 * Recommended keys:
 * - "queue:analytics" for analytics queue
 * - "worker:analytics" for analytics worker
 * - "queue:audit" for audit queue
 * - "worker:audit" for audit worker
 */
const bullmqConnections = new Map<string, Redis>();

export function getSharedBullMQConnection(key: string): Redis {
  const existing = bullmqConnections.get(key);
  if (existing) {
    return existing;
  }

  const connection = new IORedis(getRedisUrl(), SHARED_OPTIONS);
  const connLog = createLogger({ module: "redis", connectionKey: key });
  connection.on("error", (err) => {
    connLog.error("Connection error", err instanceof Error ? err : new Error(String(err)));
  });
  bullmqConnections.set(key, connection);
  return connection;
}

/**
 * Close all shared BullMQ connections.
 * Call during server shutdown after closing workers and queues.
 */
export async function closeBullMQConnections(): Promise<void> {
  const closePromises = Array.from(bullmqConnections.entries()).map(
    async ([key, conn]) => {
      const connLog = createLogger({ module: "redis", connectionKey: key });
      try {
        await conn.quit();
        connLog.info("Connection closed");
      } catch (err) {
        connLog.error("Error closing connection", err instanceof Error ? err : new Error(String(err)));
      }
    },
  );
  await Promise.all(closePromises);
  bullmqConnections.clear();
}

/**
 * Gracefully close the shared redis singleton.
 * Call during server shutdown (SIGTERM handler) before process.exit().
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
}
