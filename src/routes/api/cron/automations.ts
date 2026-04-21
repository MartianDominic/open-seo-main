/**
 * Cron endpoint for processing proposal automations.
 * Phase 30-08: Pipeline & Automation
 *
 * Called hourly via cron to:
 * - Process time-based triggers (not viewed, no action)
 * - Process engagement signal triggers (hot prospect)
 * - Send follow-up emails
 * - Notify agency
 *
 * Endpoint: GET /api/cron/automations
 * Protected by CRON_SECRET header
 */

import { createFileRoute } from "@tanstack/react-router";
import { processAutomations } from "@/server/features/proposals/automation";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "cron-automations" });

export const Route = createFileRoute("/api/cron/automations")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Verify cron secret
        const cronSecret = process.env.CRON_SECRET;
        const authHeader = request.headers.get("Authorization");

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
          log.warn("Unauthorized cron request");
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        log.info("Processing proposal automations via cron");

        try {
          const result = await processAutomations();

          log.info("Automations processed successfully", result);

          return Response.json({
            success: true,
            data: result,
          });
        } catch (error) {
          log.error(
            "Automation processing failed",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
