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
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useRealtimeStore } from "../../../shared/stores/realtimeStore";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { artifactDetailPath, artifactsPath } from "../../../shared/utils/appPaths";
import { buildWorkflowStateDisplayMap, isBoardSelectableArtifactType, normalizeWorkflowStateKey } from "../../../shared/lib/workflowManifest";
import {
  flowBoardStrategy,
  flowColumnHeadline,
  type ManifestBundleWithBoard,
} from "../../../shared/lib/board";

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
    const types = (manifest.manifest_bundle as ManifestBundleWithBoard).artifact_types ?? [];
    const selectable = types.filter(isBoardSelectableArtifactType);
    const validIds = new Set(
      selectable.length > 0 ? selectable.map((t) => t.id) : types.map((t) => t.id),
    );
    const defaultTypeId =
      selectable.length > 0 ? (selectable[0]?.id ?? "") : types[0]?.id ?? "";
    const storageKey = boardTypeStorageKey(project.id);
    let chosen: string | undefined;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null && stored !== "" && validIds.has(stored)) {
      chosen = stored;
    }
    if (chosen === undefined) {
      const q = searchParams.get("type");
      if (q !== null && q !== "" && validIds.has(q)) chosen = q;
    }
    if (chosen === undefined || chosen === "") {
      chosen = defaultTypeId;
    }
    filterForm.setValue("typeFilter", chosen);
  }, [project?.id, manifestLoading, manifest, searchParams, filterForm]);

  useEffect(() => {
    if (!project?.id) return;
    if (boardTypeHydratedForProjectRef.current !== project.id) return;
    const t = typeFilter.trim();
    if (!t) return;
    try {
      localStorage.setItem(boardTypeStorageKey(project.id), t);
    } catch {
      /* ignore quota / private mode */
    }
  }, [typeFilter, project?.id]);

  const searchTrimmed = searchQueryWatch.trim();
  const assigneeUnassigned = assigneeFilter === BOARD_UNASSIGNED_VALUE;
  const assigneeIdParam =
    !assigneeUnassigned && assigneeFilter.trim() ? assigneeFilter.trim() : undefined;

  const bundle = manifest?.manifest_bundle as ManifestBundleWithBoard | undefined;
  const transitionBundle = bundle ?? null;
  const artifactTypes = useMemo(() => bundle?.artifact_types ?? [], [bundle]);
  const typeFilterTrimmed = typeFilter.trim();
  /** Avoid listing all types before manifest hydration picks a concrete board type. */
  const boardArtifactListEnabled =
    !manifestLoading && (artifactTypes.length === 0 || typeFilterTrimmed.length > 0);

  const { data: artifactsData, isLoading: artifactsLoading } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    typeFilterTrimmed || undefined,
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
    boardArtifactListEnabled,
  );
  const transitionMutation = useTransitionArtifactById(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);
  const recentlyUpdatedArtifactIds = useRealtimeStore((s) => s.recentlyUpdatedArtifactIds);
  const presenceByArtifactId = useRealtimeStore((s) => s.presenceByArtifactId);

  const boardSelectableArtifactTypes = useMemo(
    () => artifactTypes.filter(isBoardSelectableArtifactType),
    [artifactTypes],
  );
  const stateDisplayMap = useMemo(() => buildWorkflowStateDisplayMap(bundle ?? null), [bundle]);
  const artifactTypeLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const at of artifactTypes) m.set(at.id, at.name?.trim() ? at.name : at.id);
    return m;
  }, [artifactTypes]);
  const allArtifacts = useMemo(() => artifactsData?.items ?? [], [artifactsData?.items]);
  const artifacts = useMemo(() => {
    if (!typeFilterTrimmed) return allArtifacts;
    return allArtifacts.filter((a) => a.artifact_type === typeFilterTrimmed);
  }, [allArtifacts, typeFilterTrimmed]);

  const boardSurface = useMemo(() => flowBoardStrategy.getDefaultSurface(bundle ?? null), [bundle]);

  const columnModel = useMemo(
    () =>
      flowBoardStrategy.buildColumnModel(
        bundle ?? null,
        typeFilterTrimmed,
        boardSelectableArtifactTypes,
        artifacts,
        boardSurface,
      ),
    [bundle, typeFilterTrimmed, boardSelectableArtifactTypes, artifacts, boardSurface],
  );

  const byState = useMemo(
    () => flowBoardStrategy.groupArtifacts(bundle ?? null, columnModel, artifacts),
    [bundle, columnModel, artifacts],
  );

  const columnDropAllowedMap = useMemo(
    () =>
      flowBoardStrategy.buildDropAllowedMap(
        columnModel,
        bundle ?? null,
        transitionBundle,
        draggingArtifactId,
        artifacts,
      ),
    [columnModel, bundle, transitionBundle, draggingArtifactId, artifacts],
  );

  const handleDragStart = useCallback((e: React.DragEvent, artifactId: string, currentState: string) => {
    setDraggingArtifactId(artifactId);
    e.dataTransfer.setData("application/json", JSON.stringify({ artifactId, currentState }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingArtifactId(null);
  }, []);

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, targetColumnKey: string) => {
      e.preventDefault();
      if (!draggingArtifactId) {
        e.dataTransfer.dropEffect = "move";
        return;
      }
      const art = artifacts.find((a) => a.id === draggingArtifactId);
      if (
        !art ||
        !flowBoardStrategy.canDropOnColumn(bundle ?? null, transitionBundle, art, targetColumnKey, columnModel)
      ) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      e.dataTransfer.dropEffect = "move";
    },
    [draggingArtifactId, artifacts, bundle, transitionBundle, columnModel],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnKey: string) => {
      e.preventDefault();
      setDraggingArtifactId(null);
      if (transitionMutation.isPending) return;
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;
        const { artifactId, currentState } = JSON.parse(raw) as { artifactId: string; currentState: string };
        const art = artifacts.find((x) => x.id === artifactId);
        if (!art) return;
        if (!flowBoardStrategy.canDropOnColumn(bundle ?? null, transitionBundle, art, targetColumnKey, columnModel)) {
          showNotification("That transition is not allowed for this work item.", "error");
          return;
        }
        const colDef = columnModel.columns.find((c) => c.key === targetColumnKey);
        if (!colDef) return;
        const newState = flowBoardStrategy.resolveDropTargetState(bundle ?? null, art.artifact_type, colDef);
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
    [transitionMutation, showNotification, bundle, transitionBundle, artifacts, columnModel],
  );

  const transitionPending = transitionMutation.isPending;

  const boardContextSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${artifacts.length} shown`);
    if (typeFilterTrimmed) {
      parts.push(`Type: ${artifactTypeLabelMap.get(typeFilterTrimmed) ?? typeFilterTrimmed}`);
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
    typeFilterTrimmed,
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
                  type: typeFilterTrimmed || undefined,
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
                      options={boardSelectableArtifactTypes.map((at) => ({
                        value: at.id,
                        label: at.name ?? at.id,
                      }))}
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

          <p className="mb-4 text-sm text-muted-foreground">{boardContextSummary}</p>

          {manifestLoading || artifactsLoading ? (
            <Skeleton className="h-[400px] w-full rounded-lg" />
          ) : columnModel.columns.length === 0 ? (
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
              {columnModel.columns.length > 1 && (
                <p className="mb-2 block w-full min-w-0 text-xs text-muted-foreground">
                  Scroll horizontally to see all columns.
                </p>
              )}
              <div
                className="flex min-h-[400px] gap-2 overflow-x-auto pb-4"
                aria-label="Kanban board"
              >
              {columnModel.columns.map((col, colIndex) => {
                const colColor = COLUMN_COLORS[colIndex % COLUMN_COLORS.length];
                const colArtifacts = byState.get(col.key) ?? [];
                const { headline: columnHeadline, tooltip: columnTooltip } = flowColumnHeadline(col, stateDisplayMap);
                const colKey = col.key.length ? col.key : "__no_state__";
                const dropAllowed = columnDropAllowedMap?.get(col.key);
                const columnDimmed = draggingArtifactId != null && dropAllowed === false;
                return (
                  <div
                    key={colKey}
                    onDragOver={(e) => handleColumnDragOver(e, col.key)}
                    onDrop={(e) => handleDrop(e, col.key)}
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
