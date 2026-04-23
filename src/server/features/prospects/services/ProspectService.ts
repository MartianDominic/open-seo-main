/**
 * Prospect management service.
 * Phase 26: Prospect Data Model
 *
 * Provides CRUD operations for prospects with domain validation.
 * Prospects are potential clients stored by domain with SEO analysis data.
 */
import { eq, and, desc, count, asc, isNull } from "drizzle-orm";
import { db } from "@/db/index";
import {
  prospects,
  prospectAnalyses,
  type ProspectSelect,
  type ProspectAnalysisSelect,
  PROSPECT_STATUS,
} from "@/db/prospect-schema";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";

// Domain validation regex - matches valid domain names
// Allows: example.com, sub.example.com, example.co.uk
// Rejects: invalid chars, missing TLD, IP addresses
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/**
 * Normalize a domain string for storage.
 * Removes protocol, www prefix, path, and port.
 * Lowercases the result.
 */
function normalizeDomain(domain: string): string {
  // Remove protocol if present
  let normalized = domain.replace(/^https?:\/\//, "");
  // Remove www. prefix
  normalized = normalized.replace(/^www\./, "");
  // Remove trailing slash and path
  normalized = normalized.split("/")[0];
  // Remove port
  normalized = normalized.split(":")[0];
  // Lowercase
  return normalized.toLowerCase().trim();
}

/**
 * Validate and normalize a domain string.
 * @throws AppError("BAD_REQUEST") if domain format is invalid
 */
function validateDomain(domain: string): string {
  const normalized = normalizeDomain(domain);
  if (!DOMAIN_REGEX.test(normalized)) {
    throw new AppError("VALIDATION_ERROR", `Invalid domain format: ${domain}`);
  }
  return normalized;
}

export interface CreateProspectInput {
  workspaceId: string;
  domain: string;
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  notes?: string;
  source?: string;
  assignedTo?: string;
}

export interface UpdateProspectInput {
  companyName?: string;
  contactEmail?: string;
  contactName?: string;
  industry?: string;
  notes?: string;
  status?: string;
  source?: string;
  assignedTo?: string;
}

export interface ProspectWithAnalyses extends ProspectSelect {
  analyses: ProspectAnalysisSelect[];
}

export interface PaginatedProspects {
  data: ProspectSelect[];
  total: number;
  page: number;
  pageSize: number;
}

export const ProspectService = {
  /**
   * Create a new prospect with domain validation.
   * Throws if domain already exists in workspace.
   *
   * T-26-04: Uses Drizzle ORM parameterized queries to prevent SQL injection.
   */
  async create(input: CreateProspectInput): Promise<ProspectSelect> {
    const normalizedDomain = validateDomain(input.domain);

    // Check for duplicate domain in workspace
    const existing = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(
        and(
          eq(prospects.workspaceId, input.workspaceId),
          eq(prospects.domain, normalizedDomain),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new AppError(
        "CONFLICT",
        `Prospect with domain ${normalizedDomain} already exists in this workspace`,
      );
    }

    const id = nanoid();
    const now = new Date();

    const [created] = await db
      .insert(prospects)
      .values({
        id,
        workspaceId: input.workspaceId,
        domain: normalizedDomain,
        companyName: input.companyName,
        contactEmail: input.contactEmail,
        contactName: input.contactName,
        industry: input.industry,
        notes: input.notes,
        source: input.source,
        assignedTo: input.assignedTo,
        status: "new",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  },

  /**
   * Find prospect by ID with its analyses.
   */
  async findById(id: string): Promise<ProspectWithAnalyses | null> {
    const [prospect] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, id))
      .limit(1);

    if (!prospect) return null;

    const analyses = await db
      .select()
      .from(prospectAnalyses)
      .where(eq(prospectAnalyses.prospectId, id))
      .orderBy(desc(prospectAnalyses.createdAt));

    return { ...prospect, analyses };
  },

  /**
   * Find all prospects for a workspace with pagination.
   *
   * T-26-05: Limits pageSize to max 100 to prevent DoS.
   */
  async findByWorkspace(
    workspaceId: string,
    options: { page?: number; pageSize?: number; status?: string; sortBy?: "priority" | "created" } = {},
  ): Promise<PaginatedProspects> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const sortBy = options.sortBy ?? "created";

    let whereClause = eq(prospects.workspaceId, workspaceId);
    if (options.status) {
      whereClause = and(whereClause, eq(prospects.status, options.status))!;
    }

    // Sort by priority (descending, nulls last) or created date
    const orderByClause =
      sortBy === "priority"
        ? [desc(prospects.priorityScore), desc(prospects.createdAt)]
        : [desc(prospects.createdAt)];

    const [data, [{ total }]] = await Promise.all([
      db
        .select()
        .from(prospects)
        .where(whereClause)
        .orderBy(...orderByClause)
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(prospects).where(whereClause),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
    };
  },

  /**
   * Update prospect fields.
   *
   * T-26-02: Caller must verify workspace ownership before calling.
   */
  async update(id: string, input: UpdateProspectInput): Promise<ProspectSelect> {
    // Validate status if provided
    if (input.status && !PROSPECT_STATUS.includes(input.status as any)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Invalid status: ${input.status}. Must be one of: ${PROSPECT_STATUS.join(", ")}`,
      );
    }

    const [updated] = await db
      .update(prospects)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, id))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${id}`);
    }

    return updated;
  },

  /**
   * Delete prospect (cascades to analyses via FK).
   */
  async delete(id: string): Promise<void> {
    const [deleted] = await db
      .delete(prospects)
      .where(eq(prospects.id, id))
      .returning({ id: prospects.id });

    if (!deleted) {
      throw new AppError("NOT_FOUND", `Prospect not found: ${id}`);
    }
  },

  /**
   * Update prospect status to 'analyzing' before starting analysis.
   */
  async markAnalyzing(id: string): Promise<void> {
    await db
      .update(prospects)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(prospects.id, id));
  },

  /**
   * Update prospect status to 'analyzed' after analysis completes.
   */
  async markAnalyzed(id: string): Promise<void> {
    await db
      .update(prospects)
      .set({ status: "analyzed", updatedAt: new Date() })
      .where(eq(prospects.id, id));
  },

  /**
   * Update prospect status to 'converted' and link to client.
   */
  async markConverted(id: string, clientId: string): Promise<void> {
    await db
      .update(prospects)
      .set({
        status: "converted",
        convertedClientId: clientId,
        updatedAt: new Date(),
      })
      .where(eq(prospects.id, id));
  },
};
