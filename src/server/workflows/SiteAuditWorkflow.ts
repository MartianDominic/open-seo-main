/**
 * Phase-2 stub for the site-audit workflow.
 *
 * Cloudflare Workflows are removed. Phase 3 introduces
 * BullMQ; the real worker will live at src/server/workers/audit-worker.ts.
 *
 * This file remains so historical imports continue to type-check. The
 * exported class throws if run() is invoked directly.
 */
import type { BillingCustomerContext } from "@/server/billing/subscription";
import type { AuditConfig } from "@/server/lib/audit/types";

export interface AuditParams {
  auditId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  startUrl: string;
  config: AuditConfig;
}

export class SiteAuditWorkflow {
  async run(_params: AuditParams): Promise<never> {
    throw new Error(
      "SiteAuditWorkflow is disabled in Phase 2. BullMQ audit worker is introduced in Phase 3.",
    );
  }
}
