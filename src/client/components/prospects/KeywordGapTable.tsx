/**
 * KeywordGapTable component
 * Phase 28: Keyword Gap Analysis UI
 *
 * Displays keyword gaps in a sortable table with:
 * - Columns: Keyword, Competitor, Position, Volume, CPC, Difficulty, Opportunity Score
 * - Sortable by all columns (default: Opportunity desc)
 * - DifficultyBadge for visual difficulty indicator
 * - Add to targets action (placeholder)
 */
import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { Button } from "@/client/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/client/components/ui/tooltip";
import { DifficultyBadge } from "./DifficultyBadge";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import type { KeywordGap } from "@/db/prospect-schema";

// Sortable columns
export type SortColumn =
  | "keyword"
  | "competitorDomain"
  | "competitorPosition"
  | "searchVolume"
  | "cpc"
  | "difficulty"
  | "trafficPotential";

export type SortDirection = "asc" | "desc";

/**
 * Summary statistics for keyword gaps
 */
export interface GapSummary {
  totalGaps: number;
  avgOpportunity: number;
  totalVolume: number;
  avgDifficulty: number;
  uniqueCompetitors: number;
}

/**
 * Sorts keyword gaps by specified column and direction.
 * Returns a new array (immutable).
 */
export function sortKeywordGaps(
  gaps: KeywordGap[],
  column: SortColumn,
  direction: SortDirection
): KeywordGap[] {
  if (gaps.length === 0) return [];

  const sorted = [...gaps];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (column) {
      case "keyword":
      case "competitorDomain":
        comparison = a[column].localeCompare(b[column]);
        break;
      case "competitorPosition":
      case "searchVolume":
      case "cpc":
      case "difficulty":
      case "trafficPotential":
        comparison = a[column] - b[column];
        break;
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Calculates summary statistics for keyword gaps
 */
export function calculateGapSummary(gaps: KeywordGap[]): GapSummary {
  if (gaps.length === 0) {
    return {
      totalGaps: 0,
      avgOpportunity: 0,
      totalVolume: 0,
      avgDifficulty: 0,
      uniqueCompetitors: 0,
    };
  }

  const totalOpportunity = gaps.reduce((sum, g) => sum + g.trafficPotential, 0);
  const totalVolume = gaps.reduce((sum, g) => sum + g.searchVolume, 0);
  const totalDifficulty = gaps.reduce((sum, g) => sum + g.difficulty, 0);
  const uniqueCompetitors = new Set(gaps.map((g) => g.competitorDomain)).size;

  return {
    totalGaps: gaps.length,
    avgOpportunity: totalOpportunity / gaps.length,
    totalVolume,
    avgDifficulty: Math.round(totalDifficulty / gaps.length),
    uniqueCompetitors,
  };
}

interface KeywordGapTableProps {
  gaps: KeywordGap[];
  onAddTarget?: (keyword: string) => void;
}

/**
 * Renders a sortable table of keyword gaps
 */
export function KeywordGapTable({ gaps, onAddTarget }: KeywordGapTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("trafficPotential");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedGaps = useMemo(
    () => sortKeywordGaps(gaps, sortColumn, sortDirection),
    [gaps, sortColumn, sortDirection]
  );

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({
    column,
    children,
  }: {
    column: SortColumn;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column &&
          (sortDirection === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          ))}
      </div>
    </TableHead>
  );

  if (gaps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No keyword gaps found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader column="keyword">Keyword</SortableHeader>
            <SortableHeader column="competitorDomain">Competitor</SortableHeader>
            <SortableHeader column="competitorPosition">Position</SortableHeader>
            <SortableHeader column="searchVolume">Volume</SortableHeader>
            <SortableHeader column="cpc">CPC</SortableHeader>
            <SortableHeader column="difficulty">Difficulty</SortableHeader>
            <SortableHeader column="trafficPotential">
              Opportunity
            </SortableHeader>
            <TableHead className="w-[60px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedGaps.map((gap, index) => (
            <TableRow key={`${gap.keyword}-${gap.competitorDomain}-${index}`}>
              <TableCell className="font-medium">{gap.keyword}</TableCell>
              <TableCell className="text-muted-foreground">
                {gap.competitorDomain}
              </TableCell>
              <TableCell>{gap.competitorPosition}</TableCell>
              <TableCell>{gap.searchVolume.toLocaleString()}</TableCell>
              <TableCell>${gap.cpc.toFixed(2)}</TableCell>
              <TableCell>
                <DifficultyBadge difficulty={gap.difficulty} />
              </TableCell>
              <TableCell className="font-semibold text-primary">
                {gap.trafficPotential.toLocaleString()}
              </TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        onClick={() => onAddTarget?.(gap.keyword)}
                        aria-label="Add to targets"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Coming soon</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
