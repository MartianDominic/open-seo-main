import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getAuthMode, isHostedAuthMode } from "@/lib/auth-mode";
import { resolveCloudflareAccessContext } from "@/middleware/ensure-user/cloudflareAccess";
import { resolveLocalNoAuthContext } from "@/middleware/ensure-user/delegated";
import { resolveHostedContext } from "@/middleware/ensure-user/hosted";
import type {
  EnsuredProject,
  EnsuredUserContext,
} from "@/middleware/ensure-user/types";
import { AppError } from "@/server/lib/errors";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";

function extractProjectId(data: unknown) {
  if (!data || typeof data !== "object" || !("projectId" in data)) {
    return null;
  }

  const projectId = (data as { projectId?: unknown }).projectId;
  return typeof projectId === "string" && projectId.length > 0
    ? projectId
    : null;
}

/**
 * Authentication middleware — honors AUTH-01 and AUTH-02.
 *
 * - AUTH-01: when `resolveHostedContext(headers)` cannot find a valid
 *   better-auth session it throws `AppError("UNAUTHENTICATED")`, which
 *   surfaces to the client as a 401. Do NOT swallow this — it is the
 *   single source of truth for "unauthenticated requests are rejected".
 * - AUTH-02: on success, `EnsuredUserContext` exposes `userId`,
 *   `userEmail`, and `organizationId` to every downstream server fn.
 *   Phase 6 (AUTH-03) layers `clientId` on top in serverFunctions/middleware.
 *
 * Auth modes:
 *   - `AUTH_MODE=hosted` (prod default, set in .env.vps.example) uses better-auth.
 *   - `AUTH_MODE=local_noauth` delegates to a fixture user (dev only).
 *   - Cloudflare Access path retained for legacy deploys.
 */
export const ensureUserMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next, data }) => {
  const authMode = getAuthMode(process.env.AUTH_MODE);
  const headers = getRequest().headers;
  let context: EnsuredUserContext;

  if (authMode === "local_noauth") {
    context = await resolveLocalNoAuthContext();
  } else if (isHostedAuthMode(authMode)) {
    context = await resolveHostedContext(headers);
  } else {
    context = await resolveCloudflareAccessContext(headers);
  }

  const projectId = extractProjectId(data);

  let project: EnsuredProject | undefined;

  if (projectId) {
    // ADR 0001 intentionally keeps project authorization here so every
    // project-scoped server function gets the same request-scoped org+project
    // check before handlers run. Function-level middleware narrows the type.
    project = await ProjectRepository.getProjectForOrganization(
      projectId,
      context.organizationId,
    );

    if (!project) {
      throw new AppError("NOT_FOUND");
    }
  }

  return next({
    context: {
      ...context,
      project,
    },
  });
});
