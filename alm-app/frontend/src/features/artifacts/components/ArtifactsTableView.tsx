import type { ReactNode } from "react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { TenantMember } from "../../../shared/api/orgApi";
import type { ProjectTag } from "../../../shared/api/projectTagApi";
import type { ListSchemaDto } from "../../../shared/types/listSchema";
import type { FormSchemaDto } from "../../../shared/types/formSchema";
import { EmptyState } from "../../../shared/components/EmptyState";
import { MetadataDrivenGrid } from "../../../shared/components/lists/MetadataDrivenGrid";
import type { TabularColumnModel } from "../../../shared/components/lists/types";
import { useArtifactsTabularColumns } from "./useArtifactsTabularColumns";
import { useArtifactsTabularRows } from "./useArtifactsTabularRows";
import { useArtifactsTabularCommit } from "./useArtifactsTabularCommit";
import { TabularAssigneePickerCell } from "./TabularAssigneePickerCell";
import { TabularTagPickerCell } from "./TabularTagPickerCell";

interface ArtifactsTabularViewProps {
  orgSlug?: string;
  projectId?: string;
  effectiveListSchema?: ListSchemaDto | null;
  editFormSchema?: FormSchemaDto | null;
  members?: TenantMember[] | null;
  projectTags?: ProjectTag[];
  artifacts: Artifact[];
  renderCell: (row: Artifact, columnKey: string, value: unknown) => ReactNode;
  showDeleted: boolean;
  selectedKeys: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  renderRowActions: (row: Artifact) => ReactNode;
  emptyTableMessage: string;
  onRowClick: (row: Artifact) => void;
  isRefetching: boolean;
  listSchemaLoading: boolean;
  listSchemaError: boolean;
  refetchListSchema: () => void;
  showNotification: (message: string, severity?: "success" | "error" | "warning") => void;
}

export function ArtifactsTabularView({
  orgSlug,
  projectId,
  effectiveListSchema,
  editFormSchema,
  members,
  projectTags,
  artifacts,
  renderCell,
  showDeleted,
  selectedKeys,
  onToggleSelect,
  onSelectAll,
  renderRowActions,
  emptyTableMessage,
  onRowClick,
  isRefetching,
  listSchemaLoading,
  listSchemaError,
  refetchListSchema,
  showNotification,
}: ArtifactsTabularViewProps) {
  const tabularColumns = useArtifactsTabularColumns({
    listSchema: effectiveListSchema,
    formSchema: editFormSchema,
    members,
    projectTags,
  });
  const tabularRows = useArtifactsTabularRows(artifacts);
  const handleCellCommit = useArtifactsTabularCommit({
    orgSlug,
    projectId,
    showNotification,
  });

  const enrichedColumns = tabularColumns.map((column) => ({
    ...column,
    renderDisplay:
      column.key === "artifact_type" || column.key === "tags" || column.key === "assignee_id"
        ? (row: Artifact, value: unknown) =>
            column.key === "tags"
              ? (
                  <TabularTagPickerCell
                    value={Array.isArray(value) ? value.map((item) => String(item)) : []}
                    options={projectTags ?? []}
                    disabled={!column.isEditable(row)}
                    onCommit={(nextValue) =>
                      handleCellCommit({
                        row,
                        rowId: row.id,
                        column: column as TabularColumnModel<Artifact>,
                        nextValue,
                        previousValue: Array.isArray(value) ? value : [],
                      })
                    }
                  />
                )
              : column.key === "assignee_id"
                ? (
                    <TabularAssigneePickerCell
                      value={value ? String(value) : null}
                      options={members ?? []}
                      disabled={!column.isEditable(row)}
                      onCommit={(nextValue) =>
                        handleCellCommit({
                          row,
                          rowId: row.id,
                          column: column as TabularColumnModel<Artifact>,
                          nextValue,
                          previousValue: value ? String(value) : null,
                        })
                      }
                    />
                  )
              : renderCell(row, column.key, value)
        : column.renderDisplay,
  }));

  if (effectiveListSchema) {
    return (
      <div className={`transition-opacity duration-200 ${isRefetching ? "opacity-70" : "opacity-100"}`}>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>`Enter` edit</span>
          <span>`Tab` next cell</span>
          <span>`Shift+Tab` previous cell</span>
          <span>`Ctrl+V` bulk paste</span>
          <span>Drag corner to fill</span>
        </div>
        <MetadataDrivenGrid<Artifact>
          columns={enrichedColumns}
          data={tabularRows}
          getRowKey={(row) => row.id}
          selectionColumn={!showDeleted}
          selectedKeys={selectedKeys}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          renderRowActions={renderRowActions}
          emptyMessage={emptyTableMessage}
          onRowOpen={onRowClick}
          onCellCommit={handleCellCommit}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-8 text-center min-h-[200px] flex flex-col items-center justify-center">
      {listSchemaLoading ? (
        <p className="text-muted-foreground">Loading list schema…</p>
      ) : listSchemaError ? (
        <EmptyState
          title="Could not load list schema"
          description="Switch to Tree or Tabular view, or try again."
          actionLabel="Try again"
          onAction={() => refetchListSchema()}
          bordered
        />
      ) : (
        <p className="text-muted-foreground">
          List schema is not available. Switch to Tree or Tabular view, or try again later.
        </p>
      )}
    </div>
  );
}

export { ArtifactsTabularView as ArtifactsTableView };
export { ArtifactsTabularView as BacklogTabularView };
