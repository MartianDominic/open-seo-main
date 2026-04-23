/**
 * Audit page detail view with SEO score and findings.
 * Phase 32: 107 SEO Checks Implementation
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ScoreCard } from "./-components/ScoreCard";
import { FindingsPanel } from "./-components/FindingsPanel";

// @ts-expect-error - Route path not in generated types yet
export const Route = createFileRoute("/_project/p/$projectId/audit/$pageId/")({
  component: AuditPageDetail,
});

function AuditPageDetail() {
  const { projectId, pageId } = Route.useParams();

  // Placeholder data - will be replaced with actual API call
  const mockScore = {
    score: 78,
    breakdown: { base: 60, tier1: 12.3, tier2: 4.5, tier3: 1.2 },
    gates: [] as string[],
  };

  const mockFindings = [
    {
      id: "1",
      checkId: "T1-01",
      tier: 1,
      category: "html-signals",
      passed: true,
      severity: "high" as const,
      message: "Page has valid DOCTYPE declaration",
      autoEditable: false,
    },
    {
      id: "2",
      checkId: "T1-05",
      tier: 1,
      category: "title-meta",
      passed: false,
      severity: "high" as const,
      message: "Title tag is too long (78 characters, max 60)",
      autoEditable: true,
    },
    {
      id: "3",
      checkId: "T1-10",
      tier: 1,
      category: "heading-structure",
      passed: true,
      severity: "medium" as const,
      message: "Page has exactly one H1 tag",
      autoEditable: false,
    },
    {
      id: "4",
      checkId: "T2-01",
      tier: 2,
      category: "content-quality",
      passed: false,
      severity: "medium" as const,
      message: "Reading level too high (Grade 11, target Grade 9)",
      autoEditable: true,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/p/$projectId/audit"
            params={{ projectId }}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Audit
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Page Analysis</h1>
          <p className="text-sm text-gray-500">Page ID: {pageId}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ScoreCard
            score={mockScore.score}
            breakdown={mockScore.breakdown}
            gates={mockScore.gates}
          />
        </div>
        <div className="lg:col-span-2">
          <FindingsPanel findings={mockFindings} />
        </div>
      </div>
    </div>
  );
}
