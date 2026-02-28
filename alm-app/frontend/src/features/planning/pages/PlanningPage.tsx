import { useParams, Link } from "react-router-dom";
import { Button, Tabs, TabsList, TabsTrigger, TabsContent, Dialog, DialogContent, DialogTitle, DialogFooter, Skeleton } from "../../../shared/components/ui";
import { GitBranch, ChevronDown, ChevronRight, Plus, Folder, Pencil, Trash2, List, Package, IterationCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
import {
  useCycleNodes,
  useAreaNodes,
  useCreateCycleNode,
  useCreateAreaNode,
  useUpdateCycleNode,
  useUpdateAreaNode,
  useDeleteCycleNode,
  useDeleteAreaNode,
  cycleNodeDisplayLabelWithKind,
  type CycleNode,
  type AreaNode,
} from "../../../shared/api/planningApi";
import { useArtifacts, useUpdateArtifact } from "../../../shared/api/artifactApi";
import { artifactDetailPath } from "../../../shared/utils/appPaths";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useArtifactStore } from "../../../shared/stores/artifactStore";

function CycleTreeItem({
  node,
  level,
  onRename,
  onDelete,
  onAddChild,
}: {
  node: CycleNode;
  level: number;
  onRename: (n: CycleNode) => void;
  onDelete: (n: CycleNode) => void;
  onAddChild: (n: CycleNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  return (
    <>
      <div
        className="flex items-center gap-1 py-1 pl-2"
        style={{ paddingLeft: 8 + level * 16 }}
      >
        <button
          type="button"
          className="flex min-w-[36px] items-center justify-center rounded p-1 hover:bg-muted"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )
          ) : (
            <span className="w-6" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{node.name}</p>
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                node.kind === "release" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
              title={node.kind === "release" ? "Release" : "Iteration"}
            >
              {node.kind === "release" ? <Package className="size-3" /> : <IterationCw className="size-3" />}
              {node.kind === "release" ? "Release" : "Iteration"}
            </span>
          </div>
          {node.path || node.state ? (
            <p className="text-xs text-muted-foreground">
              {node.path ? `${node.path} · ${node.state}` : node.state}
            </p>
          ) : null}
        </div>
        <div className="flex gap-0.5">
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            aria-label="Add iteration"
            onClick={() => onAddChild(node)}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            aria-label="Rename"
            onClick={() => onRename(node)}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted text-destructive"
            aria-label="Delete"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {hasChildren && open && (
        <div className="pl-0">
          {node.children!.map((child) => (
            <CycleTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onRename={onRename}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AreaTreeItem({
  node,
  level,
  onRename,
  onDelete,
  onAddChild,
}: {
  node: AreaNode;
  level: number;
  onRename: (n: AreaNode) => void;
  onDelete: (n: AreaNode) => void;
  onAddChild: (n: AreaNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  return (
    <>
      <div
        className="flex items-center gap-1 py-1 pl-2"
        style={{ paddingLeft: 8 + level * 16 }}
      >
        <button
          type="button"
          className="flex min-w-[36px] items-center justify-center rounded p-1 hover:bg-muted"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )
          ) : (
            <span className="w-6" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{node.name}</p>
          {node.path ? (
            <p className="text-xs text-muted-foreground">{node.path}</p>
          ) : null}
        </div>
        {!node.is_active && (
          <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>
        )}
        <div className="flex gap-0.5">
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            aria-label="Add child"
            onClick={() => onAddChild(node)}
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            aria-label="Rename"
            onClick={() => onRename(node)}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted text-destructive"
            aria-label="Delete"
            onClick={() => onDelete(node)}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {hasChildren && open && (
        <div className="pl-0">
          {node.children!.map((child) => (
            <AreaTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onRename={onRename}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </>
  );
}

function BacklogArtifactRow({
  artifact,
  orgSlug,
  projectId,
  projectSlug,
  cycleNodesFlat,
  showNotification,
}: {
  artifact: { id: string; artifact_key?: string | null; title?: string; state?: string; cycle_node_id?: string | null };
  orgSlug: string | undefined;
  projectId: string | undefined;
  projectSlug: string | undefined;
  cycleNodesFlat: Array<{ id: string; name: string; path?: string }>;
  showNotification: (message: string, severity: "success" | "error" | "info") => void;
}) {
  const updateArtifact = useUpdateArtifact(orgSlug, projectId, artifact.id);
  const currentCycleId = artifact.cycle_node_id ?? "";

  type RowCycleValues = { cycleId: string };
  const rowForm = useForm<RowCycleValues>({ defaultValues: { cycleId: currentCycleId } });
  const justResetRef = useRef(false);
  useEffect(() => {
    rowForm.reset({ cycleId: currentCycleId });
    justResetRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rowForm stable, reset only when currentCycleId changes
  }, [currentCycleId]);

  const watchedCycleId = rowForm.watch("cycleId");
  useEffect(() => {
    if (justResetRef.current) {
      justResetRef.current = false;
      return;
    }
    if (watchedCycleId !== currentCycleId) {
      updateArtifact.mutate(
        { cycle_node_id: watchedCycleId || null },
        {
          onSuccess: () => showNotification("Artifact assigned to cycle", "success"),
          onError: (err: Error) =>
            showNotification((err as { detail?: string })?.detail ?? err.message ?? "Failed to update artifact", "error"),
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when watchedCycleId changes; currentCycleId/showNotification/updateArtifact omitted
  }, [watchedCycleId]);

  return (
    <div className="flex items-center gap-2 py-1" onClick={(e) => e.stopPropagation()}>
      <div className="min-w-0 flex-1">
        <Link
          to={orgSlug && projectSlug ? artifactDetailPath(orgSlug, projectSlug, artifact.id) : "#"}
          className="font-medium text-foreground hover:underline"
        >
          {artifact.artifact_key ?? artifact.id} — {artifact.title || "(no title)"}
        </Link>
        {artifact.state ? (
          <p className="text-xs text-muted-foreground">{artifact.state}</p>
        ) : null}
      </div>
      <FormProvider {...rowForm}>
        <RhfSelect<RowCycleValues>
          name="cycleId"
          control={rowForm.control}
          label=""
          options={[
            { value: "", label: "Unassigned" },
            ...cycleNodesFlat.map((c) => ({ value: c.id, label: c.name })),
          ]}
          selectProps={{
            disabled: updateArtifact.isPending,
            className: "min-w-[160px] h-8 text-sm",
          }}
        />
      </FormProvider>
    </div>
  );
}

export default function PlanningPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const project =
    projects?.find((p) => p.slug === projectSlug) ??
    (currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined);

  const [activeTab, setActiveTab] = useState<"cycles" | "areas" | "backlog">("cycles");
  const backlogForm = useForm<{ releaseId: string; cycleId: string }>({ defaultValues: { releaseId: "", cycleId: "" } });
  const selectedBacklogReleaseId = backlogForm.watch("releaseId");
  const selectedBacklogCycleId = backlogForm.watch("cycleId");
  const effectiveBacklogFilter = selectedBacklogReleaseId || selectedBacklogCycleId;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<"cycles" | "areas">("cycles");
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameNode, setRenameNode] = useState<CycleNode | AreaNode | null>(null);

  const addForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const renameForm = useForm<{ name: string; kind?: "release" | "iteration" }>({ defaultValues: { name: "", kind: "iteration" } });
  const { reset: resetAddForm, handleSubmit: handleAddSubmit } = addForm;
  const { reset: resetRenameForm, handleSubmit: handleRenameSubmit } = renameForm;
  useEffect(() => {
    if (renameNode) {
      const isCycle = "goal" in renameNode;
      resetRenameForm({
        name: renameNode.name,
        ...(isCycle && { kind: (renameNode as CycleNode).kind }),
      });
    }
  }, [renameNode, resetRenameForm]);

  const { data: cycleNodes = [], isLoading: cyclesLoading } = useCycleNodes(
    orgSlug,
    project?.id,
    false,
  );
  const { data: cycleNodesFlatIterations = [] } = useCycleNodes(orgSlug, project?.id, true, "iteration");
  const { data: cycleNodesFlatReleases = [] } = useCycleNodes(orgSlug, project?.id, true, "release");
  const { data: areaNodes = [], isLoading: areasLoading } = useAreaNodes(
    orgSlug,
    project?.id,
    false,
  );
  const createCycle = useCreateCycleNode(orgSlug, project?.id);
  const createArea = useCreateAreaNode(orgSlug, project?.id);
  const updateCycle = useUpdateCycleNode(orgSlug, project?.id);
  const updateArea = useUpdateAreaNode(orgSlug, project?.id);
  const deleteCycle = useDeleteCycleNode(orgSlug, project?.id);
  const deleteArea = useDeleteAreaNode(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);
  const setListState = useArtifactStore((s) => s.setListState);
  const { data: backlogData } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "updated_at",
    "desc",
    undefined,
    25,
    0,
    false,
    activeTab === "backlog" && effectiveBacklogFilter && !selectedBacklogReleaseId ? selectedBacklogCycleId : undefined,
    activeTab === "backlog" && selectedBacklogReleaseId ? selectedBacklogReleaseId : undefined,
    undefined,
  );
  const backlogArtifacts = backlogData?.items ?? [];
  const backlogTotal = backlogData?.total ?? 0;

  const handleAddCycle = () => {
    setAddMode("cycles");
    setAddParentId(null);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };
  const handleAddChildCycle = (parent: CycleNode) => {
    setAddMode("cycles");
    setAddParentId(parent.id);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };
  const onSubmitAdd = (data: { name: string }) => {
    const name = data.name.trim();
    if (!name) return;
    if (addMode === "cycles") {
      const kind = addParentId ? "iteration" : "release";
      createCycle.mutate(
        { name, parent_id: addParentId || undefined, kind },
        {
          onSuccess: () => {
            setAddDialogOpen(false);
            showNotification(addParentId ? "Iteration added" : "Release added", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to add", "error"),
        },
      );
    } else {
      createArea.mutate(
        { name, parent_id: addParentId || undefined },
        {
          onSuccess: () => {
            setAddDialogOpen(false);
            showNotification("Area added", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to add area", "error"),
        },
      );
    }
  };

  const handleAddArea = () => {
    setAddMode("areas");
    setAddParentId(null);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };
  const handleAddChildArea = (parent: AreaNode) => {
    setAddMode("areas");
    setAddParentId(parent.id);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };

  const handleRenameCycle = (node: CycleNode) => {
    setRenameNode(node);
    setRenameDialogOpen(true);
  };
  const handleRenameArea = (node: AreaNode) => {
    setRenameNode(node);
    setRenameDialogOpen(true);
  };
  const onSubmitRename = (data: { name: string; kind?: "release" | "iteration" }) => {
    const name = data.name.trim();
    if (!name || !renameNode) return;
    if ("goal" in renameNode) {
      updateCycle.mutate(
        { cycleNodeId: renameNode.id, body: { name, ...(data.kind && { kind: data.kind }) } },
        {
          onSuccess: () => {
            setRenameDialogOpen(false);
            setRenameNode(null);
            showNotification("Cycle updated", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to update", "error"),
        },
      );
    } else {
      updateArea.mutate(
        { areaNodeId: renameNode.id, body: { name } },
        {
          onSuccess: () => {
            setRenameDialogOpen(false);
            setRenameNode(null);
            showNotification("Area updated", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to update", "error"),
        },
      );
    }
  };

  const handleDeleteCycle = (node: CycleNode) => {
    const isRelease = node.kind === "release";
    const message = isRelease
      ? `Delete release "${node.name}"? If it has iterations, delete those first.`
      : `Delete iteration "${node.name}"?`;
    if (!window.confirm(message)) return;
    deleteCycle.mutate(node.id, {
      onSuccess: () => showNotification(isRelease ? "Release deleted" : "Iteration deleted", "success"),
      onError: (e: Error) => showNotification(e?.message ?? "Failed to delete", "error"),
    });
  };
  const handleDeleteArea = (node: AreaNode) => {
    if (!window.confirm(`Delete area "${node.name}"?`)) return;
    deleteArea.mutate(node.id, {
      onSuccess: () => showNotification("Area deleted", "success"),
      onError: (e: Error) => showNotification(e?.message ?? "Failed to delete", "error"),
    });
  };

  return (
    <div className="mx-auto max-w-5xl py-6">
      <ProjectBreadcrumbs currentPageLabel="Planning" projectName={project?.name} />

      {projectSlug && orgSlug && !projectsLoading && !project ? (
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      ) : projectSlug && orgSlug && projectsLoading ? (
        <div className="text-muted-foreground">Loading project…</div>
      ) : (
        <>
          <div className="mb-1 flex items-center gap-2">
            <GitBranch className="size-6 text-primary" />
            <h1 className="text-2xl font-bold">Planning</h1>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Releases and iterations (cycles) and Areas for backlog and assignment.
          </p>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "cycles" | "areas" | "backlog")} className="mb-4 border-b">
            <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent p-0">
              <TabsTrigger value="cycles" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                <GitBranch className="size-4" />
                Releases & iterations{!cyclesLoading ? ` (${cycleNodes.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="areas" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                <Folder className="size-4" />
                Areas{!areasLoading ? ` (${areaNodes.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="backlog" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
                <List className="size-4" />
                Cycle backlog
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cycles" className="rounded-lg border p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <h2 className="text-lg font-semibold">Release & iteration tree</h2>
                </div>
                <Button size="sm" onClick={handleAddCycle} disabled={cyclesLoading}>
                  <Plus className="size-4" />
                  Add release
                </Button>
              </div>
              {cyclesLoading ? (
                <Skeleton className="h-28 rounded-md" />
              ) : cycleNodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No releases. Add a release, then add iterations (sprints) under it.
                </p>
              ) : (
                <div>
                  {cycleNodes.map((node) => (
                    <CycleTreeItem
                      key={node.id}
                      node={node}
                      level={0}
                      onRename={handleRenameCycle}
                      onDelete={handleDeleteCycle}
                      onAddChild={handleAddChildCycle}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="areas" className="rounded-lg border p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-secondary" />
                  <h2 className="text-lg font-semibold">Area tree</h2>
                </div>
                <Button size="sm" onClick={handleAddArea} disabled={areasLoading}>
                  <Plus className="size-4" />
                  Add area
                </Button>
              </div>
              {areasLoading ? (
                <Skeleton className="h-28 rounded-md" />
              ) : areaNodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No areas. Add an area path for assignment.
                </p>
              ) : (
                <div>
                  {areaNodes.map((node) => (
                    <AreaTreeItem
                      key={node.id}
                      node={node}
                      level={0}
                      onRename={handleRenameArea}
                      onDelete={handleDeleteArea}
                      onAddChild={handleAddChildArea}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="backlog" className="rounded-lg border p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-500" />
                <h2 className="text-lg font-semibold">Cycle backlog</h2>
              </div>
              <FormProvider {...backlogForm}>
                <div className="mb-4 flex flex-wrap gap-4">
                  <div className="min-w-[220px]">
                    <RhfSelect<{ releaseId: string; cycleId: string }>
                      name="releaseId"
                      control={backlogForm.control}
                      label="Release"
                      placeholder="All releases"
                      options={[{ value: "", label: "All releases" }, ...cycleNodesFlatReleases.map((c) => ({ value: c.id, label: cycleNodeDisplayLabelWithKind(c) }))]}
                    />
                  </div>
                  <div className="min-w-[220px]">
                    <RhfSelect<{ releaseId: string; cycleId: string }>
                      name="cycleId"
                      control={backlogForm.control}
                      label="Iteration"
                      placeholder="Select iteration"
                      options={[{ value: "", label: "All iterations" }, ...cycleNodesFlatIterations.map((c) => ({ value: c.id, label: cycleNodeDisplayLabelWithKind(c) }))]}
                    />
                  </div>
                </div>
              </FormProvider>
              {effectiveBacklogFilter ? (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {backlogTotal} artifact(s){selectedBacklogReleaseId ? " in this release" : " in this iteration"}
                    </p>
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        to={orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}/artifacts` : "#"}
                        onClick={() => setListState({ cycleNodeFilter: selectedBacklogCycleId || "", releaseCycleNodeFilter: selectedBacklogReleaseId || "" })}
                      >
                        View all in Artifacts
                      </Link>
                    </Button>
                  </div>
                  {backlogArtifacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No artifacts in this {selectedBacklogReleaseId ? "release" : "iteration"}.
                    </p>
                  ) : (
                    <div className="space-y-0">
                      {backlogArtifacts.map((a) => (
                        <BacklogArtifactRow
                          key={a.id}
                          artifact={a}
                          orgSlug={orgSlug}
                          projectId={project?.id}
                          projectSlug={projectSlug}
                          cycleNodesFlat={cycleNodesFlatIterations}
                          showNotification={showNotification}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a release or iteration to view its backlog.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogTitle>
            {addMode === "cycles"
              ? addParentId
                ? "Add iteration"
                : "Add release"
              : "Add area"}
          </DialogTitle>
          <FormProvider {...addForm}>
            <form onSubmit={handleAddSubmit(onSubmitAdd)} noValidate>
              <div className="grid gap-4 py-4">
                <RhfTextField<{ name: string }>
                  name="name"
                  label="Name"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- dialog first field
                  autoFocus
                />
                {addParentId && (
                  <p className="text-xs text-muted-foreground">
                    Will be created as child of selected node.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addMode === "cycles" ? createCycle.isPending : createArea.isPending}
                >
                  Add
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRenameDialogOpen(false);
            setRenameNode(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xs">
        <DialogTitle>Rename</DialogTitle>
        <FormProvider {...renameForm}>
          <form onSubmit={handleRenameSubmit(onSubmitRename)} noValidate>
            <div className="grid gap-4 py-4">
              <RhfTextField<{ name: string; kind?: "release" | "iteration" }>
                name="name"
                label="Name"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- dialog first field
                autoFocus
              />
              {renameNode && "goal" in renameNode && (
                <RhfSelect<{ name: string; kind?: "release" | "iteration" }>
                  name="kind"
                  control={renameForm.control}
                  label="Type"
                  options={[
                    { value: "release", label: "Release" },
                    { value: "iteration", label: "Iteration" },
                  ]}
                />
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRenameDialogOpen(false);
                  setRenameNode(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </FormProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}
