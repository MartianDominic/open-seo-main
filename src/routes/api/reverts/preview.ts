/**
 * Revert Preview API Route
 * Phase 33: Auto-Fix System Gap Closure
 *
 * POST /api/reverts/preview - Preview a revert operation
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  previewRevert,
  type RevertScope,
  type CascadeMode,
} from "@/server/features/changes/services/RevertService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/reverts/preview" });

const ScopeSchema = z.object({
  type: z.enum([
    "single",
    "field",
    "resource",
    "category",
    "batch",
    "date_range",
    "audit",
    "full",
  ]),
  changeId: z.string().optional(),
  resourceId: z.string().optional(),
  field: z.string().optional(),
  clientId: z.string().optional(),
  category: z.string().optional(),
  batchId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  auditId: z.string().optional(),
});

const PreviewSchema = z.object({
  scope: ScopeSchema,
  cascadeMode: z.enum(["warn", "cascade", "force"]).default("warn"),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/reverts/preview" as any)({
  server: {
    handlers: {
      // POST /api/reverts/preview
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = PreviewSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parsed.error.issues,
              },
              { status: 400 }
            );
          }

          const { scope, cascadeMode } = parsed.data;

          // Convert date strings to Date objects for date_range scope
          let resolvedScope: RevertScope;
          if (scope.type === "date_range" && scope.from && scope.to && scope.clientId) {
            resolvedScope = {
              type: "date_range",
              from: new Date(scope.from),
              to: new Date(scope.to),
              clientId: scope.clientId,
            };
          } else {
            resolvedScope = scope as RevertScope;
          }

          const preview = await previewRevert(
            resolvedScope,
            cascadeMode as CascadeMode
          );

          return Response.json({ success: true, data: preview });
        } catch (error) {
          log.error(
            "Failed to preview revert",
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
