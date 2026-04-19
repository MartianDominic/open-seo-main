/**
 * Report download API route.
 * Phase 15: Download report PDF.
 *
 * GET /api/reports/:id/download - Download PDF file
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/reports/:id/download" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute("/api/reports/$id/download" as any)({
  server: {
    handlers: {
      // GET /api/reports/:id/download - Download PDF
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { id } = params;
          const [report] = await db
            .select()
            .from(reports)
            .where(eq(reports.id, id))
            .limit(1);

          if (!report) {
            return Response.json({ error: "Report not found" }, { status: 404 });
          }

          if (report.status !== "complete" || !report.pdfPath) {
            return Response.json(
              { error: "Report not ready for download" },
              { status: 400 },
            );
          }

          // Verify file exists
          const filePath = report.pdfPath;
          try {
            await stat(filePath);
          } catch {
            log.error("PDF file not found", undefined, { reportId: id });
            return Response.json({ error: "PDF file not found" }, { status: 404 });
          }

          // Read file and return as response
          const filename = path.basename(filePath);
          const fileBuffer = await readFile(filePath);

          return new Response(new Uint8Array(fileBuffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Content-Length": String(fileBuffer.length),
            },
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Download report failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
