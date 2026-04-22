import type { WorkflowStep } from "@/server/workflows/workflow-types";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { discoverUrls, fetchRobotsTxt } from "@/server/lib/audit/discovery";
import {
  fetchAndStoreLighthouseResult,
  selectLighthouseSample,
} from "@/server/lib/audit/lighthouse";
import { getOrigin } from "@/server/lib/audit/url-utils";
import { AuditRepository } from "@/server/features/audit/repositories/AuditRepository";
import { AuditProgressKV } from "@/server/lib/audit/progress-kv";
import type {
  AuditConfig,
  LighthouseResult,
  StepPageResult,
} from "@/server/lib/audit/types";
import { captureServerEvent } from "@/server/lib/posthog";
import { runCrawlPhase, type CrawlPhaseResult } from "@/server/workflows/siteAuditWorkflowCrawl";
import { runTier2Checks } from "@/server/lib/audit/checks/runner";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "audit-phases" });

const LIGHTHOUSE_URL_BATCH_SIZE = 10;

function countLighthouseBatchResults(results: LighthouseResult[]): {
  completed: number;
  failed: number;
} {
  let completed = 0;
  let failed = 0;
  for (const result of results) {
    if (result.errorMessage) {
      failed += 1;
      continue;
    }
    completed += 1;
  }
  return { completed, failed };
}

type AuditPhasesParams = {
  auditId: string;
  workflowInstanceId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  startUrl: string;
  config: AuditConfig;
};

export async function runAuditPhases(
  step: WorkflowStep,
  params: AuditPhasesParams,
) {
  const {
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    startUrl,
    config,
  } = params;
  const origin = getOrigin(startUrl);
  const maxPages = config.maxPages;

  const discovery = await runDiscoveryPhase(
    step,
    auditId,
    workflowInstanceId,
    origin,
    maxPages,
  );
  const robots = await fetchRobotsTxt(origin);
  const crawlResult = await runCrawlPhase(step, {
    auditId,
    workflowInstanceId,
    origin,
    startUrl,
    maxPages,
    robots,
    sitemapUrls: discovery.sitemapUrls,
  });
  const { allPages, htmlByPageId } = crawlResult;

  // Run Tier 2 checks after crawl completes (light calculations)
  await runTier2ChecksPhase(step, auditId, workflowInstanceId, allPages, htmlByPageId);

  const lighthouseResults = await runLighthousePhase(step, {
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    startUrl,
    config,
    allPages,
  });
  await finalizeAudit({
    step,
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    config,
    allPages,
    lighthouseResults,
  });
}

async function runDiscoveryPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  origin: string,
  maxPages: number,
) {
  return step.do("discover-urls", async () => {
    const result = await discoverUrls(origin, maxPages);
    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      pagesTotal: Math.min(result.urls.length + 1, maxPages),
      currentPhase: "crawling",
    });
    return { sitemapUrls: result.urls };
  });
}

/**
 * Run Tier 2 checks (light calculations) after crawl completes.
 * Tier 2 includes: reading level, keyword density, word count analysis,
 * schema completeness, anchor analysis, freshness signals, and mobile checks.
 * Runs in <500ms per page per threat model requirements.
 */
async function runTier2ChecksPhase(
  step: WorkflowStep,
  auditId: string,
  workflowInstanceId: string,
  allPages: StepPageResult[],
  htmlByPageId: Map<string, string>,
): Promise<void> {
  return step.do("run-tier2-checks", async () => {
    // Update phase to analyzing
    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      currentPhase: "analyzing",
    });

    // Run Tier 2 checks for each crawled page
    // Tier 2 requires more computation but still no external APIs
    for (const page of allPages) {
      const html = htmlByPageId.get(page.id);

      // Skip pages without HTML (non-HTML content types, failed fetches)
      if (!html || page.statusCode !== 200) {
        continue;
      }

      try {
        // Run Tier 2 checks - light calculations
        const results = await runTier2Checks(html, page.url);

        // Persist findings to database
        if (results.length > 0) {
          await FindingsRepository.insertFindings(auditId, page.id, results);
        }
      } catch (error) {
        // Log but don't fail the audit - checks are non-blocking
        log.warn("Tier 2 checks failed for page", {
          pageId: page.id,
          url: page.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
}

type LighthousePhaseParams = {
  auditId: string;
  workflowInstanceId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  startUrl: string;
  config: AuditConfig;
  allPages: StepPageResult[];
};

async function runLighthousePhase(
  step: WorkflowStep,
  params: LighthousePhaseParams,
): Promise<LighthouseResult[]> {
  const {
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    startUrl,
    config,
    allPages,
  } = params;
  if (config.lighthouseStrategy === "none") return [];

  const lighthouseWork = await selectLighthousePages({
    step,
    auditId,
    workflowInstanceId,
    allPages,
    startUrl,
    strategy: config.lighthouseStrategy,
  });

  const lighthouseResults: LighthouseResult[] = [];
  let completedChecks = 0;
  let failedChecks = 0;
  let lighthouseBatchIndex = 0;

  for (let i = 0; i < lighthouseWork.length; i += LIGHTHOUSE_URL_BATCH_SIZE) {
    const batch = lighthouseWork.slice(i, i + LIGHTHOUSE_URL_BATCH_SIZE);
    lighthouseBatchIndex += 1;
    const lighthouseBatchResults = await runLighthouseBatch({
      step,
      lighthouseBatchIndex,
      batch,
      billingCustomer,
      projectId,
      auditId,
    });

    lighthouseResults.push(...lighthouseBatchResults);
    const counts = countLighthouseBatchResults(lighthouseBatchResults);
    failedChecks += counts.failed;
    completedChecks += counts.completed;
    await step.do(
      `lighthouse-progress-batch-${lighthouseBatchIndex}`,
      async () => {
        await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
          lighthouseCompleted: completedChecks,
          lighthouseFailed: failedChecks,
        });
      },
    );
  }

  return lighthouseResults;
}

async function selectLighthousePages(params: {
  step: WorkflowStep;
  auditId: string;
  workflowInstanceId: string;
  allPages: StepPageResult[];
  startUrl: string;
  strategy: AuditConfig["lighthouseStrategy"];
}) {
  const { step, auditId, workflowInstanceId, allPages, startUrl, strategy } =
    params;
  return step.do("select-lighthouse-sample", async () => {
    const sample = selectLighthouseSample(allPages, startUrl, strategy);
    const selectedUrls = new Set(sample);

    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      currentPhase: "lighthouse",
      lighthouseTotal: sample.length * 2,
      lighthouseCompleted: 0,
      lighthouseFailed: 0,
    });
    return allPages.flatMap((page) =>
      selectedUrls.has(page.url) ? [{ url: page.url, pageId: page.id }] : [],
    );
  });
}

async function runLighthouseBatch(params: {
  step: WorkflowStep;
  lighthouseBatchIndex: number;
  batch: Array<{ url: string; pageId: string }>;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  auditId: string;
}) {
  const {
    step,
    lighthouseBatchIndex,
    batch,
    billingCustomer,
    projectId,
    auditId,
  } = params;
  return step.do(`lighthouse-batch-${lighthouseBatchIndex}`, async () => {
    const perUrlResults = await Promise.all(
      batch.map(async ({ url, pageId }) => {
        const [mobileResult, desktopResult] = await Promise.all([
          fetchAndStoreLighthouseResult({
            url,
            pageId,
            strategy: "mobile",
            billingCustomer,
            projectId,
            auditId,
          }),
          fetchAndStoreLighthouseResult({
            url,
            pageId,
            strategy: "desktop",
            billingCustomer,
            projectId,
            auditId,
          }),
        ]);
        return [mobileResult, desktopResult];
      }),
    );

    return perUrlResults.flat();
  });
}

async function finalizeAudit(args: {
  step: WorkflowStep;
  auditId: string;
  workflowInstanceId: string;
  billingCustomer: BillingCustomerContext;
  projectId: string;
  config: AuditConfig;
  allPages: StepPageResult[];
  lighthouseResults: LighthouseResult[];
}) {
  const {
    step,
    auditId,
    workflowInstanceId,
    billingCustomer,
    projectId,
    config,
    allPages,
    lighthouseResults,
  } = args;

  await step.do("finalize", async () => {
    await AuditRepository.updateAuditProgress(auditId, workflowInstanceId, {
      currentPhase: "finalizing",
    });
    await AuditRepository.batchWriteResults(
      auditId,
      allPages,
      lighthouseResults,
    );
    await AuditRepository.completeAudit(auditId, workflowInstanceId, {
      pagesCrawled: allPages.length,
      pagesTotal: allPages.length,
    });
    await captureServerEvent({
      distinctId: billingCustomer.userId,
      event: "site_audit:complete",
      organizationId: billingCustomer.organizationId,
      properties: {
        project_id: projectId,
        status: "completed",
        pages_crawled: allPages.length,
        pages_total: allPages.length,
        run_lighthouse: config.lighthouseStrategy !== "none",
      },
    });
    await AuditProgressKV.clear(auditId);
  });
}
