/**
 * Prospect management server functions.
 * Phase 26: Prospect Data Model
 *
 * TanStack Start server functions for prospect CRUD operations.
 * All endpoints require authentication and verify workspace ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ProspectService } from "@/server/features/prospects/services/ProspectService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { PROSPECT_STATUS } from "@/db/prospect-schema";

/**
 * Schema for creating a prospect.
 */
const createProspectSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  companyName: z.string().optional(),
  contactEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  contactName: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  assignedTo: z.string().optional(),
});

/**
 * Schema for updating a prospect.
 */
const updateProspectSchema = z.object({
  companyName: z.string().optional(),
  contactEmail: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  contactName: z.string().optional(),
  industry: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(PROSPECT_STATUS).optional(),
  source: z.string().optional(),
  assignedTo: z.string().optional(),
});

/**
 * Schema for listing prospects.
 */
const listProspectsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  status: z.string().optional(),
});

/**
 * Create a new prospect.
 *
 * T-26-01: Verifies auth.organizationId from Clerk session before insert.
 */
export const createProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createProspectSchema.parse(data))
  .handler(async ({ data, context }) => {
    const prospect = await ProspectService.create({
      workspaceId: context.organizationId,
      ...data,
    });
    return prospect;
  });

/**
 * Get prospect by ID with analyses.
 *
 * T-26-03: Filters results by organizationId to prevent cross-tenant access.
 */
export const getProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const prospect = await ProspectService.findById(data.id);

    if (!prospect) {
      throw new Error("Prospect not found");
    }

    // Verify workspace ownership (T-26-03)
    if (prospect.workspaceId !== context.organizationId) {
      throw new Error("Prospect not found");
    }

    return prospect;
  });

/**
 * List prospects for current workspace.
 *
 * T-26-05: Page size limited to max 100 to prevent DoS.
 */
export const listProspects = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => listProspectsSchema.parse(data))
  .handler(async ({ data, context }) => {
    return ProspectService.findByWorkspace(context.organizationId, data);
  });

/**
 * Update prospect.
 *
 * T-26-02: Re-verifies workspaceId ownership before update.
 */
export const updateProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        updates: updateProspectSchema,
      })
      .parse(data),
  )
  .handler(async ({ data: { id, updates }, context }) => {
    // Verify ownership first (T-26-02)
    const existing = await ProspectService.findById(id);
    if (!existing || existing.workspaceId !== context.organizationId) {
      throw new Error("Prospect not found");
    }

    return ProspectService.update(id, updates);
  });

/**
 * Delete prospect.
 *
 * Verifies workspace ownership before deletion.
 */
export const deleteProspect = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership first
    const existing = await ProspectService.findById(data.id);
    if (!existing || existing.workspaceId !== context.organizationId) {
      throw new Error("Prospect not found");
    }

    await ProspectService.delete(data.id);
    return { success: true };
  });
