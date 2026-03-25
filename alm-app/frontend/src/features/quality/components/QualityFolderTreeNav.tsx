import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Layers } from "lucide-react";
import { useArtifacts } from "../../../shared/api/artifactApi";
import type { ManifestResponse } from "../../../shared/api/manifestApi";
import { getTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import { buildArtifactTree, type ArtifactNode } from "../../artifacts/utils";
import { Button } from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui/utils";

interface QualityFolderTreeNavProps {
  orgSlug: string | undefined;
  projectId: string | undefined;
  manifestBundle: ManifestResponse["manifest_bundle"] | null | undefined;
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
}: {
  nodes: ArtifactNode[];
  expandedIds: Set<string>;
  toggle: (id: string) => void;
  selectedUnder: string | null;
  onSelectRoot: () => void;
  onSelectFolder: (id: string) => void;
}) {
  const navNodes = folderNavNodes(nodes);
  return (
    <>
      {navNodes.map((node) => {
        const childFolders = folderNavNodes(node.children);
        const hasKids = childFolders.length > 0;
        const isRoot = node.artifact_type === "root-quality";
        const open = isRoot || expandedIds.has(node.id);
        const selected = (!selectedUnder && isRoot) || (!!selectedUnder && selectedUnder === node.id);
        return (
          <div key={node.id} className="select-none">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/80",
                selected && "bg-muted font-medium",
              )}
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
            {open && hasKids ? (
              <div className="ml-2 border-l border-border/60 pl-1">
                <FolderTreeRows
                  nodes={childFolders}
                  expandedIds={expandedIds}
                  toggle={toggle}
                  selectedUnder={selectedUnder}
                  onSelectRoot={onSelectRoot}
                  onSelectFolder={onSelectFolder}
                />
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
export function QualityFolderTreeNav({ orgSlug, projectId, manifestBundle }: QualityFolderTreeNavProps) {
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

  const folderOnlyTree = useMemo(() => {
    const items = (treeData?.items ?? []).filter(
      (a) => a.artifact_type === "root-quality" || a.artifact_type === "quality-folder",
    );
    return buildArtifactTree(items, roots);
  }, [treeData?.items, roots]);

  useEffect(() => {
    const rid = folderOnlyTree[0]?.id;
    if (!rid) return;
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.add(rid);
      return n;
    });
  }, [folderOnlyTree]);

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
        Folders
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-2 text-xs text-muted-foreground">Loading…</p>
        ) : folderOnlyTree.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">No quality folders.</p>
        ) : (
          <FolderTreeRows
            nodes={folderOnlyTree}
            expandedIds={expandedIds}
            toggle={toggle}
            selectedUnder={selectedUnder}
            onSelectRoot={onSelectRoot}
            onSelectFolder={onSelectFolder}
          />
        )}
      </div>
      {selectedUnder ? (
        <div className="border-t border-border p-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={onSelectRoot}>
            Clear folder filter
          </Button>
        </div>
      ) : null}
    </div>
  );
}
