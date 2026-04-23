/**
 * Changes API Routes
 * Phase 33: Auto-Fix System Gap Closure
 *
 * GET /api/changes?clientId=X - List changes for client with filters
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  getChangesByClient,
} from "@/server/features/changes/repositories/ChangeRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/changes" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/changes/" as any)({
  server: {
    handlers: {
      // GET /api/changes?clientId=X
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get("clientId");

        if (!clientId) {
          return Response.json(
            { success: false, error: "clientId query parameter required" },
            { status: 400 }
          );
        }

        const status = url.searchParams.get("status") ?? undefined;
        const category = url.searchParams.get("category") ?? undefined;
        const resourceType = url.searchParams.get("resourceType") ?? undefined;
        const triggeredBy = url.searchParams.get("triggeredBy") ?? undefined;
        const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
        const dateTo = url.searchParams.get("dateTo") ?? undefined;
        const limit = url.searchParams.get("limit");
        const offset = url.searchParams.get("offset");

        try {
          let changes = await getChangesByClient(clientId, {
            status,
            category,
            limit: limit ? parseInt(limit, 10) : 100,
            offset: offset ? parseInt(offset, 10) : 0,
          });

          // Apply additional filters that repository doesn't support
          if (resourceType) {
            changes = changes.filter((c) => c.resourceType === resourceType);
          }
          if (triggeredBy) {
            changes = changes.filter((c) => c.triggeredBy === triggeredBy);
          }
          if (dateFrom) {
            const fromDate = new Date(dateFrom);
            changes = changes.filter((c) => c.createdAt >= fromDate);
          }
          if (dateTo) {
            const toDate = new Date(dateTo);
            changes = changes.filter((c) => c.createdAt <= toDate);
          }

          return Response.json({ success: true, data: changes });
        } catch (error) {
          log.error(
            "Failed to get changes",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
