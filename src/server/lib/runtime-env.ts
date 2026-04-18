/**
 * Read an env var. Returns undefined if unset or empty after trim.
 * Node.js runtime only — no Cloudflare Workers fallback.
 */
function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Get a required env var or throw a descriptive error. Async for
 * backward-compatibility with existing callers (safe to `await`).
 */
export async function getRequiredEnvValue(name: string): Promise<string> {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Optional env read (async kept for callsite compatibility). */
export async function getOptionalEnvValue(
  name: string,
): Promise<string | undefined> {
  return readEnv(name);
}

/**
 * Check if we're in hosted auth mode.
 * With Clerk migration, this always returns true since all auth is now "hosted" via Clerk.
 * @deprecated Will be removed in Phase 11-04 when better-auth is fully removed.
 */
export async function isHostedServerAuthMode(): Promise<boolean> {
  return true;
}

/**
 * Legacy shim — previously returned a Cloudflare Worker binding. On Node.js
 * there are no runtime bindings; every value comes from process.env. Callers
 * that need a raw string should use getRequiredEnvValue. This export remains
 * so existing import sites type-check; it throws to surface any caller that
 * still expects a Workers binding object.
 */
export async function getWorkersBinding(name: string): Promise<unknown> {
  throw new Error(
    `getWorkersBinding(${name}) is not available in the Node.js runtime. Use getRequiredEnvValue("${name}") or read process.env.${name} directly.`,
  );
}

/**
 * Validate that a set of env vars is present. Call this at server startup
 * (src/server.ts or src/start.ts) to fail fast on misconfiguration.
 *
 * Accepts a list of variable names. Throws aggregated error listing every
 * missing variable rather than failing on the first.
 */
export function validateEnv(required: readonly string[]): void {
  const missing: string[] = [];
  for (const name of required) {
    if (!readEnv(name)) missing.push(name);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set them in .env or the deployment environment before starting.`,
    );
  }
}

/**
 * The canonical list of env vars the app requires in hosted mode.
 * Consumed by validateEnv() at startup.
 */
export const REQUIRED_ENV_HOSTED = [
  "DATABASE_URL",
  "REDIS_URL",
  "ALWRITY_DATABASE_URL",
  "CLERK_PUBLISHABLE_KEY",
] as const;

/** Always-required vars regardless of auth mode. */
export const REQUIRED_ENV_CORE = [
  "DATABASE_URL",
  "REDIS_URL",
  "ALWRITY_DATABASE_URL",
  "CLERK_PUBLISHABLE_KEY",
] as const;
