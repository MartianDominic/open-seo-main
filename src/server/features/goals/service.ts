/**
 * Goal management service.
 * Phase 22: Goal-Based Metrics System
 */
import { db } from "@/db";
import { clientGoals, goalTemplates } from "@/db/goals-schema";
import { eq, and, desc } from "drizzle-orm";
import { processGoalImmediate } from "@/server/queues/goalQueue";
import type { CreateGoalInput, UpdateGoalInput } from "./types";

export class GoalService {
  /**
   * List all active goal templates
   */
  static async listTemplates() {
    return db
      .select()
      .from(goalTemplates)
      .where(eq(goalTemplates.isActive, true))
      .orderBy(goalTemplates.displayOrder);
  }

  /**
   * Get all goals for a client
   */
  static async listClientGoals(clientId: string) {
    return db
      .select({
        goal: clientGoals,
        template: goalTemplates,
      })
      .from(clientGoals)
      .innerJoin(goalTemplates, eq(clientGoals.templateId, goalTemplates.id))
      .where(eq(clientGoals.clientId, clientId))
      .orderBy(desc(clientGoals.isPrimary), goalTemplates.displayOrder);
  }

  /**
   * Get a single goal by ID
   */
  static async getGoal(goalId: string) {
    const result = await db
      .select({
        goal: clientGoals,
        template: goalTemplates,
      })
      .from(clientGoals)
      .innerJoin(goalTemplates, eq(clientGoals.templateId, goalTemplates.id))
      .where(eq(clientGoals.id, goalId))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Create a new goal for a client
   */
  static async createGoal(
    clientId: string,
    workspaceId: string,
    input: CreateGoalInput,
  ) {
    const id = crypto.randomUUID();

    // If setting as primary, unset any existing primary
    if (input.isPrimary) {
      await db
        .update(clientGoals)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(clientGoals.clientId, clientId));
    }

    // Validate template exists
    const template = await db
      .select()
      .from(goalTemplates)
      .where(eq(goalTemplates.id, input.templateId))
      .limit(1);

    if (!template[0]) {
      throw new Error("Invalid template ID");
    }

    // Check for duplicate template (except custom goals)
    if (template[0].goalType !== "custom") {
      const existing = await db
        .select()
        .from(clientGoals)
        .where(
          and(
            eq(clientGoals.clientId, clientId),
            eq(clientGoals.templateId, input.templateId),
          ),
        )
        .limit(1);

      if (existing[0]) {
        throw new Error(
          `Goal of type "${template[0].name}" already exists for this client`,
        );
      }
    }

    await db.insert(clientGoals).values({
      id,
      clientId,
      workspaceId,
      templateId: input.templateId,
      targetValue: String(input.targetValue),
      targetDenominator: input.targetDenominator,
      customName: input.customName,
      customDescription: input.customDescription,
      isPrimary: input.isPrimary,
      isClientVisible: input.isClientVisible,
    });

    // Trigger immediate computation
    await processGoalImmediate(id);

    return { id };
  }

  /**
   * Update an existing goal
   */
  static async updateGoal(goalId: string, input: UpdateGoalInput) {
    const goal = await this.getGoal(goalId);
    if (!goal) {
      throw new Error("Goal not found");
    }

    // If setting as primary, unset any existing primary
    if (input.isPrimary) {
      await db
        .update(clientGoals)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(clientGoals.clientId, goal.goal.clientId));
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.targetValue !== undefined)
      updates.targetValue = String(input.targetValue);
    if (input.targetDenominator !== undefined)
      updates.targetDenominator = input.targetDenominator;
    if (input.customName !== undefined) updates.customName = input.customName;
    if (input.customDescription !== undefined)
      updates.customDescription = input.customDescription;
    if (input.isPrimary !== undefined) updates.isPrimary = input.isPrimary;
    if (input.isClientVisible !== undefined)
      updates.isClientVisible = input.isClientVisible;
    if (input.currentValue !== undefined)
      updates.currentValue = String(input.currentValue);

    await db.update(clientGoals).set(updates).where(eq(clientGoals.id, goalId));

    // Recompute if target or current value changed
    if (input.targetValue !== undefined || input.currentValue !== undefined) {
      await processGoalImmediate(goalId);
    }

    return { id: goalId };
  }

  /**
   * Delete a goal
   */
  static async deleteGoal(goalId: string) {
    await db.delete(clientGoals).where(eq(clientGoals.id, goalId));
    return { success: true };
  }

  /**
   * Bulk create goals for a client
   */
  static async bulkCreateGoals(
    clientId: string,
    workspaceId: string,
    goals: CreateGoalInput[],
  ) {
    const results = [];

    // First goal in list is primary by default if no primary specified
    const hasPrimary = goals.some((g) => g.isPrimary);

    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i];
      const isPrimary = goal.isPrimary || (!hasPrimary && i === 0);

      try {
        const result = await this.createGoal(clientId, workspaceId, {
          ...goal,
          isPrimary,
        });
        results.push({ success: true, id: result.id });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }
    }

    return results;
  }
}
