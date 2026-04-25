/**
 * Audit Run Checks API
 * Phase 40-04: T-40-04-04 - apps/web Check Proxy (P32)
 *
 * POST /api/audit/run-checks
 * Runs SEO checks against provided HTML content.
 * Used by apps/web to proxy check execution to open-seo-main.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runChecks } from "@/server/lib/audit/checks/runner";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import type { CheckTier } from "@/server/lib/audit/checks/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/audit/run-checks" });

const requestSchema = z.object({
  html: z.string().min(100, "HTML content required"),
  url: z.string().url("Valid URL required"),
  keyword: z.string().optional(),
  tiers: z.array(z.number().min(1).max(4)).optional(),
});

export const Route = createFileRoute("/api/audit/run-checks")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = requestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const { html, url, keyword, tiers } = parsed.data;

          const results = await runChecks(html, url, {
            keyword,
            tiers: (tiers as CheckTier[]) ?? [1, 2, 3, 4],
          });

          const score = calculateOnPageScore(results);

          log.info("Audit checks complete", {
            url,
            total: results.length,
            passed: results.filter((r) => r.passed).length,
            score: score.score,
          });

          return Response.json({
            findings: results,
            score,
            totalChecks: results.length,
            passedChecks: results.filter((r) => r.passed).length,
            failedChecks: results.filter((r) => !r.passed).length,
          });
        } catch (error) {
          log.error(
            "Audit checks failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { error: "Failed to run checks" },
            { status: 500 }
          );
        }
      },
    },
  },
});
