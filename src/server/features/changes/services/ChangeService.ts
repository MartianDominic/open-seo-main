/**
 * Change Service
 * Phase 33: Auto-Fix System
 *
 * Orchestrates auto-fix operations with before/after tracking.
 * Uses edit recipes to execute changes via platform adapters.
 */
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { siteChanges } from '@/db/change-schema';
import { eq } from 'drizzle-orm';
import type { SiteChangeInsert, SiteChangeSelect } from '@/db/change-schema';
import type { PlatformWriteAdapter } from '@/server/features/connections/adapters/BaseAdapter';
import {
  resolveRecipe,
  isRecipeSafe,
  getRecipeInfo,
  type RecipeContext,
  type RecipeResult
} from '@/lib/edit-recipes';
import {
  ChangeRepository,
  insertChange,
  markChangeVerified,
  markChangeFailed
} from '../repositories/ChangeRepository';

/**
 * Input for applying a single change.
 */
export interface ApplyChangeInput {
  clientId: string;
  connectionId: string;
  recipeId: string;
  context: RecipeContext;
  triggeredBy: 'audit' | 'manual' | 'scheduled' | 'ai_suggestion';
  auditId?: string;
  findingId?: string;
  userId?: string;
  batchId?: string;
  batchSequence?: number;
}

/**
 * Result of applying a change.
 */
export interface ApplyChangeResult {
  success: boolean;
  changeId: string | null;
  error?: string;
  recipeResult?: RecipeResult;
}

/**
 * Result of batch change operation.
 */
export interface BatchChangeResult {
  batchId: string;
  total: number;
  succeeded: string[];
  failed: Array<{ findingId?: string; error: string }>;
}

/**
 * Apply a single change using an edit recipe.
 * Captures before state, executes change, verifies after state.
 */
export async function applyChange(
  adapter: PlatformWriteAdapter,
  input: ApplyChangeInput
): Promise<ApplyChangeResult> {
  const { recipeId, context, clientId, connectionId, triggeredBy, auditId, findingId, userId, batchId, batchSequence } = input;

  // 1. Validate recipe exists
  const recipeInfo = getRecipeInfo(recipeId);
  if (!recipeInfo) {
    return { success: false, changeId: null, error: `Unknown recipe: ${recipeId}` };
  }

  // 2. Check if recipe is safe for auto-application
  if (triggeredBy === 'audit' && !isRecipeSafe(recipeId)) {
    return {
      success: false,
      changeId: null,
      error: `Recipe ${recipeId} requires human review`
    };
  }

  // 3. Resolve recipe handler
  const handler = resolveRecipe(recipeId);
  if (!handler) {
    return { success: false, changeId: null, error: `No handler for recipe: ${recipeId}` };
  }

  // 4. Create pending change record
  const changeId = nanoid();
  const changeRecord: SiteChangeInsert = {
    id: changeId,
    clientId,
    connectionId,
    changeType: recipeInfo.field,
    category: recipeInfo.category,
    resourceType: context.resourceType,
    resourceId: context.resourceId,
    resourceUrl: context.resourceUrl,
    field: recipeInfo.field,
    beforeValue: context.currentValue ?? null,
    afterValue: null, // Will be set after execution
    triggeredBy,
    auditId: auditId ?? null,
    findingId: findingId ?? null,
    userId: userId ?? null,
    status: 'pending',
    batchId: batchId ?? null,
    batchSequence: batchSequence ?? null,
  };

  try {
    // 5. Insert pending record
    await insertChange(changeRecord);

    // 6. Execute recipe handler
    const result = await handler(adapter, context);

    if (!result.success) {
      // Mark change as failed
      await markChangeFailed(changeId);
      return { success: false, changeId, error: result.error, recipeResult: result };
    }

    // 7. Update change record with results
    await db.transaction(async (tx) => {
      await tx.update(siteChanges)
        .set({
          beforeValue: result.beforeValue,
          afterValue: result.afterValue,
          status: result.verified ? 'verified' : 'applied',
          appliedAt: new Date(),
          verifiedAt: result.verified ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(siteChanges.id, changeId));
    });

    return { success: true, changeId, recipeResult: result };
  } catch (error) {
    // Mark change as failed
    await markChangeFailed(changeId);
    return {
      success: false,
      changeId,
      error: (error as Error).message
    };
  }
}

/**
 * Apply multiple changes as a batch.
 * Each change is executed in sequence with its own savepoint.
 */
export async function applyBatchChanges(
  adapter: PlatformWriteAdapter,
  inputs: Omit<ApplyChangeInput, 'batchId' | 'batchSequence'>[]
): Promise<BatchChangeResult> {
  const batchId = nanoid();
  const succeeded: string[] = [];
  const failed: Array<{ findingId?: string; error: string }> = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const result = await applyChange(adapter, {
      ...input,
      batchId,
      batchSequence: i,
    });

    if (result.success && result.changeId) {
      succeeded.push(result.changeId);
    } else {
      failed.push({
        findingId: input.findingId,
        error: result.error || 'Unknown error',
      });
    }
  }

  return {
    batchId,
    total: inputs.length,
    succeeded,
    failed,
  };
}

/**
 * Preview what a change would do without applying it.
 * Reads current value to show before state.
 */
export async function previewChange(
  adapter: PlatformWriteAdapter,
  recipeId: string,
  context: RecipeContext
): Promise<{
  recipeId: string;
  recipeName: string;
  field: string;
  currentValue: string | null;
  newValue: string | null;
  isSafe: boolean;
}> {
  const recipeInfo = getRecipeInfo(recipeId);
  if (!recipeInfo) {
    throw new Error(`Unknown recipe: ${recipeId}`);
  }

  // Read current value if not provided
  const currentValue = context.currentValue ??
    await adapter.readField(context.resourceId, recipeInfo.field);

  return {
    recipeId,
    recipeName: recipeInfo.name,
    field: recipeInfo.field,
    currentValue,
    newValue: context.suggestedValue ?? null,
    isSafe: isRecipeSafe(recipeId),
  };
}

/**
 * Get change history for a resource.
 */
export async function getChangeHistory(
  resourceId: string,
  resourceType?: string
): Promise<SiteChangeSelect[]> {
  return ChangeRepository.getChangesByResource(resourceId, resourceType);
}

export const ChangeService = {
  applyChange,
  applyBatchChanges,
  previewChange,
  getChangeHistory,
};
