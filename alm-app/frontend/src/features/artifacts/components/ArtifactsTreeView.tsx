import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  List,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { Task } from "../../../shared/api/taskApi";
import type { ManifestTreeRoot } from "../../../shared/lib/manifestTreeRoots";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui";
import { EmptyState } from "../../../shared/components/EmptyState";
import { buildArtifactTree, getArtifactIcon, getArtifactTypeDisplayLabel, type ArtifactNode } from "../utils";
import { TreeArtifactTaskRows } from "./TreeArtifactTaskRows";

const EMPTY_TASKS_MAP = new Map<string, Task[]>();
const EMPTY_LOADING_IDS = new Set<string>();

interface TreeIconBundle {
  artifact_types?: Array<{ id?: string; icon?: string; name?: string }>;
}

interface ArtifactsTreeViewProps {
  artifacts: Artifact[];
  treeRootOptions: ManifestTreeRoot[];
  iconBundle?: TreeIconBundle | null;
  expandedIds: Set<string>;
  selectedArtifactId?: string | null;
  onToggleExpand: (id: string) => void;
  onOpenArtifact: (artifactId: string) => void;
  onClearFilters: () => void;
  onCreateArtifact: () => void;
  hasActiveArtifactFilters: boolean;
  emptyListTitle: string;
  emptyListDescription: string;
  isRefetching: boolean;
  renderMenuContent: (artifact: Artifact) => ReactNode;
  /** Tasks listed under an artifact when its node is expanded (keys: artifact id). */
  tasksByArtifactId?: ReadonlyMap<string, Task[]>;
  /** Artifact ids whose task list query is still loading (no cached data yet). */
  tasksLoadingArtifactIds?: ReadonlySet<string>;
  onOpenTask?: (artifact: Artifact, task: Task) => void;
  onEditTask?: (artifact: Artifact, task: Task) => void;
  onDeleteTask?: (artifact: Artifact, task: Task) => void;
  /** Highlights the task row when it matches (e.g. read-only preview selection). */
  selectedTreeTask?: { artifactId: string; taskId: string } | null;
  /** Persist task order after tree drag-reorder. */
  onReorderArtifactTasks?: (artifact: Artifact, orderedTaskIds: string[]) => void;
  artifactTaskReorderPending?: boolean;
}

export function ArtifactsTreeView({
  artifacts,
  treeRootOptions,
  iconBundle,
  expandedIds,
  selectedArtifactId,
  onToggleExpand,
  onOpenArtifact,
  onClearFilters,
  onCreateArtifact,
  hasActiveArtifactFilters,
  emptyListTitle,
  emptyListDescription,
  isRefetching,
  renderMenuContent,
  tasksByArtifactId = EMPTY_TASKS_MAP,
  tasksLoadingArtifactIds = EMPTY_LOADING_IDS,
  onOpenTask,
  onEditTask,
  onDeleteTask,
  selectedTreeTask = null,
  onReorderArtifactTasks,
  artifactTaskReorderPending = false,
}: ArtifactsTreeViewProps) {
  if (artifacts.length === 0) {
    return (
      <div className="rounded-lg border transition-opacity duration-200" style={{ opacity: isRefetching ? 0.7 : 1 }}>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <EmptyState
            icon={<List className="size-10" />}
            title={emptyListTitle}
            description={emptyListDescription}
            actionLabel={hasActiveArtifactFilters ? "Clear filters" : "Create artifact"}
            onAction={hasActiveArtifactFilters ? onClearFilters : onCreateArtifact}
            compact
            bordered
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border transition-opacity duration-200" style={{ opacity: isRefetching ? 0.7 : 1 }}>
      <ul className="list-none p-0">
        {buildArtifactTree(artifacts, treeRootOptions).map((node) => (
          <ArtifactTreeNode
            key={node.id}
            node={node}
            iconBundle={iconBundle}
            renderMenuContent={renderMenuContent}
            onSelect={onOpenArtifact}
            expandedIds={expandedIds}
            selectedArtifactId={selectedArtifactId}
            onToggleExpand={onToggleExpand}
            tasksByArtifactId={tasksByArtifactId}
            tasksLoadingArtifactIds={tasksLoadingArtifactIds}
            onOpenTask={onOpenTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            selectedTreeTask={selectedTreeTask}
            onReorderArtifactTasks={onReorderArtifactTasks}
            artifactTaskReorderPending={artifactTaskReorderPending}
            depth={0}
          />
        ))}
      </ul>
    </div>
  );
}

export { ArtifactsTreeView as BacklogTreeView };

function ArtifactTreeNode({
  node,
  iconBundle,
  renderMenuContent,
  onSelect,
  expandedIds,
  selectedArtifactId,
  onToggleExpand,
  tasksByArtifactId,
  tasksLoadingArtifactIds,
  onOpenTask,
  onEditTask,
  onDeleteTask,
  selectedTreeTask,
  onReorderArtifactTasks,
  artifactTaskReorderPending,
  depth,
}: {
  node: ArtifactNode;
  iconBundle?: TreeIconBundle | null;
  renderMenuContent: (artifact: Artifact) => ReactNode;
  onSelect: (artifactId: string) => void;
  expandedIds: Set<string>;
  selectedArtifactId?: string | null;
  onToggleExpand: (id: string) => void;
  tasksByArtifactId: ReadonlyMap<string, Task[]>;
  tasksLoadingArtifactIds: ReadonlySet<string>;
  onOpenTask?: (artifact: Artifact, task: Task) => void;
  onEditTask?: (artifact: Artifact, task: Task) => void;
  onDeleteTask?: (artifact: Artifact, task: Task) => void;
  selectedTreeTask: { artifactId: string; taskId: string } | null;
  onReorderArtifactTasks?: (artifact: Artifact, orderedTaskIds: string[]) => void;
  artifactTaskReorderPending?: boolean;
  depth: number;
}) {
  const taskList = tasksByArtifactId.get(node.id) ?? [];
  const tasksLoading = tasksLoadingArtifactIds.has(node.id);
  const hasArtifactChildren = node.children.length > 0;
  /** Tasks load only after expand; leaves would never get a chevron if we waited for taskList/tasksLoading first. */
  const tasksFeature = Boolean(onOpenTask);
  const hasExpandableContent =
    hasArtifactChildren || taskList.length > 0 || tasksLoading || tasksFeature;
  const expanded = expandedIds.has(node.id);
  const selected = selectedArtifactId === node.id;
  return (
    <>
      <div
        className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b py-2", selected && "bg-muted/60")}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {hasExpandableContent ? (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="inline-block w-8 shrink-0" />
        )}
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left",
            selected && "font-medium",
          )}
          onClick={() => onSelect(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(node.id);
            }
          }}
          aria-label={
            node.artifact_key
              ? `${node.artifact_key}: ${node.title} (${getArtifactTypeDisplayLabel(node.artifact_type, iconBundle)})`
              : `${node.title} (${getArtifactTypeDisplayLabel(node.artifact_type, iconBundle)})`
          }
        >
          <div className="flex shrink-0 items-center gap-1.5">
            {node.artifact_key && (
              <span className="min-w-[3.25rem] font-mono text-sm text-muted-foreground tabular-nums">
                {node.artifact_key}
              </span>
            )}
            <span
              className="inline-flex shrink-0 text-muted-foreground"
              title={getArtifactTypeDisplayLabel(node.artifact_type, iconBundle)}
            >
              {getArtifactIcon(node.artifact_type, iconBundle)}
            </span>
          </div>
          <span className="min-w-0 flex-1 truncate font-medium">{node.title}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
              aria-label="Actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {renderMenuContent(node)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && (hasArtifactChildren || taskList.length > 0 || tasksLoading || tasksFeature) && (
        <div>
          {node.children.map((child) => (
            <ArtifactTreeNode
              key={child.id}
              node={child}
              iconBundle={iconBundle}
              renderMenuContent={renderMenuContent}
              onSelect={onSelect}
              expandedIds={expandedIds}
              selectedArtifactId={selectedArtifactId}
              onToggleExpand={onToggleExpand}
              tasksByArtifactId={tasksByArtifactId}
              tasksLoadingArtifactIds={tasksLoadingArtifactIds}
              onOpenTask={onOpenTask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              selectedTreeTask={selectedTreeTask}
              onReorderArtifactTasks={onReorderArtifactTasks}
              artifactTaskReorderPending={artifactTaskReorderPending}
              depth={depth + 1}
            />
          ))}
          {tasksLoading && taskList.length === 0 ? (
            <div
              className="border-b py-2 text-sm text-muted-foreground"
              style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            >
              Loading tasks…
            </div>
          ) : null}
          {tasksFeature && !hasArtifactChildren && !tasksLoading && taskList.length === 0 ? (
            <div
              className="border-b py-2 text-sm text-muted-foreground"
              style={{ paddingLeft: 8 + (depth + 1) * 12 }}
            >
              No tasks for this item.
            </div>
          ) : null}
          {onOpenTask ? (
            <TreeArtifactTaskRows
              artifact={node}
              tasks={taskList}
              depth={depth}
              selectedTreeTask={selectedTreeTask}
              onOpenTask={onOpenTask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onReorderCommitted={
                onReorderArtifactTasks
                  ? (_artifactId, orderedTaskIds) => onReorderArtifactTasks(node, orderedTaskIds)
                  : undefined
              }
              reorderPending={artifactTaskReorderPending}
            />
          ) : null}
        </div>
      )}
    </>
  );
}

export function ArtifactTreeMenuDuplicateItem({ onClick }: { onClick: () => void }) {
  return (
    <DropdownMenuItem onClick={onClick}>
      <Copy className="mr-2 size-4" />
      Duplicate
    </DropdownMenuItem>
  );
}

export function ArtifactTreeMenuDeleteItem({ onClick }: { onClick: () => void }) {
  return (
    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onClick}>
      <Trash2 className="mr-2 size-4" />
      Delete
    </DropdownMenuItem>
  );
}
