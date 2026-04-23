/**
 * Velocity control service for internal link additions.
 * Phase 35-04: Auto-Insert + Velocity Control
 *
 * Enforces rate limits to prevent over-optimization:
 * - 3 new links per page per day
 * - 50 new links per site per day
 * - 10 total links per page maximum
 * - 20 pages edited per day
 */
import { eq, and, gte, sql, count } from "drizzle-orm";
import { siteChanges } from "@/db/change-schema";
import { db as appDb } from "@/db";

type AppDb = typeof appDb;

/**
 * Link velocity settings for rate limiting.
 */
export interface LinkVelocitySettings {
  maxNewLinksPerPage: number;
  maxTotalLinksPerPage: number;
  maxLinksPerParagraph: number;
  maxNewLinksPerDay: number;
  maxNewLinksPerWeek: number;
  minDaysBetweenPageEdits: number;
  maxPagesEditedPerDay: number;
}

/**
 * Result of velocity check.
 */
export interface VelocityCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Velocity statistics for a client.
 */
export interface VelocityStats {
  linksToday: number;
  linksThisWeek: number;
  pagesEditedToday: number;
  limits: LinkVelocitySettings;
}

/**
 * VelocityService enforces rate limits for link additions.
 */
export class VelocityService {
  constructor(readonly db: AppDb) {}

  /**
   * Check if adding a link to this page is allowed under velocity limits.
   */
  async checkLinkVelocity(
    clientId: string,
    sourceUrl: string
  ): Promise<VelocityCheckResult> {
    const settings = this.getDefaultSettings();

    // Check page-specific daily limits
    const pageLinksToday = await this.countPageLinksToday(clientId, sourceUrl);
    if (pageLinksToday >= settings.maxNewLinksPerPage) {
      return {
        allowed: false,
        reason: `Page has reached daily limit of ${settings.maxNewLinksPerPage} new links`,
      };
    }

    // Check total links on page ever
    const totalLinksOnPage = await this.countTotalLinksOnPage(clientId, sourceUrl);
    if (totalLinksOnPage >= settings.maxTotalLinksPerPage) {
      return {
        allowed: false,
        reason: `Page has reached maximum of ${settings.maxTotalLinksPerPage} total links added by platform`,
      };
    }

    // Check site-wide daily limits
    const siteLinksToday = await this.countSiteLinksToday(clientId);
    if (siteLinksToday >= settings.maxNewLinksPerDay) {
      return {
        allowed: false,
        reason: `Site has reached daily limit of ${settings.maxNewLinksPerDay} new links`,
      };
    }

    // Check pages edited today
    const pagesEditedToday = await this.countPagesEditedToday(clientId);
    if (pagesEditedToday >= settings.maxPagesEditedPerDay) {
      return {
        allowed: false,
        reason: `Site has reached daily limit of ${settings.maxPagesEditedPerDay} pages edited`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get current velocity statistics for a client.
   */
  async getVelocityStats(clientId: string): Promise<VelocityStats> {
    const [linksToday, linksThisWeek, pagesEditedToday] = await Promise.all([
      this.countSiteLinksToday(clientId),
      this.countSiteLinksThisWeek(clientId),
      this.countPagesEditedToday(clientId),
    ]);

    return {
      linksToday,
      linksThisWeek,
      pagesEditedToday,
      limits: this.getDefaultSettings(),
    };
  }

  /**
   * Get default velocity settings.
   */
  getDefaultSettings(): LinkVelocitySettings {
    return {
      maxNewLinksPerPage: 3,
      maxTotalLinksPerPage: 10,
      maxLinksPerParagraph: 2,
      maxNewLinksPerDay: 50,
      maxNewLinksPerWeek: 200,
      minDaysBetweenPageEdits: 7,
      maxPagesEditedPerDay: 20,
    };
  }

  /**
   * Count links added to a specific page today.
   */
  private async countPageLinksToday(
    clientId: string,
    sourceUrl: string
  ): Promise<number> {
    const todayStart = this.getTodayStartUtc();

    const result = await this.db
      .select({ count: count() })
      .from(siteChanges)
      .where(
        and(
          eq(siteChanges.clientId, clientId),
          eq(siteChanges.resourceUrl, sourceUrl),
          eq(siteChanges.changeType, "internal_link"),
          gte(siteChanges.createdAt, todayStart)
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Count total links ever added to a specific page.
   */
  private async countTotalLinksOnPage(
    clientId: string,
    sourceUrl: string
  ): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(siteChanges)
      .where(
        and(
          eq(siteChanges.clientId, clientId),
          eq(siteChanges.resourceUrl, sourceUrl),
          eq(siteChanges.changeType, "internal_link"),
          eq(siteChanges.status, "applied")
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Count all links added to site today.
   */
  private async countSiteLinksToday(clientId: string): Promise<number> {
    const todayStart = this.getTodayStartUtc();

    const result = await this.db
      .select({ count: count() })
      .from(siteChanges)
      .where(
        and(
          eq(siteChanges.clientId, clientId),
          eq(siteChanges.changeType, "internal_link"),
          gte(siteChanges.createdAt, todayStart)
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Count all links added to site this week.
   */
  private async countSiteLinksThisWeek(clientId: string): Promise<number> {
    const weekStart = this.getWeekStartUtc();

    const result = await this.db
      .select({ count: count() })
      .from(siteChanges)
      .where(
        and(
          eq(siteChanges.clientId, clientId),
          eq(siteChanges.changeType, "internal_link"),
          gte(siteChanges.createdAt, weekStart)
        )
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Count unique pages edited today.
   */
  private async countPagesEditedToday(clientId: string): Promise<number> {
    const todayStart = this.getTodayStartUtc();

    const result = await this.db
      .select({ count: sql<number>`count(distinct ${siteChanges.resourceUrl})` })
      .from(siteChanges)
      .where(
        and(
          eq(siteChanges.clientId, clientId),
          eq(siteChanges.changeType, "internal_link"),
          gte(siteChanges.createdAt, todayStart)
        )
      );

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Get start of today in UTC.
   */
  private getTodayStartUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  /**
   * Get start of current week in UTC (Monday).
   */
  private getWeekStartUtc(): Date {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff)
    );
  }
}

/**
 * Convenience function for checking velocity limits.
 */
export async function checkLinkVelocity(
  db: AppDb,
  clientId: string,
  sourceUrl: string
): Promise<VelocityCheckResult> {
  const service = new VelocityService(db);
  return service.checkLinkVelocity(clientId, sourceUrl);
}
