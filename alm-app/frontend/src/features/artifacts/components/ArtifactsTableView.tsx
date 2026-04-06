import { useCallback, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Eye, ListTodo, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { TenantMember } from "../../../shared/api/orgApi";
import type { ProjectTag } from "../../../shared/api/projectTagApi";
import type { ListSchemaDto } from "../../../shared/types/listSchema";
import type { FormSchemaDto } from "../../../shared/types/formSchema";
import type { ManifestBundleShape } from "../../../shared/lib/workflowManifest";
import type { Task } from "../../../shared/api/taskApi";
import { EmptyState } from "../../../shared/components/EmptyState";
import { MetadataDrivenGrid } from "../../../shared/components/lists/MetadataDrivenGrid";
import type { TabularColumnModel } from "../../../shared/components/lists/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui";
import { useArtifactsTabularColumns } from "./useArtifactsTabularColumns";
import { useArtifactsTabularRows } from "./useArtifactsTabularRows";
import { useArtifactsTabularCommit } from "./useArtifactsTabularCommit";
import { TabularAssigneePickerCell } from "./TabularAssigneePickerCell";
import { TabularTagPickerCell } from "./TabularTagPickerCell";

const EMPTY_TASK_MAP = new Map<string, Task[]>();
const EMPTY_LOADING = new Set<string>();

function TabularExpandedTaskList({
  artifact,
  tasks,
  loading,
  onOpenTask,
  onEditTask,
  onDeleteTask,
  selectedTask,
}: {
  artifact: Artifact;
  tasks: Task[];
  loading: boolean;
  onOpenTask?: (artifact: Artifact, task: Task) => void;
  onEditTask?: (artifact: Artifact, task: Task) => void;
  onDeleteTask?: (artifact: Artifact, task: Task) => void;
  selectedTask: { artifactId: string; taskId: string } | null;
}) {
  const { t } = useTranslation();
  const taskMenu = Boolean(onOpenTask);

  if (loading && tasks.length === 0) {
    return <p className="px-2 text-sm text-muted-foreground">Loading tasks…</p>;
  }

  if (!onOpenTask || tasks.length === 0) {
    return <p className="px-2 text-sm text-muted-foreground">No tasks for this item.</p>;
  }

  return (
    <ul className="m-0 max-h-48 list-none space-y-0.5 overflow-y-auto p-0">
      {tasks.map((task) => {
        const selected = selectedTask?.artifactId === artifact.id && selectedTask.taskId === task.id;
        return (
          <li
            key={task.id}
            className={cn(
              "flex items-center gap-1 rounded border border-transparent px-1 py-0.5 text-sm hover:bg-muted/60",
              selected && "border-border bg-muted/40",
            )}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              onClick={() => onOpenTask(artifact, task)}
            >
              <ListTodo className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{task.state}</span>
            </button>
            {taskMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded hover:bg-muted"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Task actions"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {onOpenTask ? (
                    <DropdownMenuItem onClick={() => onOpenTask(artifact, task)}>
                      <Eye className="mr-2 size-3.5" />
                      {t("backlogTabular.viewTask")}
                    </DropdownMenuItem>
                  ) : null}
                  {onEditTask ? (
                    <DropdownMenuItem onClick={() => onEditTask(artifact, task)}>
                      <Pencil className="mr-2 size-3.5" />
                      Edit
                    </DropdownMenuItem>
                  ) : null}
                  {onDeleteTask ? (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDeleteTask(artifact, task)}
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

interface ArtifactsTabularViewProps {
  orgSlug?: string;
  projectId?: string;
  effectiveListSchema?: ListSchemaDto | null;
  editFormSchema?: FormSchemaDto | null;
  manifestBundle?: ManifestBundleShape | null;
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
  expandedTableRowKeys?: ReadonlySet<string>;
  onToggleTableExpandRow?: (artifactId: string) => void;
  tasksByArtifactId?: ReadonlyMap<string, Task[]>;
  tasksLoadingArtifactIds?: ReadonlySet<string>;
  onOpenTableTask?: (artifact: Artifact, task: Task) => void;
  onEditTableTask?: (artifact: Artifact, task: Task) => void;
  onDeleteTableTask?: (artifact: Artifact, task: Task) => void;
  selectedTableTask?: { artifactId: string; taskId: string } | null;
}

export function ArtifactsTabularView({
  orgSlug,
  projectId,
  effectiveListSchema,
  editFormSchema,
  manifestBundle = null,
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
  expandedTableRowKeys,
  onToggleTableExpandRow,
  tasksByArtifactId = EMPTY_TASK_MAP,
  tasksLoadingArtifactIds = EMPTY_LOADING,
  onOpenTableTask,
  onEditTableTask,
  onDeleteTableTask,
  selectedTableTask = null,
}: ArtifactsTabularViewProps) {
  const tabularColumns = useArtifactsTabularColumns({
    listSchema: effectiveListSchema,
    formSchema: editFormSchema,
    manifestBundle,
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

  const expansionEnabled = Boolean(onToggleTableExpandRow && expandedTableRowKeys && onOpenTableTask);

  const mergedRowActions = useCallback(
    (row: Artifact) => (
      <div className="flex items-center justify-end gap-0.5">
        {onToggleTableExpandRow && expandedTableRowKeys ? (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
            aria-expanded={expandedTableRowKeys.has(row.id)}
            aria-label={
              expandedTableRowKeys.has(row.id)
                ? `Collapse tasks for ${row.title}`
                : `Expand tasks for ${row.title}`
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleTableExpandRow(row.id);
            }}
          >
            {expandedTableRowKeys.has(row.id) ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        ) : null}
        {renderRowActions(row)}
      </div>
    ),
    [expandedTableRowKeys, onToggleTableExpandRow, renderRowActions],
  );

  const renderExpandedRow = useCallback(
    (row: Artifact) => (
      <TabularExpandedTaskList
        artifact={row}
        tasks={tasksByArtifactId.get(row.id) ?? []}
        loading={tasksLoadingArtifactIds.has(row.id)}
        onOpenTask={onOpenTableTask}
        onEditTask={onEditTableTask}
        onDeleteTask={onDeleteTableTask}
        selectedTask={selectedTableTask}
      />
    ),
    [
      onDeleteTableTask,
      onEditTableTask,
      onOpenTableTask,
      selectedTableTask,
      tasksByArtifactId,
      tasksLoadingArtifactIds,
    ],
  );

  const expandedDetailProps = useMemo(() => {
    if (!expansionEnabled || !expandedTableRowKeys) {
      return { expandedDetailRowKeys: undefined as ReadonlySet<string> | undefined, renderExpandedRow: undefined };
    }
    return {
      expandedDetailRowKeys: expandedTableRowKeys,
      renderExpandedRow,
    };
  }, [expansionEnabled, expandedTableRowKeys, renderExpandedRow]);

  if (effectiveListSchema) {
    return (
      <div className={`transition-opacity duration-200 ${isRefetching ? "opacity-70" : "opacity-100"}`}>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>`Enter` edit</span>
          <span>`Tab` next cell</span>
          <span>`Shift+Tab` previous cell</span>
          <span>`Ctrl+V` bulk paste</span>
          <span>Drag corner to fill</span>
          {expansionEnabled ? <span>Use arrow next to actions to show tasks.</span> : null}
        </div>
        <MetadataDrivenGrid<Artifact>
          columns={enrichedColumns}
          data={tabularRows}
          getRowKey={(row) => row.id}
          selectionColumn={!showDeleted}
          selectedKeys={selectedKeys}
          onToggleSelect={onToggleSelect}
          onSelectAll={onSelectAll}
          renderRowActions={mergedRowActions}
          emptyMessage={emptyTableMessage}
          onRowOpen={onRowClick}
          onCellCommit={handleCellCommit}
          expandedDetailRowKeys={expandedDetailProps.expandedDetailRowKeys}
          renderExpandedRow={expandedDetailProps.renderExpandedRow}
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
