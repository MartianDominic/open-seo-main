/**
 * Internal API route for triggering analytics backfill.
 *
 * Called by AI-Writer backend after OAuth callback successfully stores
 * Google credentials. This endpoint queues a backfill job in BullMQ.
 *
 * SECURITY: Protected by X-Internal-Api-Key header.
 * This endpoint is NOT exposed to public - internal network only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { queueBackfillJob } from "@/server/queues/analyticsQueue";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

/**
 * Verify internal API key header for service-to-service auth.
 */
function verifyInternalApiKey(request: Request): boolean {
  const apiKey = request.headers.get("X-Internal-Api-Key");
  if (!INTERNAL_API_KEY) {
    console.error("[internal] INTERNAL_API_KEY not configured");
    return false;
  }
  return apiKey === INTERNAL_API_KEY;
}

interface BackfillRequestBody {
  clientId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/internal/analytics/backfill" as any)({
  server: {
    handlers: {
      // POST /api/internal/analytics/backfill - Queue backfill job
      POST: async ({ request }: { request: Request }) => {
        // Verify internal API key
        if (!verifyInternalApiKey(request)) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const body = (await request.json()) as BackfillRequestBody;
          const { clientId } = body;

          if (!clientId) {
            return Response.json(
              { error: "clientId required" },
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Validate UUID format (basic check)
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(clientId)) {
            return Response.json(
              { error: "Invalid clientId format" },
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          // Queue the backfill job
          await queueBackfillJob(clientId);

          console.log(
            `[internal/analytics/backfill] Queued backfill for client ${clientId}`,
          );

          return Response.json(
            { status: "queued", clientId },
            { status: 202, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[internal/analytics/backfill] Failed to queue:", err);
          return Response.json(
            { error: "Failed to queue backfill" },
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
