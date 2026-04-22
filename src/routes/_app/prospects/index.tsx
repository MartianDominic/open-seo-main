/**
 * Prospects list page route
 * Phase 28: Keyword Gap Analysis UI
 * Phase 30.5: CSV Import
 *
 * Lists all prospects for the current workspace with basic info.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ExternalLink, Upload } from "lucide-react";
import { listProspects } from "@/serverFunctions/prospects";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { StatusBadge, CsvImportDialog } from "@/client/components/prospects";

export const Route = createFileRoute("/_app/prospects/")({
  component: ProspectsListPage,
});

function ProspectsListPage() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["prospects", "list"],
    queryFn: () => listProspects({ data: { page: 1, pageSize: 50 } }),
  });

  const handleImportComplete = (result: { created: number; skipped: number }) => {
    // Refresh the prospects list after successful import
    queryClient.invalidateQueries({ queryKey: ["prospects", "list"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Failed to load prospects</p>
      </div>
    );
  }

  const prospects = data?.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prospects</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button disabled className="gap-2">
            <Plus className="h-4 w-4" />
            Add Prospect
          </Button>
        </div>
      </div>

      <CsvImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />

      {prospects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No prospects yet.</p>
          <p className="text-sm mt-2">
            Add your first prospect to start analyzing keyword opportunities.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prospects.map((prospect) => (
                <TableRow key={prospect.id}>
                  <TableCell className="font-medium">
                    <a
                      href={`/prospects/${prospect.id}`}
                      className="hover:underline"
                    >
                      {prospect.domain}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {prospect.companyName ?? "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={prospect.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(prospect.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <a href={`/prospects/${prospect.id}`}>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

