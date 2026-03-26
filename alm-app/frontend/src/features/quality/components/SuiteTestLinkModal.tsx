import { useEffect, useMemo, useState, type MouseEvent, type ReactElement } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
} from "../../../shared/components/ui";
import { useArtifacts, type Artifact } from "../../../shared/api/artifactApi";
import {
  useArtifactLinks,
  useBulkCreateArtifactLinks,
  useBulkDeleteArtifactLinks,
} from "../../../shared/api/artifactLinkApi";
import { buildArtifactTree, type ArtifactNode } from "../../artifacts/utils";
import { getTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import type { ManifestResponse } from "../../../shared/api/manifestApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

type Props = {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
  projectId: string;
  suiteArtifactId: string;
  linkType: string;
  manifestBundle: ManifestResponse["manifest_bundle"] | null | undefined;
};

const INDENT_CLASSES = ["pl-2", "pl-5", "pl-8", "pl-11", "pl-14", "pl-[68px]", "pl-20", "pl-[92px]"] as const;

function getIndentClass(depth: number): string {
  if (depth < 0) return INDENT_CLASSES[0];
  return INDENT_CLASSES[Math.min(depth, INDENT_CLASSES.length - 1)] ?? INDENT_CLASSES[0];
}

function FolderTree({
  nodes,
  selectedFolderId,
  onSelectFolder,
}: {
  nodes: ArtifactNode[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const n of nodes) next.add(n.id);
      return next;
    });
  }, [nodes]);

  const renderNode = (node: ArtifactNode, depth: number): ReactElement | null => {
    const isFolder = node.artifact_type === "quality-folder";
    const isRoot = node.artifact_type === "root-quality";
    if (!isFolder && !isRoot) return null;
    const isOpen = expanded.has(node.id) || isRoot;
    const children = node.children.filter((c) => c.artifact_type === "quality-folder");
    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 rounded py-1 pr-2 text-sm ${getIndentClass(depth)} ${selectedFolderId === node.id ? "bg-muted font-medium" : ""}`}
        >
          {children.length > 0 ? (
            <button
              type="button"
              className="w-4 text-xs"
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                })
              }
              aria-label={isOpen ? "Collapse folder" : "Expand folder"}
            >
              {isOpen ? "▾" : "▸"}
            </button>
          ) : (
            <span className="inline-block w-4" />
          )}
          <button
            type="button"
            className="flex-1 truncate text-left"
            onClick={() => onSelectFolder(isRoot ? null : node.id)}
          >
            {node.title || (isRoot ? "Project quality root" : "Folder")}
          </button>
        </div>
        {isOpen ? children.map((c) => renderNode(c, depth + 1)) : null}
      </div>
    );
  };

  return <div className="space-y-1">{nodes.map((n) => renderNode(n, 0))}</div>;
}

export function SuiteTestLinkModal({
  open,
  onClose,
  orgSlug,
  projectId,
  suiteArtifactId,
  linkType,
  manifestBundle,
}: Props) {
  const showNotification = useNotificationStore((s) => s.showNotification);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loadedCount, setLoadedCount] = useState(100);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<"all" | "folder">("all");
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [selectedAvailableIds, setSelectedAvailableIds] = useState<Set<string>>(new Set());
  const [selectedInSuiteIds, setSelectedInSuiteIds] = useState<Set<string>>(new Set());
  const [pendingRemoveLinkIds, setPendingRemoveLinkIds] = useState<string[] | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setLoadedCount(100);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPendingRemoveLinkIds(null);
  }, [selectedInSuiteIds]);

  useEffect(() => {
    setLoadedCount(100);
  }, [scopeMode, includeSubfolders, selectedFolderId]);

  const treeRoots = useMemo(
    () => getTreeRootsFromManifestBundle(manifestBundle),
    [manifestBundle],
  );

  const allTreeArtifacts = useArtifacts(
    orgSlug,
    projectId,
    undefined,
    undefined,
    "title",
    "asc",
    undefined,
    1000,
    0,
    false,
    undefined,
    undefined,
    undefined,
    "quality",
    true,
  );

  const folderTree = useMemo(() => {
    const items = (allTreeArtifacts.data?.items ?? []).filter(
      (a) => a.artifact_type === "root-quality" || a.artifact_type === "quality-folder",
    );
    return buildArtifactTree(items, treeRoots);
  }, [allTreeArtifacts.data?.items, treeRoots]);

  const linksQuery = useArtifactLinks(orgSlug, projectId, suiteArtifactId);
  const bulkCreate = useBulkCreateArtifactLinks(orgSlug, projectId, suiteArtifactId);
  const bulkDelete = useBulkDeleteArtifactLinks(orgSlug, projectId, suiteArtifactId);

  const filteredLinks = useMemo(
    () =>
      (linksQuery.data ?? []).filter(
        (l) => l.link_type === linkType && l.from_artifact_id === suiteArtifactId,
      ),
    [linksQuery.data, linkType, suiteArtifactId],
  );

  const linkByTargetId = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of filteredLinks) map.set(l.to_artifact_id, l.id);
    return map;
  }, [filteredLinks]);

  const allCases = allTreeArtifacts.data?.items?.filter((a) => a.artifact_type === "test-case") ?? [];
  const linkedArtifacts: Artifact[] = allCases.filter((a) => linkByTargetId.has(a.id));
  const folderArtifacts = allTreeArtifacts.data?.items?.filter((a) => a.artifact_type === "quality-folder") ?? [];
  const descendantFolderIds = useMemo(() => {
    if (!selectedFolderId) return new Set<string>();
    const childrenByParent = new Map<string, string[]>();
    for (const f of folderArtifacts) {
      if (!f.parent_id) continue;
      const children = childrenByParent.get(f.parent_id) ?? [];
      children.push(f.id);
      childrenByParent.set(f.parent_id, children);
    }
    const allIds = new Set<string>([selectedFolderId]);
    const stack = [selectedFolderId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) break;
      const children = childrenByParent.get(current) ?? [];
      for (const child of children) {
        if (allIds.has(child)) continue;
        allIds.add(child);
        stack.push(child);
      }
    }
    return allIds;
  }, [folderArtifacts, selectedFolderId]);
  const allCandidates = useMemo(() => {
    let base = allCases;
    if (scopeMode === "folder") {
      if (!selectedFolderId) return [] as Artifact[];
      base = base.filter((c) => {
        if (!c.parent_id) return false;
        if (includeSubfolders) return descendantFolderIds.has(c.parent_id);
        return c.parent_id === selectedFolderId;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      base = base.filter(
        (c) =>
          (c.title ?? "").toLowerCase().includes(q) ||
          (c.artifact_key ?? "").toLowerCase().includes(q),
      );
    }
    return [...base].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", undefined, { sensitivity: "base" }));
  }, [allCases, descendantFolderIds, includeSubfolders, scopeMode, search, selectedFolderId]);
  const candidates = allCandidates.slice(0, loadedCount);
  const hasMoreCandidates = allCandidates.length > candidates.length;
  const suiteArtifact = allTreeArtifacts.data?.items?.find((a) => a.id === suiteArtifactId);

  const pending = bulkCreate.isPending || bulkDelete.isPending;
  const selectedAvailableCount = useMemo(
    () => candidates.filter((c) => selectedAvailableIds.has(c.id)).length,
    [candidates, selectedAvailableIds],
  );
  const selectedInSuiteCount = useMemo(
    () => linkedArtifacts.filter((a) => selectedInSuiteIds.has(a.id)).length,
    [linkedArtifacts, selectedInSuiteIds],
  );
  const addableSelectedCount = useMemo(
    () =>
      candidates.filter((c) => selectedAvailableIds.has(c.id) && !linkByTargetId.has(c.id)).length,
    [candidates, selectedAvailableIds, linkByTargetId],
  );

  const toggleAvailableSelected = (id: string) => {
    setSelectedAvailableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleInSuiteSelected = (id: string) => {
    setSelectedInSuiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    const selectedIdsOnPage = candidates.filter((c) => selectedAvailableIds.has(c.id)).map((c) => c.id);
    const targetIds = selectedIdsOnPage.filter((id) => !linkByTargetId.has(id));
    const skippedCount = selectedIdsOnPage.length - targetIds.length;
    if (targetIds.length === 0 && skippedCount === 0) return;
    if (targetIds.length > 0) {
      const result = await bulkCreate.mutateAsync({
        to_artifact_ids: targetIds,
        link_type: linkType,
        idempotency_key: crypto.randomUUID(),
      });
      setLiveMessage(`${result.succeeded.length} test case(s) added to suite.`);
      showNotification(
        `${result.succeeded.length} added${skippedCount > 0 ? `, ${skippedCount} already in suite` : ""}`,
        "success",
      );
      if (result.failed.length > 0) {
        showNotification(`${result.failed.length} failed to add. Please retry.`, "error");
      }
    } else {
      showNotification(`${skippedCount} already in suite`, "info");
    }
    setSelectedAvailableIds(new Set());
  };

  const removeSelected = async () => {
    const selectedLinkedIds = linkedArtifacts
      .filter((a) => selectedInSuiteIds.has(a.id))
      .map((a) => a.id);
    const linkIds = selectedLinkedIds
      .map((id) => linkByTargetId.get(id))
      .filter((id): id is string => !!id);
    if (linkIds.length === 0) return;
    if (!pendingRemoveLinkIds) {
      setPendingRemoveLinkIds(linkIds);
      return;
    }
    if (pendingRemoveLinkIds.length !== linkIds.length || pendingRemoveLinkIds.some((id) => !linkIds.includes(id))) {
      setPendingRemoveLinkIds(linkIds);
      return;
    }
    const result = await bulkDelete.mutateAsync({
      link_ids: linkIds,
      idempotency_key: crypto.randomUUID(),
    });
    setLiveMessage(`${result.succeeded.length} test case(s) removed from suite.`);
    showNotification(`${result.succeeded.length} removed from suite`, "success");
    if (result.failed.length > 0) {
      showNotification(`${result.failed.length} failed to remove. Please retry.`, "error");
    }
    setSelectedInSuiteIds(new Set());
    setPendingRemoveLinkIds(null);
  };

  const selectAllVisible = () => {
    setSelectedAvailableIds(new Set(candidates.map((c) => c.id)));
  };
  const loadMoreCandidates = () => {
    setLoadedCount((prev) => Math.min(prev + 100, allCandidates.length));
  };

  const handleAvailableRowClick = (id: string) => (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    toggleAvailableSelected(id);
  };
  const handleInSuiteRowClick = (id: string) => (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    toggleInSuiteSelected(id);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        className="flex h-[76vh] w-[95vw] !max-w-none flex-col overflow-hidden p-4 sm:!max-w-none"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Add test cases to test suite</DialogTitle>
          <DialogDescription id="suite-link-modal-description">
            Select test cases from the repository and add them to this test suite.
          </DialogDescription>
        </DialogHeader>
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>
        <div className="sticky top-0 z-10 rounded border bg-background px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground sm:text-sm">
              <span className="font-medium text-foreground">Suite:</span> {suiteArtifact?.title ?? "Current test suite"}{" "}
              · <span className="font-medium text-foreground">Selected:</span>{" "}
              {selectedAvailableCount + selectedInSuiteCount} ·{" "}
              <span className="font-medium text-foreground">In suite:</span> {linkedArtifacts.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 px-2.5 text-xs sm:text-sm"
                onClick={() => void addSelected()}
                disabled={pending || addableSelectedCount === 0}
              >
                Add selected to suite
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-2.5 text-xs sm:text-sm"
                onClick={() => void removeSelected()}
                disabled={pending || selectedInSuiteCount === 0}
              >
                Remove selected from suite
              </Button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <Badge variant="outline">
              Scope: {scopeMode === "all" ? "All test plan" : selectedFolderId ? "Selected folder" : "No folder selected"}
            </Badge>
            {scopeMode === "folder" ? (
              <Badge variant="outline">Mode: {includeSubfolders ? "Include subfolders" : "Direct children"}</Badge>
            ) : null}
            <Badge variant="outline">
              Loaded: {candidates.length}/{allCandidates.length}
            </Badge>
          </div>
          {pendingRemoveLinkIds ? (
            <div className="mt-2 flex items-center justify-between rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5">
              <p className="text-xs text-muted-foreground sm:text-sm">
                Remove {pendingRemoveLinkIds.length} test case(s) from this suite?
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPendingRemoveLinkIds(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 px-2 text-xs"
                  onClick={() => void removeSelected()}
                  disabled={pending}
                >
                  Confirm remove
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid h-full min-h-0 gap-3 grid-cols-2 overflow-hidden">
          <section className="flex min-w-0 min-h-0 flex-col rounded border p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Available test cases</h3>
              <Badge variant="outline">{candidates.length}</Badge>
            </div>
            <div className="mb-1.5 flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedFolderId(null)}>
                All folders
              </Button>
              <Button
                size="sm"
                variant={scopeMode === "all" ? "default" : "outline"}
                onClick={() => setScopeMode("all")}
              >
                All test plan
              </Button>
              <Button
                size="sm"
                variant={scopeMode === "folder" ? "default" : "outline"}
                onClick={() => setScopeMode("folder")}
              >
                Only selected folder
              </Button>
              <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <Switch
                  checked={includeSubfolders}
                  onCheckedChange={setIncludeSubfolders}
                  disabled={scopeMode !== "folder" || !selectedFolderId}
                />
                Include subfolders
              </label>
              {selectedFolderId ? (
                <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
                  Filtered by folder
                </Badge>
              ) : null}
            </div>
            <div className="mb-1.5 min-h-[96px] max-h-[18vh] overflow-auto rounded border p-2">
              <FolderTree
                nodes={folderTree}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(id) => {
                  setSelectedFolderId(id);
                  if (!id && scopeMode === "folder") setScopeMode("all");
                }}
              />
            </div>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search test case title/key"
              aria-label="Search test cases"
              className="mb-1.5 h-8 text-sm"
            />
            <div className="mb-1.5">
              <Button size="sm" variant="outline" className="h-8 w-full text-xs sm:text-sm" onClick={selectAllVisible}>
                Select all on this page
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-auto rounded border p-1">
              {candidates.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">No test cases found.</p>
              ) : (
                candidates.map((c) => {
                const linked = linkByTargetId.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60"
                    onClick={handleAvailableRowClick(c.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAvailableIds.has(c.id)}
                      onChange={() => toggleAvailableSelected(c.id)}
                      aria-label={`Select ${c.title}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm" title={c.title ?? ""}>
                      {c.title}
                    </span>
                    {linked ? (
                      <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
                        Already in suite
                      </Badge>
                    ) : null}
                  </div>
                );
                })
              )}
            </div>
            {hasMoreCandidates ? (
              <div className="mt-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full text-xs sm:text-sm"
                  onClick={loadMoreCandidates}
                >
                  Load more ({Math.min(100, allCandidates.length - candidates.length)} remaining on next page)
                </Button>
              </div>
            ) : null}
          </section>
          <section className="flex min-w-0 min-h-0 flex-col rounded border p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <h3 className="text-sm font-semibold">In this suite</h3>
              <Badge variant="outline">{linkedArtifacts.length}</Badge>
            </div>
            <div className="mb-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-full text-xs sm:text-sm"
                onClick={() => setSelectedInSuiteIds(new Set(linkedArtifacts.map((a) => a.id)))}
              >
                Select all in suite
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-auto rounded border p-1">
              {linkedArtifacts.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">No test cases in this suite yet.</p>
              ) : (
                linkedArtifacts.map((a) => (
                  <div
                    key={a.id}
                    className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60"
                    onClick={handleInSuiteRowClick(a.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedInSuiteIds.has(a.id)}
                      onChange={() => toggleInSuiteSelected(a.id)}
                      aria-label={`Select linked ${a.title}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm" title={a.title ?? ""}>
                      {a.title}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

