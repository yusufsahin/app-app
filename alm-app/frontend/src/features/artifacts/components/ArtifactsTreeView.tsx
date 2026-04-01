import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Copy, List, MoreHorizontal, Trash2 } from "lucide-react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { ManifestTreeRoot } from "../../../shared/lib/manifestTreeRoots";
import { Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui";
import { EmptyState } from "../../../shared/components/EmptyState";
import { buildArtifactTree, getArtifactIcon, type ArtifactNode } from "../utils";

interface TreeIconBundle {
  artifact_types?: Array<{ id?: string; icon?: string }>;
}

interface ArtifactsTreeViewProps {
  artifacts: Artifact[];
  treeRootOptions: ManifestTreeRoot[];
  iconBundle?: TreeIconBundle | null;
  customFieldColumns: { key: string; label: string }[];
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
  customFieldColumns,
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
            customFieldColumns={customFieldColumns}
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
  customFieldColumns,
  renderMenuContent,
  onSelect,
  expandedIds,
  selectedArtifactId,
  onToggleExpand,
  depth,
}: {
  node: ArtifactNode;
  iconBundle?: TreeIconBundle | null;
  customFieldColumns: { key: string; label: string }[];
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
      <div className={cn("flex items-center gap-2 border-b py-2", selected && "bg-muted/60")} style={{ paddingLeft: 8 + depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            className="mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="inline-block w-8" />
        )}
        <button
          type="button"
          className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left", selected && "font-medium")}
          onClick={() => onSelect(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(node.id);
            }
          }}
        >
          {node.artifact_key && (
            <span className="min-w-[56px] font-mono text-sm text-muted-foreground">{node.artifact_key}</span>
          )}
          {getArtifactIcon(node.artifact_type, iconBundle)}
          <span className="text-sm capitalize text-muted-foreground">{node.artifact_type}</span>
          <span className="truncate font-medium">{node.title}</span>
          <Badge variant="outline" className="ml-1 text-xs">
            {node.state}
          </Badge>
          {node.state_reason && (
            <span className="ml-1 text-xs text-muted-foreground">{node.state_reason}</span>
          )}
          {node.resolution && (
            <span className="ml-1 text-xs text-muted-foreground">- {node.resolution}</span>
          )}
          {customFieldColumns.slice(0, 2).map(
            (c) =>
              node.custom_fields?.[c.key] != null && (
                <Badge key={c.key} className="ml-1 h-5 text-[0.7rem]">
                  {c.label}: {String(node.custom_fields[c.key])}
                </Badge>
              ),
          )}
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
              customFieldColumns={customFieldColumns}
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
