import { alwrityPool } from "@/server/lib/alwrity-db";
import { AppError } from "@/server/lib/errors";

export const CLIENT_ID_HEADER = "x-client-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the client_id for a request.
 *
 * Contract (AUTH-03):
 *  - Header absent     → returns null (not every route is client-scoped).
 *  - Header present + valid UUID + exists in alwrity.clients (not archived)
 *                      → returns the UUID string.
 *  - Header present + malformed OR unknown UUID OR archived client
 *                      → throws AppError("FORBIDDEN").
 *
 * Security notes:
 *  - UUID regex rejects malformed input before any DB round-trip (T-06-01, T-06-04).
 *  - Parameterized query prevents SQL injection (T-06-02).
 *  - Only SELECT id — no name/email echoed back (T-06-03).
 *  - No cross-request caching; pool handles connection reuse.
 */
export async function resolveClientId(
  headers: Headers,
): Promise<string | null> {
  const raw = headers.get(CLIENT_ID_HEADER);
  if (!raw) return null;

  const candidate = raw.trim();
  if (!UUID_RE.test(candidate)) {
    throw new AppError("FORBIDDEN", "Invalid X-Client-ID header");
  }

  const { rows } = await alwrityPool.query<{ id: string }>(
    "SELECT id FROM clients WHERE id = $1 AND is_archived = false LIMIT 1",
    [candidate],
  );

  if (rows.length === 0) {
    throw new AppError("FORBIDDEN", "Unknown or archived client_id");
  }

  return rows[0].id;
}
