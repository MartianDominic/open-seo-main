/**
 * Shared middleware for SEO REST API routes.
 * Phase 10: Validates auth context for API calls from Next.js server actions.
 */
import { AppError } from "@/server/lib/errors";

export interface ApiAuthContext {
  userId: string;
  userEmail: string;
  organizationId: string;
}

/**
 * Extract and validate auth context from request headers.
 * In Phase 10, Next.js server actions pass Clerk JWT via Authorization header.
 *
 * For Phase 10 (before Phase 11 Clerk JWT auth in open-seo):
 * - Accept requests with X-Client-ID header (Phase 7 mechanism)
 * - Use placeholder user context since open-seo's auth middleware isn't wired yet
 *
 * Phase 11 will properly validate Clerk JWTs and extract user context.
 */
export async function requireApiAuth(request: Request): Promise<ApiAuthContext> {
  const authHeader = request.headers.get("Authorization");
  const clientId = request.headers.get("X-Client-ID");

  // Phase 10: We don't validate JWT yet (that's Phase 11).
  // For now, we just need *some* auth context to pass through.
  // In production, this would validate the Clerk JWT.

  // Placeholder context for Phase 10 - will be replaced with real JWT validation in Phase 11
  // The important thing is that clientId scoping works (already implemented in Phase 6/7)
  if (!authHeader && !clientId) {
    throw new AppError("UNAUTHENTICATED", "Authorization header or X-Client-ID required");
  }

  // Return placeholder context - Phase 11 will extract this from JWT
  return {
    userId: "phase10-placeholder",
    userEmail: "phase10@placeholder.local",
    organizationId: "phase10-org",
  };
}
