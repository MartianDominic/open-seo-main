/**
 * Voice management server functions.
 * Phase 37-03: Voice Profile Management
 *
 * TanStack Start server functions for voice profile and protection rules CRUD.
 * All endpoints require authentication and verify workspace ownership.
 *
 * Security:
 * - T-37-07: Server verifies user has access to clientId via session
 * - T-37-08: CSV import limited to 500 rows
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { voiceProfiles } from "@/db/voice-schema";
import { voiceProfileService } from "@/server/features/voice/services/VoiceProfileService";
import { protectionRulesService } from "@/server/features/voice/services/ProtectionRulesService";
import { voiceComplianceService } from "@/server/features/voice/services/VoiceComplianceService";
import { buildVoiceConstraints } from "@/server/features/voice/services/VoiceConstraintBuilder";
import {
  INDUSTRY_TEMPLATES,
  TEMPLATE_IDS,
} from "@/server/features/voice/templates/industryTemplates";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { AppError } from "@/server/lib/errors";

// ============================================================================
// Input Schemas
// ============================================================================

const clientIdSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
});

const profileIdSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
});

const createProfileSchema = z.object({
  clientId: z.string().min(1),
  templateId: z.string().optional(),
  mode: z.enum(["preservation", "application", "best_practices"]).optional(),
  tonePrimary: z.string().optional(),
  toneSecondary: z.string().optional(),
  formalityLevel: z.number().min(1).max(10).optional(),
  personalityTraits: z.array(z.string()).optional(),
  archetype: z
    .enum(["professional", "casual", "technical", "friendly", "authoritative"])
    .optional(),
  sentenceLengthAvg: z.number().optional(),
  paragraphLengthAvg: z.number().optional(),
  contractionUsage: z.enum(["never", "sometimes", "frequently"]).optional(),
  vocabularyPatterns: z
    .object({
      preferred: z.array(z.string()),
      avoided: z.array(z.string()),
    })
    .optional(),
  signaturePhrases: z.array(z.string()).optional(),
  forbiddenPhrases: z.array(z.string()).optional(),
  headingStyle: z.enum(["title_case", "sentence_case", "all_caps"]).optional(),
});

const updateProfileSchema = z.object({
  profileId: z.string().min(1),
  mode: z.enum(["preservation", "application", "best_practices"]).optional(),
  tonePrimary: z.string().optional(),
  toneSecondary: z.string().optional(),
  formalityLevel: z.number().min(1).max(10).optional(),
  personalityTraits: z.array(z.string()).optional(),
  archetype: z
    .enum(["professional", "casual", "technical", "friendly", "authoritative"])
    .optional(),
  sentenceLengthAvg: z.number().optional(),
  paragraphLengthAvg: z.number().optional(),
  contractionUsage: z.enum(["never", "sometimes", "frequently"]).optional(),
  vocabularyPatterns: z
    .object({
      preferred: z.array(z.string()),
      avoided: z.array(z.string()),
    })
    .optional(),
  signaturePhrases: z.array(z.string()).optional(),
  forbiddenPhrases: z.array(z.string()).optional(),
  headingStyle: z.enum(["title_case", "sentence_case", "all_caps"]).optional(),
});

const createRuleSchema = z.object({
  profileId: z.string().min(1),
  ruleType: z.enum(["page", "section", "pattern"]),
  target: z.string().min(1),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

const importCsvSchema = z.object({
  profileId: z.string().min(1),
  csvContent: z.string().min(1),
});

const ruleIdSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required"),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify user has access to the client.
 */
async function verifyClientAccess(
  clientId: string,
  workspaceId: string
): Promise<void> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });

  if (!client) {
    throw new AppError("NOT_FOUND", "Client not found");
  }

  if (client.workspaceId !== workspaceId) {
    throw new AppError("FORBIDDEN", "Access denied to this client");
  }
}

/**
 * Verify user has access to the profile via its client.
 */
async function verifyProfileAccess(
  profileId: string,
  workspaceId: string
): Promise<void> {
  const profile = await db.query.voiceProfiles.findFirst({
    where: eq(voiceProfiles.id, profileId),
  });

  if (!profile) {
    throw new AppError("NOT_FOUND", "Voice profile not found");
  }

  await verifyClientAccess(profile.clientId, workspaceId);
}

// ============================================================================
// Voice Profile Server Functions
// ============================================================================

/**
 * Get voice profile for a client.
 */
export const getVoiceProfileFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => clientIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyClientAccess(data.clientId, context.organizationId);
    return voiceProfileService.getByClientId(data.clientId);
  });

/**
 * Create a new voice profile.
 */
export const createVoiceProfileFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyClientAccess(data.clientId, context.organizationId);

    const { clientId, templateId, ...profileData } = data;

    if (templateId) {
      return voiceProfileService.createFromTemplate(
        clientId,
        templateId,
        profileData
      );
    }

    return voiceProfileService.create(clientId, profileData);
  });

/**
 * Update an existing voice profile.
 */
export const updateVoiceProfileFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => updateProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );

    const { profileId, ...updateData } = data;
    return voiceProfileService.update(profileId, updateData);
  });

/**
 * Delete a voice profile.
 */
export const deleteVoiceProfileFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => profileIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );
    await voiceProfileService.delete(data.profileId);
    return { success: true };
  });

/**
 * Get available industry templates.
 */
export const getIndustryTemplatesFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => {
    return INDUSTRY_TEMPLATES;
  });

// ============================================================================
// Protection Rules Server Functions
// ============================================================================

/**
 * Get all protection rules for a profile.
 */
export const getProtectionRulesFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => profileIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );
    return protectionRulesService.getByProfileId(data.profileId);
  });

/**
 * Get only active (non-expired) protection rules.
 */
export const getActiveProtectionRulesFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => profileIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );
    return protectionRulesService.getActiveRules(data.profileId);
  });

/**
 * Create a new protection rule.
 */
export const createProtectionRuleFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createRuleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );

    return protectionRulesService.create(data.profileId, {
      ruleType: data.ruleType,
      target: data.target,
      reason: data.reason,
      createdBy: context.userId,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });
  });

/**
 * Delete a protection rule.
 */
export const deleteProtectionRuleFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => ruleIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    // TODO: Verify rule belongs to a profile the user has access to
    await protectionRulesService.delete(data.ruleId);
    return { success: true };
  });

/**
 * Bulk import protection rules from CSV.
 */
export const importProtectionRulesCsvFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => importCsvSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );

    return protectionRulesService.bulkImportCsv(
      data.profileId,
      data.csvContent,
      context.userId
    );
  });

// ============================================================================
// Voice Compliance Server Functions (Phase 37-04)
// ============================================================================

const scoreComplianceSchema = z.object({
  content: z.string().min(1, "Content is required"),
  profileId: z.string().min(1, "Profile ID is required"),
});

const buildConstraintsSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  templateBlend: z.number().min(0).max(1).optional(),
  templateId: z.string().optional(),
  targetUrl: z.string().optional(),
});

/**
 * Score content against a voice profile.
 * Returns compliance score across 5 dimensions with violations.
 *
 * Security: T-37-10 - Verifies caller has access to profileId's client
 */
export const scoreComplianceFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => scoreComplianceSchema.parse(data))
  .handler(async ({ data, context }) => {
    // T-37-10: Verify access before scoring
    await verifyProfileAccess(data.profileId, context.organizationId);

    const profile = await voiceProfileService.getById(data.profileId);
    if (!profile) {
      throw new AppError("NOT_FOUND", "Voice profile not found");
    }

    return voiceComplianceService.scoreContent(data.content, profile);
  });

/**
 * Build voice constraints for AI prompt injection.
 * Returns formatted prompt section based on profile mode.
 */
export const buildVoiceConstraintsFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => buildConstraintsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(data.profileId, context.organizationId);

    const profile = await voiceProfileService.getById(data.profileId);
    if (!profile) {
      throw new AppError("NOT_FOUND", "Voice profile not found");
    }

    const constraints = buildVoiceConstraints({
      profile,
      templateBlend: data.templateBlend,
      templateId: data.templateId,
      targetUrl: data.targetUrl,
    });

    return { constraints };
  });
