/**
 * Link Graph Update API
 * Phase 40-04: T-40-04-03 - Link Graph Update on Publish (P39)
 *
 * POST /api/seo/links/graph/update
 * Updates link graph when new content is published.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { linkGraph, pageLinks, orphanPages } from "@/db/link-schema";
import { extractDetailedLinks } from "@/server/lib/linking/link-extractor";
import { eq, and, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/seo/links/graph/update" });

const requestSchema = z.object({
  clientId: z.string().min(1, "clientId required"),
  url: z.string().url("Valid URL required"),
  html: z.string().min(100, "HTML content required"),
  auditId: z.string().optional(),
});

interface GraphUpdateResponse {
  success: boolean;
  linksExtracted: number;
  internalLinks: number;
  externalLinks: number;
  error?: string;
}

export const Route = createFileRoute("/api/seo/links/graph/update")({
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

          const { clientId, url, html, auditId } = parsed.data;

          const siteOrigin = new URL(url).origin;

          const extractResult = extractDetailedLinks({
            html,
            pageUrl: url,
            siteOrigin,
          });

          const internalLinks = extractResult.links;
          const externalCount = extractResult.externalLinksSkipped;

          await db
            .delete(linkGraph)
            .where(
              and(eq(linkGraph.clientId, clientId), eq(linkGraph.sourceUrl, url))
            );

          if (internalLinks.length > 0 && auditId) {
            const linkInserts = internalLinks.map((link) => ({
              id: crypto.randomUUID(),
              clientId,
              auditId,
              sourceUrl: url,
              targetUrl: link.targetUrl,
              anchorText: link.anchorText,
              anchorTextLower: link.anchorText.toLowerCase(),
              anchorContext: link.context,
              position: link.position,
              paragraphIndex: link.paragraphIndex,
              isFirstParagraph: link.paragraphIndex === 1,
              isSecondParagraph: link.paragraphIndex === 2,
              isDoFollow: link.isDoFollow,
              hasNoOpener: link.hasNoOpener,
              hasTitle: link.hasTitle,
              linkType: link.linkType,
            }));

            await db.insert(linkGraph).values(linkInserts);
          }

          if (auditId) {
            await db
              .insert(pageLinks)
              .values({
                id: crypto.randomUUID(),
                clientId,
                auditId,
                pageId: "",
                pageUrl: url,
                outboundTotal: internalLinks.length,
                outboundInternal: internalLinks.length,
                outboundExternal: externalCount,
              })
              .onConflictDoUpdate({
                target: [pageLinks.clientId, pageLinks.pageUrl],
                set: {
                  outboundTotal: internalLinks.length,
                  outboundInternal: internalLinks.length,
                  outboundExternal: externalCount,
                  computedAt: new Date(),
                },
              });

            const internalTargets = [
              ...new Set(internalLinks.map((l) => l.targetUrl)),
            ];

            for (const targetUrl of internalTargets) {
              await db
                .update(pageLinks)
                .set({
                  inboundTotal: sql`${pageLinks.inboundTotal} + 1`,
                  inboundBody: sql`${pageLinks.inboundBody} + 1`,
                })
                .where(
                  and(
                    eq(pageLinks.clientId, clientId),
                    eq(pageLinks.pageUrl, targetUrl)
                  )
                );
            }
          }

          await db
            .delete(orphanPages)
            .where(
              and(eq(orphanPages.clientId, clientId), eq(orphanPages.pageUrl, url))
            );

          const response: GraphUpdateResponse = {
            success: true,
            linksExtracted: internalLinks.length + externalCount,
            internalLinks: internalLinks.length,
            externalLinks: externalCount,
          };

          log.info("Link graph updated", {
            clientId,
            url,
            internal: internalLinks.length,
            external: externalCount,
          });

          return Response.json(response);
        } catch (error) {
          log.error(
            "Link graph update failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            {
              success: false,
              error: "Failed to update link graph",
              linksExtracted: 0,
              internalLinks: 0,
              externalLinks: 0,
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
