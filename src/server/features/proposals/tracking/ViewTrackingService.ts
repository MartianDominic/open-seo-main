/**
 * View tracking service for proposal engagement analytics.
 * Phase 30-04: Engagement Analytics
 *
 * Tracks proposal views with GDPR-compliant IP hashing,
 * session deduplication, and heartbeat-based duration tracking.
 */

import { eq, desc, and, gte } from "drizzle-orm";
import { db } from "@/db/index";
import {
  proposals,
  proposalViews,
  type ProposalViewSelect,
} from "@/db/proposal-schema";
import { AppError } from "@/server/lib/errors";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";
import { getRequiredEnvValueSync } from "@/server/lib/runtime-env";

const log = createLogger({ module: "ViewTrackingService" });

// Session deduplication window in milliseconds (5 minutes)
const SESSION_DEDUP_WINDOW_MS = 5 * 60 * 1000;

export interface ViewTrackingInput {
  proposalId: string;
  deviceType: "mobile" | "desktop" | "tablet";
  ipAddress: string;
  userAgent: string;
}

/**
 * Hash IP address using SHA256 with salt for GDPR compliance.
 * Returns a 16-character truncated hash.
 */
export function hashIpAddress(ipAddress: string): string {
  const salt = getRequiredEnvValueSync("IP_SALT");
  const hash = createHash("sha256")
    .update(ipAddress + salt)
    .digest("hex")
    .slice(0, 16);
  return hash;
}

/**
 * Detect device type from user agent string.
 */
export function detectDeviceType(
  userAgent: string
): "mobile" | "desktop" | "tablet" {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "tablet";
  }
  if (
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("android")
  ) {
    return "mobile";
  }
  return "desktop";
}

export const ViewTrackingService = {
  /**
   * Track a proposal view with IP hashing and session deduplication.
   * Creates a new view record or returns existing recent view from same IP.
   */
  async trackProposalView(input: ViewTrackingInput): Promise<ProposalViewSelect> {
    // Verify proposal exists
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, input.proposalId))
      .limit(1);

    if (!proposal) {
      throw new AppError("NOT_FOUND", "Proposal not found");
    }

    // Hash IP for GDPR compliance
    const ipHash = hashIpAddress(input.ipAddress);

    // Check for recent view from same IP (session deduplication)
    const dedupWindowStart = new Date(Date.now() - SESSION_DEDUP_WINDOW_MS);
    const [existingView] = await db
      .select()
      .from(proposalViews)
      .where(
        and(
          eq(proposalViews.proposalId, input.proposalId),
          eq(proposalViews.ipHash, ipHash),
          gte(proposalViews.viewedAt, dedupWindowStart)
        )
      )
      .orderBy(desc(proposalViews.viewedAt))
      .limit(1);

    // Return existing view if within dedup window
    if (existingView) {
      log.info("Returning existing view (session deduplication)", {
        viewId: existingView.id,
        proposalId: input.proposalId,
      });
      return existingView;
    }

    // Create new view record
    const viewId = nanoid();
    const now = new Date();

    const [newView] = await db
      .insert(proposalViews)
      .values({
        id: viewId,
        proposalId: input.proposalId,
        deviceType: input.deviceType,
        ipHash,
        sectionsViewed: [],
        durationSeconds: 0,
        roiCalculatorUsed: false,
        viewedAt: now,
        createdAt: now,
      })
      .returning();

    // Update proposal firstViewedAt on first view
    if (!proposal.firstViewedAt && proposal.status === "sent") {
      await db
        .update(proposals)
        .set({
          status: "viewed",
          firstViewedAt: now,
          updatedAt: now,
        })
        .where(eq(proposals.id, input.proposalId));

      log.info("Proposal first viewed", { proposalId: input.proposalId });
    }

    log.info("Proposal view tracked", {
      viewId,
      proposalId: input.proposalId,
      deviceType: input.deviceType,
    });

    return newView;
  },

  /**
   * Update view duration (heartbeat from client).
   * Called every 30 seconds while the user is viewing the proposal.
   */
  async updateViewDuration(
    viewId: string,
    durationSeconds: number
  ): Promise<ProposalViewSelect> {
    if (durationSeconds < 0) {
      throw new AppError("VALIDATION_ERROR", "Duration must be positive");
    }

    const [updated] = await db
      .update(proposalViews)
      .set({ durationSeconds })
      .where(eq(proposalViews.id, viewId))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", "View not found");
    }

    log.info("View duration updated", { viewId, durationSeconds });
    return updated;
  },

  /**
   * Update sections viewed array.
   * Called when user scrolls to a new section (via intersection observer).
   */
  async updateSectionsViewed(
    viewId: string,
    sections: string[]
  ): Promise<ProposalViewSelect> {
    // Deduplicate sections
    const uniqueSections = [...new Set(sections)];

    const [updated] = await db
      .update(proposalViews)
      .set({ sectionsViewed: uniqueSections })
      .where(eq(proposalViews.id, viewId))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", "View not found");
    }

    log.info("Sections viewed updated", { viewId, sections: uniqueSections });
    return updated;
  },

  /**
   * Mark ROI calculator as used for this view.
   */
  async markRoiCalculatorUsed(viewId: string): Promise<ProposalViewSelect> {
    const [updated] = await db
      .update(proposalViews)
      .set({ roiCalculatorUsed: true })
      .where(eq(proposalViews.id, viewId))
      .returning();

    if (!updated) {
      throw new AppError("NOT_FOUND", "View not found");
    }

    log.info("ROI calculator marked as used", { viewId });
    return updated;
  },

  /**
   * Get all views for a proposal, ordered by viewedAt descending.
   */
  async getViewsByProposal(proposalId: string): Promise<ProposalViewSelect[]> {
    const views = await db
      .select()
      .from(proposalViews)
      .where(eq(proposalViews.proposalId, proposalId))
      .orderBy(desc(proposalViews.viewedAt));

    return views;
  },
};
