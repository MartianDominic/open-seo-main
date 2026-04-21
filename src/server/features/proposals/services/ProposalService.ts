/**
 * Proposal management service.
 * Phase 30: Interactive Proposals - Schema & Builder
 *
 * Provides CRUD operations for proposals with state machine transitions.
 * Proposals are generated from prospects to convert them into paying clients.
 */
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "@/db/index";
import {
  proposals,
  proposalViews,
  proposalSignatures,
  proposalPayments,
  type ProposalSelect,
  type ProposalViewSelect,
  type ProposalSignatureSelect,
  type ProposalPaymentSelect,
  type ProposalContent,
  type ProposalStatus,
  PROPOSAL_STATUS,
} from "@/db/proposal-schema";
import { ProspectService, type ProspectWithAnalyses } from "@/server/features/prospects/services/ProspectService";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ProposalService" });

/**
 * Valid status transitions for the proposal state machine.
 * Defines which statuses can transition to which other statuses.
 */
export const VALID_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  draft: ["sent"],
  sent: ["viewed", "expired", "declined"],
  viewed: ["accepted", "expired", "declined"],
  accepted: ["signed", "expired", "declined"],
  signed: ["paid"],
  paid: ["onboarded"],
  onboarded: [],
  expired: [],
  declined: [],
};

/**
 * Check if a status transition is valid.
 */
export function canTransition(
  from: ProposalStatus,
  to: ProposalStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Generate a secure random token for public proposal access.
 */
function generateToken(): string {
  return nanoid(32);
}

export interface CreateProposalInput {
  prospectId: string;
  workspaceId: string;
  template?: string;
  content?: ProposalContent;
  brandConfig?: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  setupFeeCents?: number;
  monthlyFeeCents?: number;
  currency?: string;
}

export interface UpdateProposalInput {
  template?: string;
  content?: ProposalContent;
  brandConfig?: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  setupFeeCents?: number;
  monthlyFeeCents?: number;
  currency?: string;
  expiresAt?: Date | null;
}

export interface ProposalWithRelations extends ProposalSelect {
  views: ProposalViewSelect[];
  signatures: ProposalSignatureSelect[];
  payments: ProposalPaymentSelect[];
}

export interface PaginatedProposals {
  data: ProposalSelect[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecordViewInput {
  deviceType?: string;
  ipHash?: string;
  sectionsViewed?: string[];
  durationSeconds?: number;
  roiCalculatorUsed?: boolean;
}

/**
 * Generate default proposal content from prospect analysis data.
 */
export function generateDefaultContent(
  prospect: ProspectWithAnalyses,
): ProposalContent {
  const latestAnalysis = prospect.analyses?.[0];
  const metrics = latestAnalysis?.domainMetrics;
  const opportunities = latestAnalysis?.opportunityKeywords ?? [];

  const companyName = prospect.companyName ?? prospect.domain;
  const traffic = metrics?.organicTraffic ?? 0;
  const keywords = metrics?.organicKeywords ?? 0;

  // Calculate traffic value estimate (traffic * avg CPC)
  const avgCpc =
    opportunities.length > 0
      ? opportunities.reduce((sum, o) => sum + (o.cpc ?? 0), 0) /
        opportunities.length
      : 2.5;
  const trafficValue = Math.round(traffic * avgCpc);

  // Convert opportunity keywords to proposal format
  const proposalOpportunities = opportunities.slice(0, 10).map((opp) => ({
    keyword: opp.keyword,
    volume: opp.searchVolume,
    difficulty: getDifficultyLevel(opp.difficulty),
    potential: Math.round(opp.searchVolume * (opp.cpc ?? 2.5)),
  }));

  // Calculate projected gains
  const projectedTrafficGain = opportunities.reduce(
    (sum, o) => sum + Math.round(o.searchVolume * 0.1),
    0,
  );
  const projectedValue = Math.round(projectedTrafficGain * avgCpc);

  return {
    hero: {
      headline: `Grow ${companyName}'s Online Presence`,
      subheadline: "SEO strategy tailored for your business goals",
      trafficValue: trafficValue + projectedValue,
    },
    currentState: {
      traffic,
      keywords,
      value: trafficValue,
      chartData: generateMockChartData(traffic),
    },
    opportunities: proposalOpportunities,
    roi: {
      projectedTrafficGain,
      trafficValue: projectedValue,
      defaultConversionRate: 0.02,
      defaultAov: 150,
    },
    investment: {
      setupFee: 2500,
      monthlyFee: 1500,
      inclusions: [
        "Technical SEO audit and fixes",
        "Content optimization strategy",
        "Monthly performance reporting",
        "Keyword tracking dashboard",
        "Competitor monitoring",
      ],
    },
    nextSteps: [
      "Review and approve this proposal",
      "Sign the service agreement",
      "Complete the onboarding call",
      "Receive your initial audit report",
    ],
  };
}

function getDifficultyLevel(score: number): "easy" | "medium" | "hard" {
  if (score < 30) return "easy";
  if (score < 60) return "medium";
  return "hard";
}

function generateMockChartData(
  currentTraffic: number,
): Array<{ month: string; traffic: number }> {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const variance = currentTraffic * 0.1;
  return months.map((month, i) => ({
    month,
    traffic: Math.round(
      currentTraffic - variance * (months.length - 1 - i) * 0.5,
    ),
  }));
}

export const ProposalService = {
  /**
   * Create a new proposal from a prospect.
   * Generates default content from prospect analysis data.
   *
   * Uses Drizzle ORM parameterized queries to prevent SQL injection.
   */
  async create(input: CreateProposalInput): Promise<ProposalSelect> {
    // Verify prospect exists and belongs to workspace
    const prospect = await ProspectService.findById(input.prospectId);

    if (!prospect) {
      throw new AppError("NOT_FOUND", "Prospect not found");
    }

    if (prospect.workspaceId !== input.workspaceId) {
      throw new AppError("NOT_FOUND", "Prospect not found");
    }

    const id = nanoid();
    const token = generateToken();
    const now = new Date();

    // Generate content from prospect or use provided content
    const content = input.content ?? generateDefaultContent(prospect);

    const [created] = await db
      .insert(proposals)
      .values({
        id,
        prospectId: input.prospectId,
        workspaceId: input.workspaceId,
        template: input.template ?? "standard",
        content,
        brandConfig: input.brandConfig,
        setupFeeCents: input.setupFeeCents ?? content.investment.setupFee * 100,
        monthlyFeeCents:
          input.monthlyFeeCents ?? content.investment.monthlyFee * 100,
        currency: input.currency ?? "EUR",
        status: "draft",
        token,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    log.info("Proposal created", { id, prospectId: input.prospectId });
    return created;
  },

  /**
   * Find proposal by ID with related views, signatures, and payments.
   */
  async findById(id: string): Promise<ProposalWithRelations | null> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);

    if (!proposal) return null;

    const [views, signatures, payments] = await Promise.all([
      db
        .select()
        .from(proposalViews)
        .where(eq(proposalViews.proposalId, id))
        .orderBy(desc(proposalViews.viewedAt)),
      db
        .select()
        .from(proposalSignatures)
        .where(eq(proposalSignatures.proposalId, id))
        .orderBy(desc(proposalSignatures.createdAt)),
      db
        .select()
        .from(proposalPayments)
        .where(eq(proposalPayments.proposalId, id))
        .orderBy(desc(proposalPayments.createdAt)),
    ]);

    return { ...proposal, views, signatures, payments };
  },

  /**
   * Find proposal by public access token.
   * Used for unauthenticated viewing of proposals.
   */
  async findByToken(token: string): Promise<ProposalSelect | null> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.token, token))
      .limit(1);

    return proposal ?? null;
  },

  /**
   * Find all proposals for a workspace with pagination.
   * Page size limited to max 100 to prevent DoS.
   */
  async findByWorkspace(
    workspaceId: string,
    options: { page?: number; pageSize?: number; status?: string } = {},
  ): Promise<PaginatedProposals> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    let whereClause = eq(proposals.workspaceId, workspaceId);
    if (options.status) {
      whereClause = and(whereClause, eq(proposals.status, options.status))!;
    }

    const [data, [{ total }]] = await Promise.all([
      db
        .select()
        .from(proposals)
        .where(whereClause)
        .orderBy(desc(proposals.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(proposals).where(whereClause),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
    };
  },

  /**
   * Update proposal fields.
   * Only allowed in draft status for most fields.
   */
  async update(id: string, input: UpdateProposalInput): Promise<ProposalSelect> {
    const [updated] = await db
      .update(proposals)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", "Proposal not found");
    }

    log.info("Proposal updated", { id });
    return updated;
  },

  /**
   * Mark proposal as sent and set expiration.
   * Only valid transition from draft status.
   */
  async markSent(
    id: string,
    expiresAt?: Date,
  ): Promise<ProposalSelect> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);

    if (!proposal) {
      throw new AppError("NOT_FOUND", "Proposal not found");
    }

    if (!canTransition(proposal.status as ProposalStatus, "sent")) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Cannot transition from ${proposal.status} to sent`,
      );
    }

    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30); // 30 days default

    const [updated] = await db
      .update(proposals)
      .set({
        status: "sent",
        sentAt: new Date(),
        expiresAt: expiresAt ?? defaultExpiry,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning();

    log.info("Proposal marked as sent", { id });
    return updated;
  },

  /**
   * Record a view of the proposal.
   * Updates firstViewedAt and status on first view.
   */
  async recordView(
    proposalId: string,
    input: RecordViewInput,
  ): Promise<ProposalViewSelect> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      throw new AppError("NOT_FOUND", "Proposal not found");
    }

    // Create view record
    const viewId = nanoid();
    const [view] = await db
      .insert(proposalViews)
      .values({
        id: viewId,
        proposalId,
        deviceType: input.deviceType,
        ipHash: input.ipHash,
        sectionsViewed: input.sectionsViewed,
        durationSeconds: input.durationSeconds,
        roiCalculatorUsed: input.roiCalculatorUsed ?? false,
      })
      .returning();

    // Update proposal on first view
    if (!proposal.firstViewedAt && proposal.status === "sent") {
      await db
        .update(proposals)
        .set({
          status: "viewed",
          firstViewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, proposalId));

      log.info("Proposal first viewed", { proposalId });
    }

    return view;
  },

  /**
   * Mark proposal as accepted by the recipient.
   */
  async markAccepted(id: string): Promise<ProposalSelect> {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, id))
      .limit(1);

    if (!proposal) {
      throw new AppError("NOT_FOUND", "Proposal not found");
    }

    if (!canTransition(proposal.status as ProposalStatus, "accepted")) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Cannot transition from ${proposal.status} to accepted`,
      );
    }

    const [updated] = await db
      .update(proposals)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning();

    log.info("Proposal accepted", { id });
    return updated;
  },

  /**
   * Delete proposal and all related records (cascades via FK).
   */
  async delete(id: string): Promise<void> {
    const [deleted] = await db
      .delete(proposals)
      .where(eq(proposals.id, id))
      .returning({ id: proposals.id });

    if (!deleted) {
      throw new AppError("NOT_FOUND", "Proposal not found");
    }

    log.info("Proposal deleted", { id });
  },
};
