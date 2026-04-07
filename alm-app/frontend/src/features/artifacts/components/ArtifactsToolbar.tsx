/**
 * Toolbar for Backlog page: title, My tasks dropdown, search, view mode, collapsible filters.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Save,
  Table2,
  Network,
  FilterX,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import { FormProvider } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Checkbox as UICheckbox,
} from "../../../shared/components/ui";
import { RhfTextField, RhfSelect, RhfCheckbox } from "../../../shared/components/forms";
import { modalApi } from "../../../shared/modal";
import { downloadArtifactsCsv, getSystemRootArtifactTypes, getToolbarCreatableArtifactTypeIds } from "../utils";
import type { ManifestBundleForChildTypes } from "../utils";
import type { Artifact } from "../../../shared/stores/artifactStore";
import {
  buildArtifactListParams,
  downloadArtifactImportTemplate,
  exportArtifactsFile,
  importArtifactsFile,
  type ArtifactImportMode,
  type ArtifactImportResult,
  type ArtifactIoScope,
  type ArtifactSortBy,
  type ArtifactSortOrder,
} from "../../../shared/api/artifactApi";
import type { ArtifactListState } from "../../../shared/stores/artifactStore";
import type { Task } from "../../../shared/api/taskApi";
import { areaNodeDisplayLabel } from "../../../shared/api/planningApi";
import type { ProblemDetail } from "../../../shared/api/types";
import type { ManifestTreeRoot } from "../../../shared/lib/manifestTreeRoots";
import type { ListColumnSchema } from "../../../shared/types/listSchema";
import { artifactDetailPath, requirementsCoveragePath, requirementsTraceabilityPath } from "../../../shared/utils/appPaths";

export type ToolbarFilterValues = {
  searchInput: string;
  savedQueryId: string;
  releaseFilter: string;
  cycleFilter: string;
  areaNodeFilter: string;
  tagFilter: string;
  sortBy: ArtifactSortBy;
  sortOrder: ArtifactSortOrder;
  showDeleted: boolean;
  staleTraceabilityOnly: boolean;
};

type Cadence = { id: string; path?: string; name?: string };
type AreaNode = { id: string; path?: string; name?: string };
type SavedQuery = { id: string; name: string; visibility?: string };
type ProjectTagOption = { id: string; name: string };
/** Toolbar manifest row: explicit `id` + optional label (intersection with ManifestBundleForChildTypes left `id` optional). */
type BundleArtifactTypeRow = NonNullable<ManifestBundleForChildTypes["artifact_types"]>[number] & {
  id: string;
  name?: string;
};
type Bundle = Omit<ManifestBundleForChildTypes, "artifact_types"> & {
  artifact_types?: BundleArtifactTypeRow[];
  workflows?: unknown[];
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
  /** State filter dropdown: value is workflow state id sent to the API; label is manifest display text. */
  stateFilterOptions: { value: string; label: string }[];
  bundle: Bundle | undefined;
  treeRootOptions: ManifestTreeRoot[];
  releaseCadenceOptions: Cadence[];
  cycleNodesFlat: Cadence[];
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
  /** When set, CSV export uses these columns (order/labels) to match the list view. */
  listColumns?: ListColumnSchema[] | null;
  onCreateArtifact: (artifactTypeId: string) => void;
  listStateToFilterParams: (state: {
    stateFilter: string;
    typeFilter: string;
    treeFilter?: string;
    searchQuery: string;
    releaseFilter: string;
    cycleFilter: string;
    areaNodeFilter: string;
    tagFilter: string;
    sortBy: ArtifactSortBy;
    sortOrder: ArtifactSortOrder;
    staleTraceabilityOnly?: boolean;
  }) => Record<string, unknown>;
  showNotification: (message: string, severity?: "success" | "error" | "warning") => void;
  projectTagOptions?: ProjectTagOption[];
  onOpenTagsManager?: () => void;
  /**
   * Active backlog tree module (`tree_roots[].tree_id`). When null/undefined, toolbar does not offer
   * "New work item" (avoids creating under the wrong module or duplicating system roots).
   */
  workItemTreeId?: string | null;
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
  stateFilterOptions,
  bundle,
  treeRootOptions,
  releaseCadenceOptions,
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
  listColumns,
  onCreateArtifact,
  listStateToFilterParams,
  showNotification,
  projectTagOptions,
  onOpenTagsManager,
  workItemTreeId = null,
}: ArtifactsToolbarProps) {
  const { t } = useTranslation("quality");
  const [newWorkItemOpen, setNewWorkItemOpen] = useState(false);
  const [myTasksOpen, setMyTasksOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<ArtifactImportMode>("upsert");
  const [importValidateOnly, setImportValidateOnly] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ArtifactImportResult | null>(null);
  const [ioBusy, setIoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const artifactTypes: BundleArtifactTypeRow[] = (bundle?.artifact_types ?? []).filter(
    (at): at is BundleArtifactTypeRow => typeof at.id === "string" && at.id.length > 0,
  );
  const moduleRootType =
    workItemTreeId != null && String(workItemTreeId).trim() !== ""
      ? (treeRootOptions.find((o) => o.tree_id === workItemTreeId)?.root_artifact_type ?? "")
      : "";
  const systemRootsForToolbar = useMemo(() => getSystemRootArtifactTypes(bundle), [bundle]);
  const toolbarCreatableTypeIds = useMemo(() => {
    if (!moduleRootType || !bundle) return [] as string[];
    return getToolbarCreatableArtifactTypeIds(bundle, moduleRootType, systemRootsForToolbar);
  }, [bundle, moduleRootType, systemRootsForToolbar]);
  const creatableTypeIdSet = useMemo(() => new Set(toolbarCreatableTypeIds), [toolbarCreatableTypeIds]);
  const workItemArtifactTypes = useMemo(
    () =>
      artifactTypes.filter(
        (at) =>
          creatableTypeIdSet.has(at.id) &&
          !systemRootsForToolbar.has(at.id) &&
          !String(at.id).startsWith("root-"),
      ),
    [artifactTypes, creatableTypeIdSet, systemRootsForToolbar],
  );
  const canCreate =
    listResult?.allowed_actions?.includes("create") ??
    artifacts[0]?.allowed_actions?.includes("create") ??
    true;

  const {
    viewMode,
    stateFilter,
    typeFilter,
    treeFilter,
    releaseFilter,
    cycleFilter,
    areaNodeFilter,
    tagFilter,
    searchInput,
    sortBy,
    sortOrder,
  } = listState;

  const currentFilterParams = buildArtifactListParams({
    stateFilter,
    typeFilter,
    sortBy,
    sortOrder,
    searchQuery: searchInput,
    includeDeleted: listState.showDeleted,
    cycleId: cycleFilter || null,
    releaseId: releaseFilter || null,
    areaNodeId: areaNodeFilter || null,
    tree: treeFilter || null,
    tagId: tagFilter || null,
    staleTraceabilityOnly: listState.staleTraceabilityOnly,
  });

  async function handleExportAll(format: "csv" | "xlsx", scope: ArtifactIoScope) {
    if (!orgSlug || !project?.id) return;
    setIoBusy(true);
    try {
      await exportArtifactsFile(orgSlug, project.id, {
        ...currentFilterParams,
        format,
        scope,
      });
      showNotification(`Exported ${scope} as ${format.toUpperCase()}.`, "success");
    } catch (error) {
      const detail = (error as ProblemDetail | undefined)?.detail;
      showNotification(detail || "Export failed.", "error");
    } finally {
      setIoBusy(false);
    }
  }

  async function handleTemplateDownload(format: "csv" | "xlsx", scope: Exclude<ArtifactIoScope, "runs">) {
    if (!orgSlug || !project?.id) return;
    setIoBusy(true);
    try {
      await downloadArtifactImportTemplate(orgSlug, project.id, { format, scope });
      showNotification(`Downloaded ${scope} ${format.toUpperCase()} template.`, "success");
    } catch (error) {
      const detail = (error as ProblemDetail | undefined)?.detail;
      showNotification(detail || "Template download failed.", "error");
    } finally {
      setIoBusy(false);
    }
  }

  async function handleImportSubmit() {
    if (!orgSlug || !project?.id || !importFile) return;
    setIoBusy(true);
    try {
      const result = await importArtifactsFile(orgSlug, project.id, {
        file: importFile,
        scope: "generic",
        mode: importMode,
        validateOnly: importValidateOnly,
      });
      setImportResult(result);
      const failures = result.failed_count;
      const successes = result.created_count + result.updated_count + result.validated_count;
      showNotification(
        `${importValidateOnly ? "Validation" : "Import"} finished: ${successes} succeeded, ${failures} failed.`,
        failures > 0 ? "warning" : "success",
      );
      if (!importValidateOnly && failures === 0) {
        refetchArtifacts();
      }
    } catch (error) {
      const detail = (error as ProblemDetail | undefined)?.detail;
      showNotification(detail || "Import failed.", "error");
    } finally {
      setIoBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Backlog</h1>
          {orgSlug && projectSlug ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={requirementsCoveragePath(orgSlug, projectSlug)}>
                {t("requirementCoverage.breadcrumb")}
              </Link>
            </Button>
          ) : null}
          {orgSlug && projectSlug ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={requirementsTraceabilityPath(orgSlug, projectSlug)}>
                {t("traceabilityMatrix.breadcrumb")}
              </Link>
            </Button>
          ) : null}
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
                        to={artifactDetailPath(orgSlug, projectSlug, task.artifact_id)}
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
          <div className="hidden items-center gap-2 lg:flex">
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
              onClick={() => downloadArtifactsCsv(artifacts, members ?? [], listColumns)}
              disabled={artifacts.length === 0}
              aria-label="Export CSV"
              title="Export current page to CSV"
            >
              <Download className="mr-2 size-4" />
              Export CSV
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={ioBusy}>
                  <Download className="mr-2 size-4" />
                  Export All
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportAll("csv", "generic")}>Artifacts CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportAll("xlsx", "generic")}>Artifacts XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={ioBusy}>
                  Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleTemplateDownload("csv", "generic")}>
                  Artifact CSV template
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTemplateDownload("xlsx", "generic")}>
                  Artifact XLSX template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={ioBusy}>
              Import
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="More actions"
                title="More actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 lg:hidden">
              <DropdownMenuItem
                onClick={() => refetchArtifacts()}
                disabled={isLoading}
              >
                <RefreshCw className="mr-2 size-4" />
                Refresh list
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => downloadArtifactsCsv(artifacts, members ?? [], listColumns)}
                disabled={artifacts.length === 0}
              >
                <Download className="mr-2 size-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={ioBusy}>
                  <Download className="mr-2 size-4" />
                  Export all
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleExportAll("csv", "generic")}>Artifacts CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportAll("xlsx", "generic")}>Artifacts XLSX</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={ioBusy}>Templates</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleTemplateDownload("csv", "generic")}>
                    Artifact CSV template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTemplateDownload("xlsx", "generic")}>
                    Artifact XLSX template
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => setImportOpen(true)} disabled={ioBusy}>
                Import
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canCreate && workItemArtifactTypes.length > 0 &&
            (workItemArtifactTypes.length === 1 ? (
              <Button onClick={() => onCreateArtifact(workItemArtifactTypes[0]!.id)}>
                <Plus className="mr-2 size-4" />
                New {workItemArtifactTypes[0]!.name ?? workItemArtifactTypes[0]!.id}
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
                  {workItemArtifactTypes.map((at) => (
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
            inputProps={{ "aria-label": "Search backlog items" }}
          />
          <div
            className="flex rounded-md border border-border [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:border-l-0"
            role="group"
            aria-label="View mode"
          >
            <Button
              variant={viewMode === "tree" ? "default" : "ghost"}
              size="sm"
              onClick={() => setListState({ viewMode: "tree" })}
              className="rounded-none first:rounded-l-md"
              aria-label="Tree view"
            >
              <Network className="mr-1.5 size-4" />
              Tree
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setListState({ viewMode: "table" })}
              className="rounded-none last:rounded-r-md"
              aria-label="Tabular view"
            >
              <Table2 className="mr-1.5 size-4" />
              Tabular
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
                onValueChange={(v) => setListState({ treeFilter: v === "all" ? "" : v })}
              >
                <SelectTrigger size="sm" className="min-w-[140px]" aria-label="Tree filter">
                  <SelectValue placeholder="Tree" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trees</SelectItem>
                  {treeRootOptions.map((t) => (
                    <SelectItem key={t.tree_id} value={t.tree_id}>
                      {t.label}
                    </SelectItem>
                  ))}
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
                name="releaseFilter"
                control={toolbarForm.control}
                label="Release"
                options={[
                  { value: "", label: "All releases" },
                  ...releaseCadenceOptions.map((c) => ({ value: c.id, label: c.path || c.name })),
                ]}
                selectProps={{ size: "sm", className: "min-w-[160px]", "aria-label": "Release" }}
              />
              <RhfSelect<ToolbarFilterValues>
                name="cycleFilter"
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
              <RhfSelect<ToolbarFilterValues>
                name="tagFilter"
                control={toolbarForm.control}
                label="Tag"
                options={[
                  { value: "", label: "All tags" },
                  ...(projectTagOptions ?? []).map((t) => ({ value: t.id, label: t.name })),
                ]}
                selectProps={{ size: "sm", className: "min-w-[140px]", "aria-label": "Tag filter" }}
              />
              {onOpenTagsManager && (
                <Button type="button" size="sm" variant="outline" onClick={onOpenTagsManager}>
                  Manage tags
                </Button>
              )}
              <Select
                value={stateFilter || "__all__"}
                onValueChange={(v) => setListState({ stateFilter: v === "__all__" ? "" : v })}
              >
                <SelectTrigger size="sm" className="min-w-[130px]" aria-label="Filter by state">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All states</SelectItem>
                  {stateFilterOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
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
                  {artifactTypes.map((at) => (
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
                checkboxProps={{ size: "small", "aria-label": "Show deleted backlog items" }}
              />
              <RhfCheckbox<ToolbarFilterValues>
                name="staleTraceabilityOnly"
                control={toolbarForm.control}
                label={t("backlogFilters.staleTraceabilityOnly")}
                checkboxProps={{
                  size: "small",
                  "aria-label": t("backlogFilters.staleTraceabilityOnlyAria"),
                }}
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
                        releaseFilter,
                        cycleFilter,
                        areaNodeFilter,
                        tagFilter,
                        sortBy,
                        sortOrder,
                        staleTraceabilityOnly: listState.staleTraceabilityOnly,
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
              {(stateFilter ||
                typeFilter ||
                releaseFilter ||
                cycleFilter ||
                areaNodeFilter ||
                tagFilter ||
                searchInput ||
                listState.staleTraceabilityOnly) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setListState({
                      stateFilter: "",
                      typeFilter: "",
                      cycleFilter: "",
                      releaseFilter: "",
                      areaNodeFilter: "",
                      tagFilter: "",
                      searchInput: "",
                      staleTraceabilityOnly: false,
                    });
                    toolbarForm.reset({
                      ...toolbarForm.getValues(),
                      searchInput: "",
                      cycleFilter: "",
                      releaseFilter: "",
                      areaNodeFilter: "",
                      tagFilter: "",
                      staleTraceabilityOnly: false,
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
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import artifacts</DialogTitle>
            <DialogDescription className="sr-only">
              Upload an artifact import file, choose the mode, and review row-level validation results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="artifact-import-mode">Mode</Label>
                <Select value={importMode} onValueChange={(value) => setImportMode(value as ArtifactImportMode)}>
                  <SelectTrigger id="artifact-import-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="upsert">Upsert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2 text-sm">
                  <UICheckbox
                    id="artifact-import-validate-only"
                    checked={importValidateOnly}
                    onCheckedChange={(checked) => setImportValidateOnly(checked === true)}
                  />
                  <Label htmlFor="artifact-import-validate-only">Validate only</Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="artifact-import-file">File</Label>
              <input
                id="artifact-import-file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.zip"
                aria-label="Select import file"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setImportResult(null);
                }}
                className="block w-full text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Generic imports accept CSV or XLSX exports from the backlog module.
              </p>
            </div>
            {importResult ? (
              <div className="rounded-md border p-3">
                <div className="mb-2 text-sm font-medium">
                  Summary: created {importResult.created_count}, updated {importResult.updated_count}, validated{" "}
                  {importResult.validated_count}, failed {importResult.failed_count}
                </div>
                <div className="max-h-56 space-y-1 overflow-auto text-xs">
                  {importResult.rows.slice(0, 30).map((row, idx) => (
                    <div key={`${row.sheet}-${row.row_number}-${idx}`} className="rounded border px-2 py-1">
                      <span className="font-medium">
                        {row.sheet} row {row.row_number}
                      </span>{" "}
                      <span className="uppercase text-muted-foreground">{row.status}</span>
                      {row.artifact_key ? <span> {row.artifact_key}</span> : null}
                      {row.message ? <div className="text-muted-foreground">{row.message}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Close
            </Button>
            <Button onClick={() => void handleImportSubmit()} disabled={!importFile || ioBusy}>
              {ioBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {importValidateOnly ? "Validate file" : "Import file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { ArtifactsToolbar as BacklogToolbar };
export type { ArtifactsToolbarProps as BacklogToolbarProps };
