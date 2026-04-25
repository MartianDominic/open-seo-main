/**
 * Findings API Route for Audit Page.
 * Phase 32: 107 SEO Checks - Wire Findings to Audit Route
 *
 * GET /api/audit/pages/:pageId/findings
 * Returns: { score, breakdown, gates, findings }
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { calculateOnPageScore } from "@/server/lib/audit/checks/scoring";
import type { CheckResult, CheckSeverity } from "@/server/lib/audit/checks/types";

const log = createLogger({ module: "api/audit/pages/findings" });

// @ts-expect-error - Route will be registered after TanStack generates route tree
export const Route = createFileRoute("/api/audit/pages/$pageId/findings")({
  server: {
    handlers: {
      GET: async ({
        params,
      }: {
        request: Request;
        params: { pageId: string };
      }) => {
        try {
          const { pageId } = params;

          const findings = await FindingsRepository.getFindingsByPage(pageId);

          if (findings.length === 0) {
            return Response.json({
              score: null,
              breakdown: null,
              gates: [],
              findings: [],
              message: "No findings for this page",
            });
          }

          const checkResults: CheckResult[] = findings.map((f) => ({
            checkId: f.checkId,
            passed: f.passed,
            severity: f.severity as CheckSeverity,
            message: f.message,
            details: f.details as Record<string, unknown> | undefined,
            autoEditable: f.autoEditable,
            editRecipe: typeof f.editRecipe === "string" ? f.editRecipe : undefined,
          }));

          const scoreResult = calculateOnPageScore(checkResults);

          return Response.json({
            score: scoreResult.score,
            breakdown: scoreResult.breakdown,
            gates: scoreResult.gates,
            findings: findings.map((f) => ({
              id: f.id,
              checkId: f.checkId,
              tier: f.tier,
              category: f.category,
              passed: f.passed,
              severity: f.severity,
              message: f.message,
              details: f.details,
              autoEditable: f.autoEditable,
              editRecipe: f.editRecipe,
            })),
          });
        } catch (error) {
          log.error(
            "Failed to fetch findings",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
