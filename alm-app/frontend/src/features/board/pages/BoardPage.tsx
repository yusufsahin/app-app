import { useParams, Link } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { useMemo, useCallback } from "react";
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
import { RhfSelect } from "../../../shared/components/forms";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useCadences, useAreaNodes, cadenceDisplayLabel, areaNodeDisplayLabel } from "../../../shared/api/planningApi";
import { useArtifacts, useTransitionArtifactById } from "../../../shared/api/artifactApi";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useRealtimeStore } from "../../../shared/stores/realtimeStore";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { artifactDetailPath, artifactsPath } from "../../../shared/utils/appPaths";
import { getWorkflowStatesForType, type ManifestBundleShape } from "../../../shared/lib/workflowManifest";

type WorkflowState = string;

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
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const project =
    projects?.find((p) => p.slug === projectSlug) ??
    (currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined);
  const { data: manifest, isLoading: manifestLoading } = useProjectManifest(orgSlug, project?.id);
  const { data: cycleCadences = [] } = useCadences(orgSlug, project?.id, true, "cycle");
  const { data: areaNodesFlat = [] } = useAreaNodes(orgSlug, project?.id, true);

  type BoardFilterValues = { typeFilter: string; releaseFilter: string; cycleFilter: string; areaFilter: string };
  const filterForm = useForm<BoardFilterValues>({
    defaultValues: { typeFilter: "", releaseFilter: "", cycleFilter: "", areaFilter: "" },
  });
  const { control } = filterForm;
  const typeFilter = useWatch({ control, name: "typeFilter" }) ?? "";
  const releaseFilter = useWatch({ control, name: "releaseFilter" }) ?? "";
  const cycleFilter = useWatch({ control, name: "cycleFilter" }) ?? "";
  const areaFilter = useWatch({ control, name: "areaFilter" }) ?? "";
  const { data: releaseCadences = [] } = useCadences(orgSlug, project?.id, true, "release");

  const { data: artifactsData, isLoading: artifactsLoading } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "updated_at",
    "asc",
    undefined,
    200,
    0,
    false,
    releaseFilter ? undefined : (cycleFilter || undefined),
    releaseFilter || undefined,
    areaFilter || undefined,
    undefined,
    true,
  );
  const transitionMutation = useTransitionArtifactById(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);
  const recentlyUpdatedArtifactIds = useRealtimeStore((s) => s.recentlyUpdatedArtifactIds);
  const presenceByArtifactId = useRealtimeStore((s) => s.presenceByArtifactId);

  const bundle = manifest?.manifest_bundle as ManifestBundleShape | undefined;
  const artifactTypes = useMemo(() => bundle?.artifact_types ?? [], [bundle]);
  const states = useMemo(
    () => getWorkflowStatesForType(bundle ?? null, typeFilter || null),
    [bundle, typeFilter],
  );
  const allArtifacts = useMemo(() => artifactsData?.items ?? [], [artifactsData?.items]);
  const artifacts = useMemo(() => {
    if (!typeFilter) return allArtifacts;
    return allArtifacts.filter((a) => a.artifact_type === typeFilter);
  }, [allArtifacts, typeFilter]);
  const byState = useMemo(() => {
    const map = new Map<WorkflowState, Artifact[]>();
    for (const s of states) map.set(s, []);
    for (const a of artifacts) {
      const list = map.get(a.state);
      if (list) list.push(a);
      else map.set(a.state, [a]);
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
    for (const s of states) {
      const list = map.get(s) ?? [];
      map.set(s, sortArtifacts(list));
    }
    return map;
  }, [states, artifacts]);

  const handleDragStart = useCallback((e: React.DragEvent, artifactId: string, currentState: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ artifactId, currentState }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetState: WorkflowState) => {
      e.preventDefault();
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;
        const { artifactId, currentState } = JSON.parse(raw) as { artifactId: string; currentState: string };
        if (targetState === currentState) return;
        transitionMutation.mutate(
          { artifactId, new_state: targetState },
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
    [transitionMutation, showNotification],
  );

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
                {artifactTypes.length > 0 && (
                  <div className="min-w-[180px]">
                    <RhfSelect<BoardFilterValues>
                      name="typeFilter"
                      control={control}
                      label="Artifact type"
                      placeholder="All"
                      options={[{ value: "", label: "All" }, ...artifactTypes.map((at) => ({ value: at.id, label: at.name ?? at.id }))]}
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
              </div>
            </FormProvider>
          </div>

          {manifestLoading || artifactsLoading ? (
            <Skeleton className="h-[400px] w-full rounded-lg" />
          ) : states.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-muted-foreground">
                No workflow states in manifest. Define workflows with states in Process manifest to use the board.
              </p>
              <Button asChild className="mt-4">
                <Link to={`/${orgSlug}/${projectSlug}/manifest`}>Open Manifest</Link>
              </Button>
            </div>
          ) : (
            <div
              className="flex min-h-[400px] gap-2 overflow-x-auto pb-4"
              aria-label="Kanban board"
            >
              {states.map((state, colIndex) => {
                const colColor = COLUMN_COLORS[colIndex % COLUMN_COLORS.length];
                const colArtifacts = byState.get(state) ?? [];
                return (
                  <div
                    key={state}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, state)}
                    className="flex min-h-[500px] min-w-[300px] max-w-[300px] shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: colColor }}
                        />
                        <span className="font-bold">{state}</span>
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
                          draggable
                          onDragStart={(e) => handleDragStart(e, a.id, a.state)}
                          className="cursor-grab transition shadow hover:shadow-md active:cursor-grabbing"
                        >
                          <CardContent className="px-4 py-3">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-primary">
                                {a.artifact_key ?? a.id.slice(0, 8)}
                              </span>
                              {a.artifact_type && (
                                <Badge variant={getTypeVariant(a.artifact_type)} className="text-[10px]">
                                  {a.artifact_type}
                                </Badge>
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
          )}
        </div>
      </DndProvider>
    </TooltipProvider>
  );
}
