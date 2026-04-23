/**
 * Single Connection API Routes
 * Phase 31-04: API Endpoints
 *
 * GET, DELETE operations for a specific connection.
 *
 * GET /api/connections/:id - Get connection by ID
 * DELETE /api/connections/:id - Delete connection
 */
import { createFileRoute } from "@tanstack/react-router";
import { connectionService } from "@/server/features/connections/services/ConnectionService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/connections/:id" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/connections/$id" as any)({
  server: {
    handlers: {
      // GET /api/connections/:id
      GET: async ({
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const connection = await connectionService.getConnection(params.id);

          if (!connection) {
            return Response.json(
              { error: "Connection not found" },
              { status: 404 }
            );
          }

          return Response.json(connection);
        } catch (error) {
          log.error(
            "Failed to get connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/connections/:id
      DELETE: async ({
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // Check if connection exists first
          const connection = await connectionService.getConnection(params.id);

          if (!connection) {
            return Response.json(
              { error: "Connection not found" },
              { status: 404 }
            );
          }

          await connectionService.deleteConnection(params.id);

          log.info("Connection deleted", {
            connectionId: params.id,
            clientId: connection.clientId,
          });

          return new Response(null, { status: 204 });
        } catch (error) {
          log.error(
            "Failed to delete connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
