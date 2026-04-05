import { Link, useSearchParams } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import {
  Button,
  Card,
  CardContent,
  Badge,
  Skeleton,
  Avatar,
  AvatarFallback,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui/utils";
import { RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useOrgProjectFromRoute } from "../../../shared/hooks/useOrgProjectFromRoute";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useCadences, useAreaNodes, cadenceDisplayLabel, areaNodeDisplayLabel } from "../../../shared/api/planningApi";
import { useArtifacts, useTransitionArtifactById } from "../../../shared/api/artifactApi";
import { useProjectMembers } from "../../../shared/api/orgApi";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useRealtimeStore } from "../../../shared/stores/realtimeStore";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { artifactDetailPath, artifactsPath } from "../../../shared/utils/appPaths";
import {
  buildWorkflowStateDisplayMap,
  getMergedWorkflowStatesForAllTypes,
  getMergedWorkflowStatesForArtifactTypes,
  getWorkflowStatesForType,
  isBoardSelectableArtifactType,
  normalizeWorkflowStateKey,
  resolveWorkflowStateForArtifactType,
  type ManifestBundleShape,
} from "../../../shared/lib/workflowManifest";
import { getValidTransitions } from "../../artifacts/utils";

type WorkflowState = string;

const BOARD_UNASSIGNED_VALUE = "__unassigned__";

function boardTypeStorageKey(projectId: string) {
  return `alm.board.typeFilter.${projectId}`;
}

const COLUMN_COLORS = [
  "#f59e0b",
  "#8b5cf6",
  "#2563eb",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

function getTypeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  const t = type.toLowerCase();
  if (t === "defect") return "destructive";
  if (t === "epic") return "secondary";
  return "outline";
}

function canDropArtifactOnColumn(
  manifest: Parameters<typeof getValidTransitions>[0],
  bundle: ManifestBundleShape | null | undefined,
  artifact: Artifact,
  targetColumnState: string,
): boolean {
  if (!artifact.allowed_actions?.includes("transition")) return false;
  const newState = resolveWorkflowStateForArtifactType(bundle ?? null, artifact.artifact_type, targetColumnState);
  if (newState == null) return false;
  if (normalizeWorkflowStateKey(newState) === normalizeWorkflowStateKey(artifact.state)) return false;
  const valid = getValidTransitions(manifest, artifact.artifact_type, artifact.state);
  return valid.includes(newState);
}

export default function BoardPage() {
  const { orgSlug, projectSlug, project, projectsLoading } = useOrgProjectFromRoute();
  const { data: manifest, isLoading: manifestLoading } = useProjectManifest(orgSlug, project?.id);
  const { data: cycleCadences = [] } = useCadences(orgSlug, project?.id, true, "cycle");
  const { data: areaNodesFlat = [] } = useAreaNodes(orgSlug, project?.id, true);
  const [searchParams] = useSearchParams();
  const [draggingArtifactId, setDraggingArtifactId] = useState<string | null>(null);
  const boardTypeHydratedForProjectRef = useRef<string | null>(null);

  type BoardFilterValues = {
    typeFilter: string;
    releaseFilter: string;
    cycleFilter: string;
    areaFilter: string;
    searchQuery: string;
    assigneeFilter: string;
  };
  const filterForm = useForm<BoardFilterValues>({
    defaultValues: {
      typeFilter: "",
      releaseFilter: "",
      cycleFilter: "",
      areaFilter: "",
      searchQuery: "",
      assigneeFilter: "",
    },
  });
  const { control } = filterForm;
  const typeFilter = useWatch({ control, name: "typeFilter" }) ?? "";
  const releaseFilter = useWatch({ control, name: "releaseFilter" }) ?? "";
  const cycleFilter = useWatch({ control, name: "cycleFilter" }) ?? "";
  const areaFilter = useWatch({ control, name: "areaFilter" }) ?? "";
  const searchQueryWatch = useWatch({ control, name: "searchQuery" }) ?? "";
  const assigneeFilter = useWatch({ control, name: "assigneeFilter" }) ?? "";
  const { data: releaseCadences = [] } = useCadences(orgSlug, project?.id, true, "release");
  const { data: projectMembers = [] } = useProjectMembers(orgSlug, project?.id);

  useEffect(() => {
    boardTypeHydratedForProjectRef.current = null;
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id || manifestLoading || !manifest?.manifest_bundle) return;
    if (boardTypeHydratedForProjectRef.current === project.id) return;
    boardTypeHydratedForProjectRef.current = project.id;
    const types = (manifest.manifest_bundle as ManifestBundleShape).artifact_types ?? [];
    const selectable = types.filter(isBoardSelectableArtifactType);
    const validIds = new Set(
      selectable.length > 0 ? selectable.map((t) => t.id) : types.map((t) => t.id),
    );
    const storageKey = boardTypeStorageKey(project.id);
    let chosen: string | undefined;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null && (stored === "" || validIds.has(stored))) {
      chosen = stored;
    }
    if (chosen === undefined) {
      const q = searchParams.get("type");
      if (q !== null && (q === "" || validIds.has(q))) chosen = q;
    }
    if (chosen === undefined) {
      chosen = selectable.length > 0 ? (selectable[0]?.id ?? "") : "";
    }
    filterForm.setValue("typeFilter", chosen);
  }, [project?.id, manifestLoading, manifest, searchParams, filterForm]);

  useEffect(() => {
    if (!project?.id) return;
    if (boardTypeHydratedForProjectRef.current !== project.id) return;
    try {
      localStorage.setItem(boardTypeStorageKey(project.id), typeFilter);
    } catch {
      /* ignore quota / private mode */
    }
  }, [typeFilter, project?.id]);

  const searchTrimmed = searchQueryWatch.trim();
  const assigneeUnassigned = assigneeFilter === BOARD_UNASSIGNED_VALUE;
  const assigneeIdParam =
    !assigneeUnassigned && assigneeFilter.trim() ? assigneeFilter.trim() : undefined;

  const { data: artifactsData, isLoading: artifactsLoading } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    typeFilter.trim() ? typeFilter.trim() : undefined,
    "updated_at",
    "asc",
    searchTrimmed || undefined,
    200,
    0,
    false,
    releaseFilter ? undefined : (cycleFilter || undefined),
    releaseFilter || undefined,
    areaFilter || undefined,
    undefined,
    true,
    undefined,
    undefined,
    undefined,
    assigneeIdParam,
    assigneeUnassigned,
  );
  const transitionMutation = useTransitionArtifactById(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);
  const recentlyUpdatedArtifactIds = useRealtimeStore((s) => s.recentlyUpdatedArtifactIds);
  const presenceByArtifactId = useRealtimeStore((s) => s.presenceByArtifactId);

  const bundle = manifest?.manifest_bundle as ManifestBundleShape | undefined;
  const artifactTypes = useMemo(() => bundle?.artifact_types ?? [], [bundle]);
  const boardSelectableArtifactTypes = useMemo(
    () => artifactTypes.filter(isBoardSelectableArtifactType),
    [artifactTypes],
  );
  const rootLikeTypeIds = useMemo(
    () => new Set(artifactTypes.filter((at) => !isBoardSelectableArtifactType(at)).map((at) => at.id)),
    [artifactTypes],
  );
  const stateDisplayMap = useMemo(() => buildWorkflowStateDisplayMap(bundle ?? null), [bundle]);
  const artifactTypeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const at of artifactTypes) m.set(at.id, at.name?.trim() ? at.name : at.id);
    return m;
  }, [artifactTypes]);
  const baseStates = useMemo(
    () =>
      typeFilter
        ? getWorkflowStatesForType(bundle ?? null, typeFilter)
        : boardSelectableArtifactTypes.length > 0
          ? getMergedWorkflowStatesForArtifactTypes(
              bundle ?? null,
              boardSelectableArtifactTypes.map((t) => t.id),
            )
          : getMergedWorkflowStatesForAllTypes(bundle ?? null),
    [bundle, typeFilter, boardSelectableArtifactTypes],
  );
  const allArtifacts = useMemo(() => artifactsData?.items ?? [], [artifactsData?.items]);
  const artifacts = useMemo(() => {
    let list = allArtifacts;
    if (!typeFilter && boardSelectableArtifactTypes.length > 0) {
      list = allArtifacts.filter((a) => !rootLikeTypeIds.has(a.artifact_type));
    }
    if (typeFilter) list = list.filter((a) => a.artifact_type === typeFilter);
    return list;
  }, [allArtifacts, typeFilter, boardSelectableArtifactTypes, rootLikeTypeIds]);
  const { columnStates, normToCanonical } = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of baseStates) m.set(normalizeWorkflowStateKey(s), s);
    const extras: string[] = [];
    const uniqArtifactStates = [...new Set(artifacts.map((a) => a.state))].sort((a, b) =>
      String(a).localeCompare(String(b)),
    );
    for (const s of uniqArtifactStates) {
      const k = normalizeWorkflowStateKey(s);
      if (m.has(k)) continue;
      m.set(k, s);
      extras.push(s);
    }
    return { columnStates: [...baseStates, ...extras], normToCanonical: m };
  }, [baseStates, artifacts]);
  const byState = useMemo(() => {
    const map = new Map<WorkflowState, Artifact[]>();
    for (const s of columnStates) map.set(s, []);
    for (const a of artifacts) {
      const k = normalizeWorkflowStateKey(a.state);
      const canon = normToCanonical.get(k) ?? a.state;
      const list = map.get(canon);
      if (list) list.push(a);
      else {
        const fallback = map.get(a.state);
        if (fallback) fallback.push(a);
        else map.set(a.state, [a]);
      }
    }
    const sortArtifacts = (list: Artifact[]) =>
      [...list].sort((x, y) => {
        const rx = x.rank_order ?? 0;
        const ry = y.rank_order ?? 0;
        if (rx !== ry) return rx - ry;
        const cx = x.created_at ?? "";
        const cy = y.created_at ?? "";
        return cx.localeCompare(cy);
      });
    for (const s of columnStates) {
      const list = map.get(s) ?? [];
      map.set(s, sortArtifacts(list));
    }
    return map;
  }, [columnStates, artifacts, normToCanonical]);

  const columnDropAllowedMap = useMemo(() => {
    if (!draggingArtifactId) return null;
    const art = artifacts.find((a) => a.id === draggingArtifactId);
    if (!art) return null;
    const m = new Map<string, boolean>();
    for (const col of columnStates) {
      m.set(col, canDropArtifactOnColumn(manifest, bundle, art, col));
    }
    return m;
  }, [draggingArtifactId, artifacts, columnStates, manifest, bundle]);

  const handleDragStart = useCallback((e: React.DragEvent, artifactId: string, currentState: string) => {
    setDraggingArtifactId(artifactId);
    e.dataTransfer.setData("application/json", JSON.stringify({ artifactId, currentState }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingArtifactId(null);
  }, []);

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, targetColumnState: WorkflowState) => {
      e.preventDefault();
      if (!draggingArtifactId) {
        e.dataTransfer.dropEffect = "move";
        return;
      }
      const art = artifacts.find((a) => a.id === draggingArtifactId);
      if (!art || !canDropArtifactOnColumn(manifest, bundle, art, targetColumnState)) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      e.dataTransfer.dropEffect = "move";
    },
    [draggingArtifactId, artifacts, manifest, bundle],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnState: WorkflowState) => {
      e.preventDefault();
      setDraggingArtifactId(null);
      if (transitionMutation.isPending) return;
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;
        const { artifactId, currentState } = JSON.parse(raw) as { artifactId: string; currentState: string };
        const art = artifacts.find((x) => x.id === artifactId);
        if (!art) return;
        if (!canDropArtifactOnColumn(manifest, bundle, art, targetColumnState)) {
          showNotification("That transition is not allowed for this work item.", "error");
          return;
        }
        const newState = resolveWorkflowStateForArtifactType(
          bundle ?? null,
          art.artifact_type,
          targetColumnState,
        );
        if (newState == null) {
          showNotification("This column does not apply to this work item type.", "error");
          return;
        }
        if (normalizeWorkflowStateKey(newState) === normalizeWorkflowStateKey(currentState)) return;
        transitionMutation.mutate(
          { artifactId, new_state: newState },
          {
            onSuccess: () => showNotification("State updated", "success"),
            onError: (err: Error) =>
              showNotification((err as { detail?: string })?.detail ?? err.message ?? "Transition failed", "error"),
          },
        );
      } catch {
        /* ignore */
      }
    },
    [transitionMutation, showNotification, bundle, artifacts, manifest],
  );

  const transitionPending = transitionMutation.isPending;

  const boardContextSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${artifacts.length} shown`);
    if (typeFilter) {
      parts.push(`Type: ${artifactTypeLabelMap.get(typeFilter) ?? typeFilter}`);
    } else {
      parts.push("Type: All");
    }
    if (releaseFilter) {
      const c = releaseCadences.find((x) => x.id === releaseFilter);
      parts.push(`Release: ${c?.path || c?.name || releaseFilter}`);
    } else if (cycleFilter) {
      const c = cycleCadences.find((x) => x.id === cycleFilter);
      parts.push(`Cycle: ${c ? cadenceDisplayLabel(c) : cycleFilter}`);
    }
    if (areaFilter) {
      const a = areaNodesFlat.find((x) => x.id === areaFilter);
      parts.push(`Area: ${a ? areaNodeDisplayLabel(a) : areaFilter}`);
    }
    if (searchTrimmed) parts.push(`Search: “${searchTrimmed}”`);
    if (assigneeUnassigned) parts.push("Assignee: Unassigned");
    else if (assigneeIdParam) parts.push("Assignee: filtered");
    return parts.join(" · ");
  }, [
    artifacts.length,
    typeFilter,
    artifactTypeLabelMap,
    releaseFilter,
    cycleFilter,
    areaFilter,
    releaseCadences,
    cycleCadences,
    areaNodesFlat,
    searchTrimmed,
    assigneeUnassigned,
    assigneeIdParam,
  ]);

  const showAllTypesBoardHint = typeFilter === "" && boardSelectableArtifactTypes.length > 1;

  if (!orgSlug || !projectSlug) {
    return (
      <div className="mx-auto max-w-5xl py-4">
        <p className="text-muted-foreground">Missing org or project.</p>
      </div>
    );
  }

  if (projectsLoading) {
    return (
      <div className="mx-auto max-w-[1400px] py-4">
        <div className="text-muted-foreground">Loading project…</div>
      </div>
    );
  }
  if (!project) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }

  return (
    <TooltipProvider>
      <DndProvider backend={HTML5Backend}>
        <div className="mx-auto max-w-[1400px] py-4">
          <ProjectBreadcrumbs currentPageLabel="Board" projectName={project?.name} />

          <div className="mb-6 flex flex-wrap items-center gap-4">
            <LayoutGrid className="size-5 text-primary" aria-hidden />
            <h1 className="text-2xl font-bold">Board</h1>
            <Button variant="outline" size="sm" asChild>
              <Link
                to={artifactsPath(orgSlug, projectSlug, {
                  type: typeFilter || undefined,
                  releaseFilter: releaseFilter || undefined,
                  cycleFilter: cycleFilter || undefined,
                  areaNodeFilter: areaFilter || undefined,
                })}
              >
                View in Backlog
              </Link>
            </Button>
            <FormProvider {...filterForm}>
              <div className="flex flex-wrap items-center gap-2">
                {boardSelectableArtifactTypes.length > 0 && (
                  <div className="min-w-[180px]">
                    <RhfSelect<BoardFilterValues>
                      name="typeFilter"
                      control={control}
                      label="Artifact type"
                      placeholder="All"
                      options={[
                        { value: "", label: "All" },
                        ...boardSelectableArtifactTypes.map((at) => ({
                          value: at.id,
                          label: at.name ?? at.id,
                        })),
                      ]}
                      selectProps={{ size: "sm" }}
                    />
                  </div>
                )}
                {cycleCadences.length > 0 && (
                  <div className="min-w-[180px]">
                    <RhfSelect<BoardFilterValues>
                      name="releaseFilter"
                      control={control}
                      label="Release"
                      placeholder="All"
                      options={[{ value: "", label: "All" }, ...releaseCadences.map((c) => ({ value: c.id, label: c.path || c.name }))]}
                      selectProps={{ size: "sm" }}
                    />
                  </div>
                )}
                {cycleCadences.length > 0 && (
                  <div className="min-w-[180px]">
                    <RhfSelect<BoardFilterValues>
                      name="cycleFilter"
                      control={control}
                      label="Cycle"
                      placeholder="All"
                      options={[{ value: "", label: "All" }, ...cycleCadences.map((c) => ({ value: c.id, label: cadenceDisplayLabel(c) }))]}
                      selectProps={{ size: "sm" }}
                    />
                  </div>
                )}
                {areaNodesFlat.length > 0 && (
                  <div className="min-w-[180px]">
                    <RhfSelect<BoardFilterValues>
                      name="areaFilter"
                      control={control}
                      label="Area"
                      placeholder="All"
                      options={[{ value: "", label: "All" }, ...areaNodesFlat.map((a) => ({ value: a.id, label: areaNodeDisplayLabel(a) }))]}
                      selectProps={{ size: "sm" }}
                    />
                  </div>
                )}
                <div className="min-w-[200px] max-w-xs">
                  <RhfTextField<BoardFilterValues>
                    name="searchQuery"
                    label="Search"
                    placeholder="Title, key…"
                    size="small"
                  />
                </div>
                <div className="min-w-[180px]">
                  <RhfSelect<BoardFilterValues>
                    name="assigneeFilter"
                    control={control}
                    label="Assignee"
                    placeholder="All"
                    options={[
                      { value: "", label: "All" },
                      { value: BOARD_UNASSIGNED_VALUE, label: "Unassigned" },
                      ...projectMembers.map((m) => ({
                        value: m.user_id,
                        label: m.role ? `${m.user_id} (${m.role})` : m.user_id,
                      })),
                    ]}
                    selectProps={{ size: "sm" }}
                  />
                </div>
              </div>
            </FormProvider>
          </div>

          {showAllTypesBoardHint && (
            <div
              className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
              role="status"
            >
              Multiple workflows are merged into one board. Choose an artifact type above for a single, clearer
              workflow.
            </div>
          )}

          <p className="mb-4 text-sm text-muted-foreground">{boardContextSummary}</p>

          {manifestLoading || artifactsLoading ? (
            <Skeleton className="h-[400px] w-full rounded-lg" />
          ) : columnStates.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">
                No workflow states in manifest. Define workflows with states in Process manifest to use the board.
              </p>
              <Button asChild className="mt-4">
                <Link to={`/${orgSlug}/${projectSlug}/manifest`}>Open Manifest</Link>
              </Button>
            </div>
          ) : (
            <>
              {transitionPending && (
                <p className="mb-2 text-sm text-muted-foreground" role="status">
                  Updating work item state…
                </p>
              )}
              {columnStates.length > 1 && (
                <p className="mb-2 block w-full min-w-0 text-xs text-muted-foreground">
                  Scroll horizontally to see all columns.
                </p>
              )}
              <div
                className="flex min-h-[400px] gap-2 overflow-x-auto pb-4"
                aria-label="Kanban board"
              >
              {columnStates.map((state, colIndex) => {
                const colColor = COLUMN_COLORS[colIndex % COLUMN_COLORS.length];
                const colArtifacts = byState.get(state) ?? [];
                const hasStateId = state.trim().length > 0;
                const columnHeadline = hasStateId ? (stateDisplayMap.get(state) ?? state) : "(No state)";
                const columnTooltip = hasStateId ? `State id: ${state}` : "Empty state id";
                const colKey = state.length ? state : "__no_state__";
                const dropAllowed = columnDropAllowedMap?.get(state);
                const columnDimmed = draggingArtifactId != null && dropAllowed === false;
                return (
                  <div
                    key={colKey}
                    onDragOver={(e) => handleColumnDragOver(e, state)}
                    onDrop={(e) => handleDrop(e, state)}
                    className={cn(
                      "flex min-h-[500px] min-w-[300px] max-w-[300px] shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50",
                      columnDimmed && "opacity-45",
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: colColor }}
                        />
                        <span className="min-w-0 truncate font-bold" title={columnTooltip}>
                          {columnHeadline}
                        </span>
                      </div>
                      <Badge
                        className="h-6 text-xs font-bold text-white"
                        style={{ backgroundColor: colColor }}
                      >
                        {colArtifacts.length}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-2">
                      {colArtifacts.map((a) => (
                        <Card
                          key={a.id}
                          draggable={
                            !transitionPending && Boolean(a.allowed_actions?.includes("transition"))
                          }
                          onDragStart={(e) => handleDragStart(e, a.id, a.state)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "cursor-grab transition shadow hover:shadow-md active:cursor-grabbing",
                            transitionPending && "pointer-events-none opacity-60",
                            !a.allowed_actions?.includes("transition") && "cursor-default",
                          )}
                        >
                          <CardContent className="px-4 py-3">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-primary">
                                {a.artifact_key ?? a.id.slice(0, 8)}
                              </span>
                              {a.artifact_type && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant={getTypeVariant(a.artifact_type)} className="text-[10px]">
                                      {artifactTypeLabelMap.get(a.artifact_type) ?? a.artifact_type}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Type id: {a.artifact_type}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <Link
                              to={artifactDetailPath(orgSlug, projectSlug, a.id)}
                              className="mb-1 block font-semibold text-foreground line-clamp-2 no-underline hover:underline"
                            >
                              {a.title || "—"}
                            </Link>
                            {(recentlyUpdatedArtifactIds[a.id] ||
                              (presenceByArtifactId[a.id]?.length ?? 0) > 0) && (
                              <div className="mt-1 flex items-center gap-1">
                                {recentlyUpdatedArtifactIds[a.id] && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Live update
                                  </Badge>
                                )}
                                {(presenceByArtifactId[a.id]?.length ?? 0) > 0 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {presenceByArtifactId[a.id]!.length} viewing
                                  </Badge>
                                )}
                              </div>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              {a.assignee_id ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Avatar className="size-6 text-[10px]">
                                      <AvatarFallback>
                                        {a.assignee_id.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>Assignee</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span />
                              )}
                              {a.updated_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(a.updated_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {colArtifacts.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-8 text-muted-foreground">
                          <span className="text-sm">Drop here</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      </DndProvider>
    </TooltipProvider>
  );
}
