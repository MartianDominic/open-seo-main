/**
 * Single webhook API routes.
 * Phase 18.5: Get, update, delete webhook.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import {
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  regenerateWebhookSecret,
  getWebhookDeliveries,
} from "@/services/webhooks";

const log = createLogger({ module: "api/webhooks/:webhookId" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/webhooks/$webhookId" as any)({
  server: {
    handlers: {
      // GET /api/webhooks/:webhookId - Get webhook details
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { webhookId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { webhookId } = params;
          const url = new URL(request.url);
          const includeDeliveries =
            url.searchParams.get("deliveries") === "true";

          const webhook = await getWebhookById(webhookId);

          if (!webhook) {
            throw new AppError("NOT_FOUND", "Webhook not found");
          }

          const response: Record<string, unknown> = {
            id: webhook.id,
            scope: webhook.scope,
            scopeId: webhook.scopeId,
            name: webhook.name,
            url: webhook.url,
            events: webhook.events,
            headers: webhook.headers,
            enabled: webhook.enabled,
            createdAt: webhook.createdAt.toISOString(),
            updatedAt: webhook.updatedAt.toISOString(),
          };

          if (includeDeliveries) {
            const deliveries = await getWebhookDeliveries(webhookId, 20);
            response.deliveries = deliveries.map((d) => ({
              id: d.id,
              eventId: d.eventId,
              eventType: d.eventType,
              status: d.status,
              attempts: d.attempts,
              lastAttemptAt: d.lastAttemptAt?.toISOString(),
              deliveredAt: d.deliveredAt?.toISOString(),
              createdAt: d.createdAt.toISOString(),
            }));
          }

          return Response.json(response);
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "NOT_FOUND"
                  ? 404
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Get webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // PATCH /api/webhooks/:webhookId - Update webhook
      PATCH: async ({
        request,
        params,
      }: {
        request: Request;
        params: { webhookId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { webhookId } = params;
          const body = (await request.json()) as {
            name?: string;
            url?: string;
            events?: string[];
            headers?: Record<string, string>;
            enabled?: boolean;
            regenerateSecret?: boolean;
          };

          const webhook = await getWebhookById(webhookId);
          if (!webhook) {
            throw new AppError("NOT_FOUND", "Webhook not found");
          }

          // Regenerate secret if requested
          let newSecret: string | undefined;
          if (body.regenerateSecret) {
            newSecret = await regenerateWebhookSecret(webhookId);
          }

          // Update other fields
          await updateWebhook(webhookId, {
            name: body.name,
            url: body.url,
            events: body.events,
            headers: body.headers,
            enabled: body.enabled,
          });

          const response: Record<string, unknown> = { success: true };
          if (newSecret) {
            response.secret = newSecret;
            response.message = "Secret regenerated. Save it - it won't be shown again.";
          }

          return Response.json(response);
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "NOT_FOUND"
                  ? 404
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Update webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/webhooks/:webhookId - Delete webhook
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { webhookId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { webhookId } = params;

          const webhook = await getWebhookById(webhookId);
          if (!webhook) {
            throw new AppError("NOT_FOUND", "Webhook not found");
          }

          await deleteWebhook(webhookId);

          return Response.json({ success: true });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "NOT_FOUND"
                  ? 404
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Delete webhook failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
