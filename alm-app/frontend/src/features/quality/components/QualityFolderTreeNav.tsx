import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Layers, MoreVertical, Plus } from "lucide-react";
import { useArtifacts } from "../../../shared/api/artifactApi";
import type { ManifestResponse } from "../../../shared/api/manifestApi";
import { getTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import { buildArtifactTree, type ArtifactNode } from "../../artifacts/utils";
import { Button } from "../../../shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui/utils";
import { useTranslation } from "react-i18next";

interface QualityFolderTreeNavProps {
  orgSlug: string | undefined;
  projectId: string | undefined;
  manifestBundle: ManifestResponse["manifest_bundle"] | null | undefined;
  onCreateFolderUnder?: (parentId: string) => void;
  onRenameFolder?: (folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  /** When set, children of this type are listed under each folder (e.g. test-case). */
  leafArtifactType?: string;
  selectedArtifactId?: string | null;
  onNewLeafInFolder?: (folderId: string) => void;
  onSelectLeaf?: (leafId: string, parentFolderId: string) => void;
  onEditLeaf?: (leafId: string) => void;
  onMoveLeaf?: (leafId: string) => void;
  onDeleteLeaf?: (leafId: string) => void;
  /** Label for “create under folder” in the folder ⋯ menu (e.g. New test case / New suite). */
  newLeafLabel?: string;
}

function folderNavNodes(nodes: ArtifactNode[]): ArtifactNode[] {
  return nodes.filter((n) => n.artifact_type === "root-quality" || n.artifact_type === "quality-folder");
}

function FolderTreeRows({
  nodes,
  expandedIds,
  toggle,
  selectedUnder,
  onSelectRoot,
  onSelectFolder,
  onCreateFolderUnder,
  onRenameFolder,
  onDeleteFolder,
  newSubfolderLabel,
  renameLabel,
  deleteLabel,
  folderActionsLabel,
  leafArtifactType,
  selectedArtifactId,
  onNewLeafInFolder,
  onSelectLeaf,
  onEditLeaf,
  onMoveLeaf,
  onDeleteLeaf,
  newLeafLabel,
  editLeafLabel,
  moveLeafLabel,
  deleteLeafLabel,
  leafActionsLabel,
}: {
  nodes: ArtifactNode[];
  expandedIds: Set<string>;
  toggle: (id: string) => void;
  selectedUnder: string | null;
  onSelectRoot: () => void;
  onSelectFolder: (id: string) => void;
  onCreateFolderUnder?: (parentId: string) => void;
  onRenameFolder?: (folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  newSubfolderLabel: string;
  renameLabel: string;
  deleteLabel: string;
  folderActionsLabel: string;
  leafArtifactType?: string;
  selectedArtifactId?: string | null;
  onNewLeafInFolder?: (parentId: string) => void;
  onSelectLeaf?: (leafId: string, parentFolderId: string) => void;
  onEditLeaf?: (leafId: string) => void;
  onMoveLeaf?: (leafId: string) => void;
  onDeleteLeaf?: (leafId: string) => void;
  newLeafLabel: string;
  editLeafLabel: string;
  moveLeafLabel: string;
  deleteLeafLabel: string;
  leafActionsLabel: string;
}) {
  const navNodes = folderNavNodes(nodes);

  return (
    <>
      {navNodes.map((node) => {
        const childFolders = folderNavNodes(node.children);
        const leafChildren =
          leafArtifactType != null && leafArtifactType !== ""
            ? node.children
                .filter((c) => c.artifact_type === leafArtifactType)
                .slice()
                .sort((a, b) =>
                  (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" }),
                )
            : [];
        const isRoot = node.artifact_type === "root-quality";
        const hasFolderKids = childFolders.length > 0;
        const hasLeafKids = leafChildren.length > 0;
        const hasKids = hasFolderKids || hasLeafKids;
        const open = isRoot || expandedIds.has(node.id);
        const selected = (!selectedUnder && isRoot) || (!!selectedUnder && selectedUnder === node.id);

        const showRootMenu = isRoot && !!onCreateFolderUnder;
        const showFolderMenu =
          !isRoot &&
          !!(
            (leafArtifactType && onNewLeafInFolder) ||
            onCreateFolderUnder ||
            onRenameFolder ||
            onDeleteFolder
          );

        return (
          <div key={node.id} className="select-none">
            <div
              className={cn(
                "flex w-full items-center gap-0.5 rounded-md px-1 py-0.5 text-sm hover:bg-muted/80",
                selected && "bg-muted font-medium",
              )}
            >
              <button
                type="button"
                data-testid={`quality-tree-node-${node.id}`}
                data-artifact-type={node.artifact_type}
                className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left"
                onClick={() => {
                  if (isRoot) onSelectRoot();
                  else onSelectFolder(node.id);
                  if (hasKids) toggle(node.id);
                }}
              >
                <span className="inline-flex w-4 shrink-0 justify-center">
                  {hasKids ? (
                    open ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )
                  ) : (
                    <span className="size-3.5" />
                  )}
                </span>
                {open ? (
                  isRoot ? (
                    <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FolderOpen className="size-3.5 shrink-0 text-blue-600" />
                  )
                ) : (
                  <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 truncate">{node.title || node.artifact_type}</span>
              </button>
              {showRootMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                      data-testid={`quality-tree-folder-menu-${node.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="sr-only">{folderActionsLabel}</span>
                      <MoreVertical className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[10rem]">
                    {onCreateFolderUnder ? (
                      <DropdownMenuItem
                        onClick={() => onCreateFolderUnder(node.id)}
                        data-testid={`quality-tree-create-subfolder-${node.id}`}
                      >
                        <Plus className="mr-2 size-3.5" />
                        {newSubfolderLabel}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {showFolderMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                      data-testid={`quality-tree-folder-menu-${node.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="sr-only">{folderActionsLabel}</span>
                      <MoreVertical className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[11rem]">
                    {leafArtifactType && onNewLeafInFolder ? (
                      <DropdownMenuItem
                        onClick={() => onNewLeafInFolder(node.id)}
                        data-testid={`quality-tree-new-leaf-${node.id}`}
                      >
                        <Plus className="mr-2 size-3.5" />
                        {newLeafLabel}
                      </DropdownMenuItem>
                    ) : null}
                    {onCreateFolderUnder ? (
                      <DropdownMenuItem
                        onClick={() => onCreateFolderUnder(node.id)}
                        data-testid={`quality-tree-create-subfolder-${node.id}`}
                      >
                        <Folder className="mr-2 size-3.5 opacity-70" />
                        {newSubfolderLabel}
                      </DropdownMenuItem>
                    ) : null}
                    {(leafArtifactType && onNewLeafInFolder) || onCreateFolderUnder ? (
                      onRenameFolder || onDeleteFolder ? (
                        <DropdownMenuSeparator />
                      ) : null
                    ) : null}
                    {onRenameFolder ? (
                      <DropdownMenuItem
                        onClick={() => onRenameFolder(node.id)}
                        data-testid={`quality-tree-folder-rename-${node.id}`}
                      >
                        {renameLabel}
                      </DropdownMenuItem>
                    ) : null}
                    {onRenameFolder && onDeleteFolder ? <DropdownMenuSeparator /> : null}
                    {onDeleteFolder ? (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteFolder(node.id)}
                        data-testid={`quality-tree-folder-delete-${node.id}`}
                      >
                        {deleteLabel}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            {open && (hasFolderKids || hasLeafKids) ? (
              <div className="ml-2 border-l border-border/60 pl-1">
                {hasFolderKids ? (
                  <FolderTreeRows
                    nodes={childFolders}
                    expandedIds={expandedIds}
                    toggle={toggle}
                    selectedUnder={selectedUnder}
                    onSelectRoot={onSelectRoot}
                    onSelectFolder={onSelectFolder}
                    onCreateFolderUnder={onCreateFolderUnder}
                    onRenameFolder={onRenameFolder}
                    onDeleteFolder={onDeleteFolder}
                    newSubfolderLabel={newSubfolderLabel}
                    renameLabel={renameLabel}
                    deleteLabel={deleteLabel}
                    folderActionsLabel={folderActionsLabel}
                    leafArtifactType={leafArtifactType}
                    selectedArtifactId={selectedArtifactId}
                    onNewLeafInFolder={onNewLeafInFolder}
                    onSelectLeaf={onSelectLeaf}
                    onEditLeaf={onEditLeaf}
                    onMoveLeaf={onMoveLeaf}
                    onDeleteLeaf={onDeleteLeaf}
                    newLeafLabel={newLeafLabel}
                    editLeafLabel={editLeafLabel}
                    moveLeafLabel={moveLeafLabel}
                    deleteLeafLabel={deleteLeafLabel}
                    leafActionsLabel={leafActionsLabel}
                  />
                ) : null}
                {leafChildren.map((leaf) => {
                  const leafSelected = selectedArtifactId === leaf.id;
                  const showLeafMenu = !!(onEditLeaf || onMoveLeaf || onDeleteLeaf);
                  return (
                    <div
                      key={leaf.id}
                      className={cn(
                        "mt-0.5 flex w-full items-center gap-0.5 rounded-md px-1 py-0.5 text-sm hover:bg-muted/80",
                        leafSelected && "bg-primary/10 font-medium",
                      )}
                    >
                      <button
                        type="button"
                        data-testid={`quality-tree-leaf-${leaf.id}`}
                        data-artifact-type={leaf.artifact_type}
                        className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left"
                        onClick={() => onSelectLeaf?.(leaf.id, node.id)}
                      >
                        <span className="inline-flex w-4 shrink-0 justify-center">
                          <FileText className="size-3.5 text-muted-foreground" />
                        </span>
                        <span className="min-w-0 truncate">{leaf.title || leaf.artifact_type}</span>
                      </button>
                      {showLeafMenu ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                              data-testid={`quality-tree-leaf-menu-${leaf.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="sr-only">{leafActionsLabel}</span>
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[10rem]">
                            {onEditLeaf ? (
                              <DropdownMenuItem
                                onClick={() => onEditLeaf(leaf.id)}
                                data-testid={`quality-tree-leaf-edit-${leaf.id}`}
                              >
                                {editLeafLabel}
                              </DropdownMenuItem>
                            ) : null}
                            {onMoveLeaf ? (
                              <DropdownMenuItem
                                onClick={() => onMoveLeaf(leaf.id)}
                                data-testid={`quality-tree-leaf-move-${leaf.id}`}
                              >
                                {moveLeafLabel}
                              </DropdownMenuItem>
                            ) : null}
                            {onEditLeaf || onMoveLeaf ? onDeleteLeaf ? <DropdownMenuSeparator /> : null : null}
                            {onDeleteLeaf ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteLeaf(leaf.id)}
                                data-testid={`quality-tree-leaf-delete-${leaf.id}`}
                              >
                                {deleteLeafLabel}
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/**
 * Prototype-style folder navigation for the Quality tree (`quality-folder` under `root-quality`).
 * Uses URL `?under=<folder-uuid>`; list queries pass `parent_id` for direct children.
 */
export function QualityFolderTreeNav({
  orgSlug,
  projectId,
  manifestBundle,
  onCreateFolderUnder,
  onRenameFolder,
  onDeleteFolder,
  leafArtifactType,
  selectedArtifactId,
  onNewLeafInFolder,
  onSelectLeaf,
  onEditLeaf,
  onMoveLeaf,
  onDeleteLeaf,
  newLeafLabel: newLeafLabelProp,
}: QualityFolderTreeNavProps) {
  const { t } = useTranslation("quality");
  const newLeafLabel = newLeafLabelProp ?? t("tree.newItem");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedUnder = searchParams.get("under")?.trim() || null;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const { data: treeData, isLoading } = useArtifacts(
    orgSlug,
    projectId,
    undefined,
    undefined,
    "title",
    "asc",
    undefined,
    500,
    0,
    false,
    undefined,
    undefined,
    undefined,
    "quality",
    true,
  );

  const roots = useMemo(() => getTreeRootsFromManifestBundle(manifestBundle), [manifestBundle]);

  const explorerTree = useMemo(() => {
    const allow = new Set<string>(["root-quality", "quality-folder"]);
    if (leafArtifactType) allow.add(leafArtifactType);
    const items = (treeData?.items ?? []).filter((a) => allow.has(a.artifact_type));
    return buildArtifactTree(items, roots);
  }, [treeData?.items, roots, leafArtifactType]);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onSelectRoot = () => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete("under");
        p.delete("page");
        return p;
      },
      { replace: true },
    );
  };

  const onSelectFolder = (id: string) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("under", id);
        p.delete("page");
        return p;
      },
      { replace: true },
    );
  };

  if (!orgSlug || !projectId) return null;

  return (
    <div className="flex h-full min-h-[280px] max-h-[calc(100vh-220px)] flex-col rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("tree.folders")}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-2 text-xs text-muted-foreground">{t("tree.loading")}</p>
        ) : explorerTree.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">{t("tree.empty")}</p>
        ) : (
          <FolderTreeRows
            nodes={explorerTree}
            expandedIds={expandedIds}
            toggle={toggle}
            selectedUnder={selectedUnder}
            onSelectRoot={onSelectRoot}
            onSelectFolder={onSelectFolder}
            onCreateFolderUnder={onCreateFolderUnder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            newSubfolderLabel={t("tree.newSubfolder")}
            renameLabel={t("tree.rename")}
            deleteLabel={t("tree.delete")}
            folderActionsLabel={t("tree.folderActions")}
            leafArtifactType={leafArtifactType}
            selectedArtifactId={selectedArtifactId ?? null}
            onNewLeafInFolder={onNewLeafInFolder}
            onSelectLeaf={onSelectLeaf}
            onEditLeaf={onEditLeaf}
            onMoveLeaf={onMoveLeaf}
            onDeleteLeaf={onDeleteLeaf}
            newLeafLabel={newLeafLabel}
            editLeafLabel={t("tree.editLeaf")}
            moveLeafLabel={t("tree.moveLeaf")}
            deleteLeafLabel={t("tree.delete")}
            leafActionsLabel={t("tree.leafActions")}
          />
        )}
      </div>
      {selectedUnder ? (
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={onSelectRoot}
            data-testid="quality-tree-clear-filter"
          >
            {t("tree.clearFilter")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
