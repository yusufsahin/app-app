import type { ReactNode } from "react";
import { Button } from "../../../shared/components/ui";

interface ArtifactsListFooterProps {
  bulkActions?: ReactNode;
  page: number;
  pageSize: number;
  totalArtifacts: number;
  onPageSizeChange: (value: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function ArtifactsListFooter({
  bulkActions,
  page,
  pageSize,
  totalArtifacts,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}: ArtifactsListFooterProps) {
  return (
    <>
      {bulkActions}
      <div className="flex flex-col gap-2 border-t px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            aria-label="Backlog items per page"
            title="Backlog items per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="text-sm text-muted-foreground">
            {page * pageSize + 1}-{Math.min(page * pageSize + pageSize, totalArtifacts)} of {totalArtifacts}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onPreviousPage} disabled={page <= 0}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onNextPage}
              disabled={page >= Math.ceil(totalArtifacts / pageSize) - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export { ArtifactsListFooter as BacklogListFooter };
