/**
 * Site Connections API Routes
 * Phase 31-04: API Endpoints
 *
 * CRUD operations for site connections.
 * All credential data is encrypted by ConnectionService.
 *
 * GET /api/connections?clientId=X - List connections for client
 * POST /api/connections - Create new connection
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  connectionService,
  type CreateConnectionInput,
} from "@/server/features/connections/services/ConnectionService";
import { PLATFORM_TYPES } from "@/server/features/connections/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/connections" });

const CreateConnectionSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  platform: z.enum(PLATFORM_TYPES),
  siteUrl: z.string().url("siteUrl must be a valid URL"),
  displayName: z.string().optional(),
  credentials: z.record(z.string(), z.unknown()),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/connections/" as any)({
  server: {
    handlers: {
      // GET /api/connections?clientId=X
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const clientId = url.searchParams.get("clientId");

        if (!clientId) {
          return Response.json(
            { error: "clientId query parameter required" },
            { status: 400 }
          );
        }

        try {
          const connections =
            await connectionService.getConnectionsForClient(clientId);
          return Response.json(connections);
        } catch (error) {
          log.error(
            "Failed to get connections",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // POST /api/connections - create new connection
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = CreateConnectionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid input", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const input: CreateConnectionInput = {
            clientId: parsed.data.clientId,
            platform: parsed.data.platform,
            siteUrl: parsed.data.siteUrl,
            displayName: parsed.data.displayName,
            credentials: parsed.data.credentials as Record<string, unknown>,
          };

          const connection = await connectionService.createConnection(input);

          log.info("Connection created", {
            connectionId: connection.id,
            clientId: input.clientId,
            platform: input.platform,
          });

          return Response.json(connection, { status: 201 });
        } catch (error) {
          log.error(
            "Failed to create connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
