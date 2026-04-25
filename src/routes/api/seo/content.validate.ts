/**
 * Content Validation API
 * Phase 40: Gap Closure - Content validation with 107 SEO checks
 *
 * POST /api/seo/content/validate
 * Validates HTML content against SEO checks (Tier 1 and 2 only, no external APIs)
 *
 * Request: { html: string, keyword: string, url?: string }
 * Response: { score, breakdown, findings, approved, totalChecks, failedChecks }
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { runLocalChecks } from "@/server/lib/audit/checks/runner";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import type { CheckResult } from "@/server/lib/audit/checks/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/content/validate" });

const QUALITY_THRESHOLD = 80;

const validateRequestSchema = z.object({
  html: z.string().min(100, "HTML content must be at least 100 characters"),
  keyword: z.string().min(1, "Keyword is required"),
  url: z.string().url().optional(),
});

export interface ContentValidationResponse {
  score: number;
  breakdown: {
    base: number;
    tier1: number;
    tier2: number;
    tier3: number;
  };
  gates: string[];
  findings: Array<{
    checkId: string;
    passed: boolean;
    severity: string;
    message: string;
    editRecipe?: string;
  }>;
  approved: boolean;
  totalChecks: number;
  failedChecks: number;
}

// @ts-expect-error - Route will be registered after TanStack generates route tree
export const Route = createFileRoute("/api/seo/content/validate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = validateRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const { html, keyword, url } = parsed.data;
          const checkUrl = url || "https://example.com/generated-content";

          // Run Tier 1 and Tier 2 checks (no external API dependencies)
          const results = await runLocalChecks(html, checkUrl, keyword);

          // Calculate score with gates
          const scoreResult = calculateOnPageScore(results);

          // Filter failed checks for findings
          const failedChecks = results.filter((r: CheckResult) => !r.passed);

          const response: ContentValidationResponse = {
            score: scoreResult.score,
            breakdown: scoreResult.breakdown,
            gates: scoreResult.gates,
            findings: failedChecks.map((f: CheckResult) => ({
              checkId: f.checkId,
              passed: f.passed,
              severity: f.severity,
              message: f.message,
              editRecipe: f.editRecipe,
            })),
            approved: scoreResult.score >= QUALITY_THRESHOLD,
            totalChecks: results.length,
            failedChecks: failedChecks.length,
          };

          log.info("Content validation complete", {
            score: scoreResult.score,
            approved: response.approved,
            totalChecks: results.length,
            failedChecks: failedChecks.length,
            keyword,
          });

          return Response.json(response);
        } catch (error) {
          log.error(
            "Content validation failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { error: "Content validation failed" },
            { status: 500 }
          );
        }
      },
    },
  },
});
