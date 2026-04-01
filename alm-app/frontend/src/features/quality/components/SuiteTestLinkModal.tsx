import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
} from "react";
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
  useArtifactRelationships,
  useBulkCreateArtifactRelationships,
  useBulkDeleteArtifactRelationships,
} from "../../../shared/api/relationshipApi";
import { buildArtifactTree, type ArtifactNode } from "../../artifacts/utils";
import { getTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import type { ManifestResponse } from "../../../shared/api/manifestApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useTranslation } from "react-i18next";

type Props = {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
  projectId: string;
  suiteArtifactId: string;
  linkType: string;
  manifestBundle: ManifestResponse["manifest_bundle"] | null | undefined;
  /** `dock` = HP ALM–style side panel with catalog tree (Campaign). `dialog` = modal. */
  presentation?: "dialog" | "dock";
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
  const { t } = useTranslation("quality");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Keep folder rows expanded when the tree data updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync expanded ids with fetched nodes
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
              aria-label={isOpen ? t("suiteLinkUi.collapseFolder") : t("suiteLinkUi.expandFolder")}
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
            {node.title || (isRoot ? t("suiteLinkUi.projectQualityRoot") : t("suiteLinkUi.folderFallback"))}
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
  presentation = "dialog",
}: Props) {
  const { t } = useTranslation("quality");
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
  const includeSubfoldersSwitchId = useId();

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setLoadedCount(100);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset confirm-remove when selection changes
    setPendingRemoveLinkIds(null);
  }, [selectedInSuiteIds]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset paging when scope changes
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

  const linksQuery = useArtifactRelationships(orgSlug, projectId, suiteArtifactId);
  const bulkCreate = useBulkCreateArtifactRelationships(orgSlug, projectId, suiteArtifactId);
  const bulkDelete = useBulkDeleteArtifactRelationships(orgSlug, projectId, suiteArtifactId);

  const filteredLinks = useMemo(
    () =>
      (linksQuery.data ?? []).filter(
        (l) =>
          l.relationship_type === linkType &&
          l.direction === "outgoing" &&
          l.source_artifact_id === suiteArtifactId,
      ),
    [linksQuery.data, linkType, suiteArtifactId],
  );

  const linkByTargetId = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of filteredLinks) map.set(l.target_artifact_id, l.id);
    return map;
  }, [filteredLinks]);

  const allCases = useMemo(
    () => allTreeArtifacts.data?.items?.filter((a) => a.artifact_type === "test-case") ?? [],
    [allTreeArtifacts.data?.items],
  );
  const linkedArtifacts: Artifact[] = useMemo(
    () => allCases.filter((a) => linkByTargetId.has(a.id)),
    [allCases, linkByTargetId],
  );
  const folderArtifacts = useMemo(
    () => allTreeArtifacts.data?.items?.filter((a) => a.artifact_type === "quality-folder") ?? [],
    [allTreeArtifacts.data?.items],
  );
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
  const addableAllInScopeIds = useMemo(
    () => allCandidates.filter((c) => !linkByTargetId.has(c.id)).map((c) => c.id),
    [allCandidates, linkByTargetId],
  );
  const addableAllInScopeCount = addableAllInScopeIds.length;

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
        target_artifact_ids: targetIds,
        relationship_type: linkType,
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

  const CHUNK = 100;
  const addAllInScope = async () => {
    if (addableAllInScopeCount === 0) {
      showNotification(t("campaignExecution.addAllInScopeEmpty"), "info");
      return;
    }
    if (scopeMode === "all") {
      const ok = window.confirm(
        t("campaignExecution.addAllInScopeConfirmAllPlan", { count: addableAllInScopeCount }),
      );
      if (!ok) return;
    }
    let totalSucceeded = 0;
    let totalFailed = 0;
    for (let i = 0; i < addableAllInScopeIds.length; i += CHUNK) {
      const chunk = addableAllInScopeIds.slice(i, i + CHUNK);
      const result = await bulkCreate.mutateAsync({
        target_artifact_ids: chunk,
        relationship_type: linkType,
        idempotency_key: crypto.randomUUID(),
      });
      totalSucceeded += result.succeeded.length;
      totalFailed += result.failed.length;
    }
    const doneMsg = t("campaignExecution.addAllInScopeDone", { count: totalSucceeded });
    setLiveMessage(doneMsg);
    showNotification(
      totalFailed > 0 ? `${doneMsg} ${totalFailed} failed.` : doneMsg,
      totalFailed > 0 ? "error" : "success",
    );
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
      relationship_ids: linkIds,
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

  const handleAvailableRowKeyDown = (id: string) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    toggleAvailableSelected(id);
  };
  const handleInSuiteRowKeyDown = (id: string) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest("input")) return;
    toggleInSuiteSelected(id);
  };

  const setScopeEntireCatalog = () => {
    setScopeMode("all");
    setSelectedFolderId(null);
  };

  const setScopeOneFolder = () => {
    setScopeMode("folder");
  };

  const toolbarBlock = (
    <>
      <p className="sr-only" aria-live="polite">
        {liveMessage}
      </p>
      <div className="sticky top-0 z-10 w-full space-y-2 rounded border bg-background px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t("suiteLinkUi.suiteSummary")}:</span>{" "}
          {suiteArtifact?.title ?? "—"} ·{" "}
          <span className="font-medium text-foreground">{t("suiteLinkUi.selectedSummary")}:</span>{" "}
          {selectedAvailableCount + selectedInSuiteCount} ·{" "}
          <span className="font-medium text-foreground">{t("suiteLinkUi.inSuiteSummary")}:</span>{" "}
          {linkedArtifacts.length}
        </p>
        <Button
          className="h-9 w-full text-sm"
          data-testid="suite-link-add-selected"
          onClick={() => void addSelected()}
          disabled={pending || addableSelectedCount === 0}
        >
          {t("suiteLinkUi.addToSuite")}
        </Button>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-9 w-full text-sm"
            data-testid="suite-link-add-all-in-scope"
            title={t("campaignExecution.addAllInScopeHint")}
            onClick={() => void addAllInScope()}
            disabled={pending || addableAllInScopeCount === 0}
          >
            {t("suiteLinkUi.addAllInList")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-9 w-full text-sm"
            data-testid="suite-link-remove-from-suite"
            onClick={() => void removeSelected()}
            disabled={pending || selectedInSuiteCount === 0}
          >
            {t("suiteLinkUi.removeFromSuite")}
          </Button>
        </div>
        {pendingRemoveLinkIds ? (
          <div className="flex flex-col gap-2 rounded border border-destructive/30 bg-destructive/5 px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t("suiteLinkUi.confirmRemoveQuestion", { count: pendingRemoveLinkIds.length })}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => setPendingRemoveLinkIds(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-2 text-xs"
                onClick={() => void removeSelected()}
                disabled={pending}
              >
                {t("suiteLinkUi.confirmRemove")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  const catalogTreeBoxClass =
    presentation === "dock"
      ? "mb-1.5 min-h-[120px] max-h-[min(40vh,360px)] shrink-0 overflow-auto rounded border p-2"
      : "mb-1.5 min-h-[100px] max-h-[min(32vh,320px)] shrink-0 overflow-auto rounded border p-2";

  const catalogAvailableSection = (
    <section className="flex min-w-0 min-h-0 flex-col rounded border p-3">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("campaignExecution.catalogTreeHeading")}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {candidates.length}/{allCandidates.length}
        </span>
      </div>
      <div
        className="mb-1.5 flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        role="radiogroup"
        aria-label={t("suiteLinkUi.scopeLabel")}
      >
        <div className="flex w-full gap-1 rounded-md border bg-muted/40 p-1 sm:w-auto sm:min-w-0 sm:flex-1">
          <button
            type="button"
            role="radio"
            aria-checked={scopeMode === "all"}
            data-testid="suite-link-scope-all"
            className={`flex-1 rounded-sm px-2 py-1.5 text-center text-xs font-medium transition-colors sm:text-sm ${
              scopeMode === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={setScopeEntireCatalog}
          >
            {t("suiteLinkUi.scopeEntireCatalog")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={scopeMode === "folder"}
            data-testid="suite-link-scope-folder"
            className={`flex-1 rounded-sm px-2 py-1.5 text-center text-xs font-medium transition-colors sm:text-sm ${
              scopeMode === "folder" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={setScopeOneFolder}
          >
            {t("suiteLinkUi.scopeOneFolder")}
          </button>
        </div>
        <label
          htmlFor={includeSubfoldersSwitchId}
          className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:ml-auto sm:text-sm"
        >
          <Switch
            id={includeSubfoldersSwitchId}
            checked={includeSubfolders}
            onCheckedChange={setIncludeSubfolders}
            disabled={scopeMode !== "folder" || !selectedFolderId}
          />
          {t("suiteLinkUi.includeSubfolders")}
        </label>
      </div>
      {scopeMode === "folder" && !selectedFolderId ? (
        <p className="mb-1.5 text-xs text-muted-foreground" data-testid="suite-link-pick-folder-hint">
          {t("suiteLinkUi.pickFolderHint")}
        </p>
      ) : null}
      <div className={catalogTreeBoxClass}>
        <FolderTree
          nodes={folderTree}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => {
            setSelectedFolderId(id);
            if (id) setScopeMode("folder");
            else if (scopeMode === "folder") setScopeMode("all");
          }}
        />
      </div>
      <Input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder={t("suiteLinkUi.searchPlaceholder")}
        aria-label={t("suiteLinkUi.searchAriaLabel")}
        className="mb-1.5 h-8 shrink-0 text-sm"
      />
      <div className="mb-1.5 shrink-0">
        <Button size="sm" variant="outline" className="h-8 w-full text-xs sm:text-sm" onClick={selectAllVisible}>
          {t("suiteLinkUi.selectAllOnPage")}
        </Button>
      </div>
      <div
        className={
          presentation === "dock"
            ? "min-h-[180px] flex-1 space-y-0.5 overflow-auto rounded border p-1"
            : "min-h-[220px] flex-1 space-y-0.5 overflow-auto rounded border p-1"
        }
      >
        {candidates.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">{t("suiteLinkUi.emptyAvailable")}</p>
        ) : (
          candidates.map((c) => {
            const linked = linkByTargetId.has(c.id);
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60"
                onClick={handleAvailableRowClick(c.id)}
                onKeyDown={handleAvailableRowKeyDown(c.id)}
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
                    {t("suiteLinkUi.alreadyInSuite")}
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
            {t("suiteLinkUi.loadMore")} —{" "}
            {t("suiteLinkUi.loadMoreDetail", {
              next: Math.min(100, allCandidates.length - candidates.length),
              remaining: allCandidates.length - candidates.length,
            })}
          </Button>
        </div>
      ) : null}
    </section>
  );

  const inSuiteSection = (
    <section className="flex min-w-0 min-h-0 flex-col rounded border p-3">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("suiteLinkUi.inSuiteHeading")}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{linkedArtifacts.length}</span>
      </div>
      <div className="mb-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-full text-xs sm:text-sm"
          onClick={() => setSelectedInSuiteIds(new Set(linkedArtifacts.map((a) => a.id)))}
        >
          {t("suiteLinkUi.selectAllInSuite")}
        </Button>
      </div>
      <div
        className={
          presentation === "dock"
            ? "min-h-[160px] flex-1 space-y-0.5 overflow-auto rounded border p-1"
            : "min-h-[220px] flex-1 space-y-0.5 overflow-auto rounded border p-1"
        }
      >
        {linkedArtifacts.length === 0 ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">{t("suiteLinkUi.emptyInSuite")}</p>
        ) : (
          linkedArtifacts.map((a) => (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60"
              onClick={handleInSuiteRowClick(a.id)}
              onKeyDown={handleInSuiteRowKeyDown(a.id)}
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
  );

  const body = (
    <>
      {toolbarBlock}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-2">
        {catalogAvailableSection}
        {inSuiteSection}
      </div>
    </>
  );

  const footer = (
    <Button type="button" variant="outline" onClick={onClose}>
      {t("common.close")}
    </Button>
  );

  if (presentation === "dock") {
    if (!open) return null;
    return (
      <aside
        aria-labelledby="suite-link-dock-title"
        data-testid="quality-suite-catalog-panel"
        className="flex h-full min-h-0 w-[min(420px,100%)] shrink-0 flex-col overflow-hidden border-l bg-background shadow-xl lg:max-w-[min(420px,36vw)] lg:min-w-[300px] lg:shadow-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b px-3 py-3">
          <div className="min-w-0 space-y-1">
            <h2 id="suite-link-dock-title" className="text-base font-semibold leading-tight">
              {t("campaignExecution.catalogPanelTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("campaignExecution.catalogPanelDescription")}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden px-3 pb-3 pt-0">
          {toolbarBlock}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-3">
            {catalogAvailableSection}
            {inSuiteSection}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        className="flex h-[86vh] min-h-[620px] w-[95vw] max-h-[900px] !max-w-none flex-col overflow-hidden p-4 sm:!max-w-none"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{t("campaignExecution.catalogPanelTitle")}</DialogTitle>
          <DialogDescription id="suite-link-modal-description">
            {t("campaignExecution.catalogPanelDescription")}
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
