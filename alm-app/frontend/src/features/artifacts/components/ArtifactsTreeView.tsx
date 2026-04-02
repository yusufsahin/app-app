import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Copy, List, MoreHorizontal, Trash2 } from "lucide-react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { ManifestTreeRoot } from "../../../shared/lib/manifestTreeRoots";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui";
import { EmptyState } from "../../../shared/components/EmptyState";
import { buildArtifactTree, getArtifactIcon, getArtifactTypeDisplayLabel, type ArtifactNode } from "../utils";

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
  depth,
}: {
  node: ArtifactNode;
  iconBundle?: TreeIconBundle | null;
  renderMenuContent: (artifact: Artifact) => ReactNode;
  onSelect: (artifactId: string) => void;
  expandedIds: Set<string>;
  selectedArtifactId?: string | null;
  onToggleExpand: (id: string) => void;
  depth: number;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const selected = selectedArtifactId === node.id;

  return (
    <>
      <div
        className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b py-2", selected && "bg-muted/60")}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {hasChildren ? (
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
      {hasChildren && expanded && (
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
              depth={depth + 1}
            />
          ))}
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
