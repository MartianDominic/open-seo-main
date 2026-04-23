/**
 * Single Change API Route
 * Phase 33: Auto-Fix System Gap Closure
 *
 * GET /api/changes/:changeId - Get single change by ID
 */
import { createFileRoute } from "@tanstack/react-router";
import { getChangeById } from "@/server/features/changes/repositories/ChangeRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/changes/$changeId" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/changes/$changeId" as any)({
  server: {
    handlers: {
      // GET /api/changes/:changeId
      GET: async ({ params }: { params: { changeId: string } }) => {
        const { changeId } = params;

        if (!changeId) {
          return Response.json(
            { success: false, error: "changeId is required" },
            { status: 400 }
          );
        }

        try {
          const change = await getChangeById(changeId);

          if (!change) {
            return Response.json(
              { success: false, error: "Change not found" },
              { status: 404 }
            );
          }

          return Response.json({ success: true, data: change });
        } catch (error) {
          log.error(
            "Failed to get change",
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
