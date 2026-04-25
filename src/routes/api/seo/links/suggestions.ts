/**
 * Link Suggestions API for AI-Writer Integration
 * Phase 40-04: T-40-04-01 - Link Suggestions API (P35/P39)
 *
 * POST /api/seo/links/suggestions
 * Returns auto-applicable link suggestions for content generation.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { linkSuggestions } from "@/db/link-schema";
import { VelocityService } from "@/server/features/linking/services/VelocityService";
import { eq, and, gte, desc } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/suggestions" });

const requestSchema = z.object({
  clientId: z.string().min(1, "clientId required"),
  content: z.string().min(100, "Content must be at least 100 characters"),
  keyword: z.string().optional(),
  maxLinks: z.number().min(1).max(10).default(7),
});

interface LinkSuggestionResponse {
  anchorText: string;
  targetUrl: string;
  confidence: number;
  method: string;
  position: string | null;
}

interface SuggestionsResponse {
  links: LinkSuggestionResponse[];
  totalSuggestions: number;
  autoApplicable: number;
  remainingQuota: number;
  reason?: string;
}

export const Route = createFileRoute("/api/seo/links/suggestions")({
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

          const { clientId, content, maxLinks } = parsed.data;
          const contentLower = content.toLowerCase();

          const velocityService = new VelocityService(db);
          const stats = await velocityService.getVelocityStats(clientId);
          const remaining = stats.limits.maxNewLinksPerDay - stats.linksToday;

          if (remaining <= 0) {
            const response: SuggestionsResponse = {
              links: [],
              totalSuggestions: 0,
              autoApplicable: 0,
              remainingQuota: 0,
              reason: "Daily link insertion quota exhausted",
            };
            return Response.json(response);
          }

          const suggestions = await db
            .select()
            .from(linkSuggestions)
            .where(
              and(
                eq(linkSuggestions.clientId, clientId),
                eq(linkSuggestions.status, "pending"),
                eq(linkSuggestions.isAutoApplicable, true),
                gte(linkSuggestions.anchorConfidence, 0.85)
              )
            )
            .orderBy(desc(linkSuggestions.score))
            .limit(50);

          const applicableLinks: LinkSuggestionResponse[] = [];

          for (const suggestion of suggestions) {
            if (applicableLinks.length >= Math.min(maxLinks, remaining)) {
              break;
            }

            const anchorLower = suggestion.anchorText.toLowerCase();
            if (contentLower.includes(anchorLower)) {
              applicableLinks.push({
                anchorText: suggestion.anchorText,
                targetUrl: suggestion.targetUrl,
                confidence: suggestion.anchorConfidence ?? 0.85,
                method: suggestion.insertionMethod ?? "wrap_existing",
                position: suggestion.existingTextMatch,
              });
            }
          }

          const response: SuggestionsResponse = {
            links: applicableLinks,
            totalSuggestions: suggestions.length,
            autoApplicable: applicableLinks.length,
            remainingQuota: remaining - applicableLinks.length,
          };

          log.info("Link suggestions returned", {
            clientId,
            total: suggestions.length,
            applicable: applicableLinks.length,
          });

          return Response.json(response);
        } catch (error) {
          log.error(
            "Link suggestions failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { error: "Failed to get link suggestions" },
            { status: 500 }
          );
        }
      },
    },
  },
});
