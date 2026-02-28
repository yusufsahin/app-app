/**
 * Toolbar for Artifacts page: title, My tasks dropdown, search, view mode, collapsible filters.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Download,
  ChevronDown,
  ChevronUp,
  Users,
  RefreshCw,
  Save,
  Table2,
  LayoutGrid,
  Network,
  FilterX,
  Loader2,
} from "lucide-react";
import { FormProvider } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../shared/components/ui";
import { RhfTextField, RhfSelect, RhfCheckbox } from "../../../shared/components/forms";
import { modalApi } from "../../../shared/modal";
import { downloadArtifactsCsv } from "../utils";
import type { Artifact } from "../../../shared/stores/artifactStore";
import type { ArtifactSortBy, ArtifactSortOrder } from "../../../shared/api/artifactApi";
import type { ArtifactListState } from "../../../shared/stores/artifactStore";
import type { Task } from "../../../shared/api/taskApi";
import { areaNodeDisplayLabel } from "../../../shared/api/planningApi";
import type { ProblemDetail } from "../../../shared/api/types";

export type ToolbarFilterValues = {
  searchInput: string;
  savedQueryId: string;
  cycleNodeFilter: string;
  areaNodeFilter: string;
  sortBy: ArtifactSortBy;
  sortOrder: ArtifactSortOrder;
  showDeleted: boolean;
};

type CycleNode = { id: string; path?: string; name?: string };
type AreaNode = { id: string; path?: string; name?: string };
type SavedQuery = { id: string; name: string; visibility?: string };
type Bundle = {
  artifact_types?: Array<{ id: string; name?: string }>;
};
type Project = { id: string; name: string; slug: string };
type Member = { user_id: string; display_name?: string; email?: string };
type ListResult = { allowed_actions?: string[] };

export interface ArtifactsToolbarProps {
  orgSlug: string | undefined;
  projectSlug: string | undefined;
  project: Project | undefined;
  listState: ArtifactListState;
  setListState: (patch: Partial<ArtifactListState>) => void;
  toolbarForm: UseFormReturn<ToolbarFilterValues>;
  filtersPanelOpen: boolean;
  setFiltersPanelOpen: (fn: (prev: boolean) => boolean) => void;
  myTasksMenuAnchor: HTMLElement | null;
  setMyTasksMenuAnchor: (el: HTMLElement | null) => void;
  filterStates: string[];
  bundle: Bundle | undefined;
  cycleNodesFlat: CycleNode[];
  areaNodesFlat: AreaNode[];
  savedQueries: SavedQuery[];
  createSavedQueryMutation: {
    mutate: (
      args: { name: string; filter_params: Record<string, unknown>; visibility?: "private" | "project" },
      opts?: { onSuccess?: () => void; onError?: (err: unknown) => void },
    ) => void;
  };
  myTasks: Task[];
  myTasksLoading: boolean;
  refetchArtifacts: () => void;
  isLoading: boolean;
  isRefetching: boolean;
  artifacts: Artifact[];
  members: Member[] | undefined;
  listResult: ListResult | undefined;
  onCreateArtifact: (artifactTypeId: string) => void;
  listStateToFilterParams: (state: {
    stateFilter: string;
    typeFilter: string;
    treeFilter?: string;
    searchQuery: string;
    cycleNodeFilter: string;
    areaNodeFilter: string;
    sortBy: ArtifactSortBy;
    sortOrder: ArtifactSortOrder;
  }) => Record<string, unknown>;
  showNotification: (message: string, severity?: "success" | "error" | "warning") => void;
}

export function ArtifactsToolbar({
  orgSlug,
  projectSlug,
  project,
  listState,
  setListState,
  toolbarForm,
  filtersPanelOpen,
  setFiltersPanelOpen,
  myTasksMenuAnchor: _myTasksMenuAnchor,
  setMyTasksMenuAnchor,
  filterStates,
  bundle,
  cycleNodesFlat,
  areaNodesFlat,
  savedQueries,
  createSavedQueryMutation,
  myTasks,
  myTasksLoading,
  refetchArtifacts,
  isLoading,
  isRefetching,
  artifacts,
  members,
  listResult,
  onCreateArtifact,
  listStateToFilterParams,
  showNotification,
}: ArtifactsToolbarProps) {
  const [newWorkItemOpen, setNewWorkItemOpen] = useState(false);
  const [myTasksOpen, setMyTasksOpen] = useState(false);
  const artifactTypes = bundle?.artifact_types ?? [];
  const canCreate =
    listResult?.allowed_actions?.includes("create") ??
    artifacts[0]?.allowed_actions?.includes("create") ??
    true;

  const {
    viewMode,
    stateFilter,
    typeFilter,
    treeFilter,
    cycleNodeFilter,
    areaNodeFilter,
    searchInput,
    sortBy,
    sortOrder,
  } = listState;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Artifacts</h1>
          {orgSlug && projectSlug && (
            <DropdownMenu
              open={myTasksOpen}
              onOpenChange={(open) => {
                setMyTasksOpen(open);
                setMyTasksMenuAnchor(open ? document.body : null);
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-haspopup="true" aria-expanded={myTasksOpen}>
                  My tasks {myTasks.length > 0 ? `(${myTasks.length})` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 min-w-[220px]">
                {myTasksLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : myTasks.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">None assigned</div>
                ) : (
                  myTasks.map((task) => (
                    <DropdownMenuItem key={task.id} asChild>
                      <Link
                        to={`/${orgSlug}/${projectSlug}/artifacts?artifact=${task.artifact_id}`}
                        className="block w-full min-w-0 no-underline"
                        onClick={() => setMyTasksOpen(false)}
                      >
                        <span className="block truncate font-medium">{task.title}</span>
                        <span className="text-xs text-muted-foreground">{task.artifact_id}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => refetchArtifacts()}
            disabled={isLoading}
            aria-label="Refresh list"
            title="Refresh list"
          >
            {isRefetching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => downloadArtifactsCsv(artifacts, members ?? [])}
            disabled={artifacts.length === 0}
            aria-label="Export CSV"
            title="Export current page to CSV"
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              project &&
              orgSlug &&
              modalApi.openProjectMembers({ orgSlug, projectId: project.id, projectName: project.name })
            }
            aria-label="Manage project members"
          >
            <Users className="mr-2 size-4" />
            Members
          </Button>
          {canCreate && artifactTypes.length > 0 &&
            (artifactTypes.length === 1 ? (
              <Button onClick={() => onCreateArtifact(artifactTypes[0]!.id)}>
                <Plus className="mr-2 size-4" />
                New {artifactTypes[0]!.name ?? artifactTypes[0]!.id}
              </Button>
            ) : (
              <DropdownMenu open={newWorkItemOpen} onOpenChange={setNewWorkItemOpen}>
                <DropdownMenuTrigger asChild>
                  <Button aria-haspopup="true" aria-expanded={newWorkItemOpen}>
                    <Plus className="mr-2 size-4" />
                    New work item
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {artifactTypes.map((at) => (
                    <DropdownMenuItem
                      key={at.id}
                      onClick={() => {
                        onCreateArtifact(at.id);
                        setNewWorkItemOpen(false);
                      }}
                    >
                      {at.name ?? at.id}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
        </div>
      </div>

      <FormProvider {...toolbarForm}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <RhfTextField<ToolbarFilterValues>
            name="searchInput"
            label=""
            placeholder="Search title, description, or key…"
            size="small"
            sx={{ minWidth: 220, flex: "1 1 200px" }}
            inputProps={{ "aria-label": "Search artifacts" }}
          />
          <div
            className="flex rounded-md border border-border [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:border-l-0"
            role="group"
            aria-label="View mode"
          >
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setListState({ viewMode: "table" })}
              className="rounded-none first:rounded-l-md last:rounded-r-md"
              aria-label="Table view"
            >
              <Table2 className="mr-1.5 size-4" />
              Table
            </Button>
            <Button
              variant={viewMode === "board" ? "default" : "ghost"}
              size="sm"
              onClick={() => setListState({ viewMode: "board" })}
              className="rounded-none"
              aria-label="Board view"
            >
              <LayoutGrid className="mr-1.5 size-4" />
              Board
            </Button>
            <Button
              variant={viewMode === "tree" ? "default" : "ghost"}
              size="sm"
              onClick={() => setListState({ viewMode: "tree" })}
              className="rounded-none last:rounded-r-md"
              aria-label="Tree view"
            >
              <Network className="mr-1.5 size-4" />
              Tree
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFiltersPanelOpen((o) => !o)}
            aria-expanded={filtersPanelOpen}
            aria-controls="artifacts-filters-panel"
          >
            {filtersPanelOpen ? <ChevronUp className="mr-1 size-4" /> : <ChevronDown className="mr-1 size-4" />}
            Filters
          </Button>
          {filtersPanelOpen && (
            <div
              id="artifacts-filters-panel"
              className="mt-3 flex flex-wrap items-center gap-2 pl-1"
            >
              <Select
                value={treeFilter || "all"}
                onValueChange={(v) => setListState({ treeFilter: v === "all" ? "" : (v as "requirement" | "quality" | "defect") })}
              >
                <SelectTrigger size="sm" className="min-w-[140px]" aria-label="Tree filter">
                  <SelectValue placeholder="Tree" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trees</SelectItem>
                  <SelectItem value="requirement">Requirements</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="defect">Defects</SelectItem>
                </SelectContent>
              </Select>
              <RhfSelect<ToolbarFilterValues>
                name="savedQueryId"
                control={toolbarForm.control}
                label="Saved query"
                options={[
                  { value: "", label: "Apply saved query…" },
                  ...savedQueries.map((q) => ({
                    value: q.id,
                    label: `${q.name}${q.visibility === "private" ? " (private)" : ""}`,
                  })),
                ]}
                selectProps={{ size: "sm", className: "min-w-[160px]", displayEmpty: true, "aria-label": "Saved query" }}
              />
              <RhfSelect<ToolbarFilterValues>
                name="cycleNodeFilter"
                control={toolbarForm.control}
                label="Cycle"
                options={[
                  { value: "", label: "All" },
                  ...cycleNodesFlat.map((c) => ({ value: c.id, label: c.path || c.name })),
                ]}
                selectProps={{ size: "sm", className: "min-w-[140px]", "aria-label": "Cycle" }}
              />
              <RhfSelect<ToolbarFilterValues>
                name="areaNodeFilter"
                control={toolbarForm.control}
                label="Area"
                options={[
                  { value: "", label: "All" },
                  ...areaNodesFlat.map((a) => ({
                    value: a.id,
                    label: areaNodeDisplayLabel({ name: a.name ?? a.id ?? "", path: a.path }),
                  })),
                ]}
                selectProps={{ size: "sm", className: "min-w-[140px]", "aria-label": "Area" }}
              />
              <Select
                value={stateFilter || "__all__"}
                onValueChange={(v) => setListState({ stateFilter: v === "__all__" ? "" : v })}
              >
                <SelectTrigger size="sm" className="min-w-[130px]" aria-label="Filter by state">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All states</SelectItem>
                  {filterStates.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={typeFilter || "__all__"}
                onValueChange={(v) => setListState({ typeFilter: v === "__all__" ? "" : v })}
              >
                <SelectTrigger size="sm" className="min-w-[130px]" aria-label="Filter by type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  {(bundle?.artifact_types ?? []).map((at) => (
                    <SelectItem key={at.id} value={at.id}>
                      {at.name ?? at.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RhfSelect<ToolbarFilterValues>
                name="sortBy"
                control={toolbarForm.control}
                label="Sort by"
                options={[
                  { value: "artifact_key", label: "Key" },
                  { value: "title", label: "Title" },
                  { value: "state", label: "State" },
                  { value: "artifact_type", label: "Type" },
                  { value: "created_at", label: "Created" },
                  { value: "updated_at", label: "Updated" },
                ]}
                selectProps={{ size: "sm", sx: { minWidth: 130 }, "aria-label": "Sort by" }}
              />
              <RhfSelect<ToolbarFilterValues>
                name="sortOrder"
                control={toolbarForm.control}
                label="Order"
                options={[
                  { value: "asc", label: "Asc" },
                  { value: "desc", label: "Desc" },
                ]}
                selectProps={{ size: "sm", className: "min-w-[95px]", "aria-label": "Sort order" }}
              />
              <RhfCheckbox<ToolbarFilterValues>
                name="showDeleted"
                control={toolbarForm.control}
                label="Show deleted"
                checkboxProps={{ size: "small", "aria-label": "Show deleted artifacts" }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  modalApi.openSaveQuery({
                    initialName: "",
                    initialVisibility: "private",
                    onSave: (name, visibility) => {
                      if (!project?.id) return;
                      const filterParams = listStateToFilterParams({
                        stateFilter,
                        typeFilter,
                        treeFilter,
                        searchQuery: listState.searchQuery,
                        cycleNodeFilter,
                        areaNodeFilter,
                        sortBy,
                        sortOrder,
                      });
                      createSavedQueryMutation.mutate(
                        {
                          name,
                          filter_params: filterParams,
                          visibility: visibility as "private" | "project",
                        },
                        {
                          onSuccess: () => {
                            modalApi.closeModal();
                            showNotification("Saved query created", "success");
                          },
                          onError: (err: unknown) => {
                            const body = (err as { body?: ProblemDetail })?.body;
                            showNotification(body?.detail ?? "Failed to save query", "error");
                          },
                        },
                      );
                    },
                  });
                }}
                aria-label="Save current filters"
              >
                <Save className="mr-1.5 size-4" />
                Save filters
              </Button>
              {(stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchInput) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setListState({
                      stateFilter: "",
                      typeFilter: "",
                      cycleNodeFilter: "",
                      areaNodeFilter: "",
                      searchInput: "",
                    });
                    toolbarForm.reset({
                      ...toolbarForm.getValues(),
                      searchInput: "",
                      cycleNodeFilter: "",
                      areaNodeFilter: "",
                    });
                  }}
                  aria-label="Clear filters"
                >
                  <FilterX className="mr-1.5 size-4" />
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </FormProvider>
    </>
  );
}
