/**
 * Toolbar for Artifacts page: title, My tasks dropdown, search, view mode, collapsible filters.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemText,
  Select,
  Collapse,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { Add, Download, ExpandLess, ExpandMore, People, Refresh, Save, TableChart, ViewColumn, AccountTree, FilterListOff } from "@mui/icons-material";
import { FormProvider } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
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
  /** Called with the selected artifact type id from manifest (user does not choose type in form). */
  onCreateArtifact: (artifactTypeId: string) => void;
  listStateToFilterParams: (state: {
    stateFilter: string;
    typeFilter: string;
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
  myTasksMenuAnchor,
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
  const [newWorkItemMenuAnchor, setNewWorkItemMenuAnchor] = useState<null | HTMLElement>(null);
  const artifactTypes = bundle?.artifact_types ?? [];
  const canCreate = listResult?.allowed_actions?.includes("create") ?? artifacts[0]?.allowed_actions?.includes("create") ?? true;

  const {
    viewMode,
    stateFilter,
    typeFilter,
    cycleNodeFilter,
    areaNodeFilter,
    searchInput,
    searchQuery,
    sortBy,
    sortOrder,
  } = listState;

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
            Artifacts
          </Typography>
          {orgSlug && projectSlug && (
            <>
              <Button size="small" variant="outlined" onClick={(e) => setMyTasksMenuAnchor(e.currentTarget)} aria-haspopup="true" aria-expanded={!!myTasksMenuAnchor}>
                My tasks {myTasks.length > 0 ? `(${myTasks.length})` : ""}
              </Button>
              <Menu
                anchorEl={myTasksMenuAnchor}
                open={!!myTasksMenuAnchor}
                onClose={() => setMyTasksMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{ paper: { sx: { maxHeight: 320, minWidth: 220 } } }}
              >
                {myTasksLoading ? (
                  <MenuItem disabled>Loading…</MenuItem>
                ) : myTasks.length === 0 ? (
                  <MenuItem disabled>None assigned</MenuItem>
                ) : (
                  myTasks.map((task) => (
                    <MenuItem
                      key={task.id}
                      component={Link}
                      to={`/${orgSlug}/${projectSlug}/artifacts?artifact=${task.artifact_id}`}
                      onClick={() => setMyTasksMenuAnchor(null)}
                      sx={{ textDecoration: "none", color: "inherit" }}
                    >
                      <ListItemText primary={task.title} secondary={task.artifact_id} primaryTypographyProps={{ noWrap: true }} />
                    </MenuItem>
                  ))
                )}
              </Menu>
            </>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <IconButton onClick={() => refetchArtifacts()} disabled={isLoading} aria-label="Refresh list" title="Refresh list">
            {isRefetching ? <CircularProgress size={24} aria-hidden /> : <Refresh />}
          </IconButton>
          <Button
            variant="outlined"
            size="medium"
            startIcon={<Download />}
            onClick={() => downloadArtifactsCsv(artifacts, members ?? [])}
            disabled={artifacts.length === 0}
            aria-label="Export CSV"
            title="Export current page to CSV"
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<People />}
            onClick={() => project && orgSlug && modalApi.openProjectMembers({ orgSlug, projectId: project.id, projectName: project.name })}
            aria-label="Manage project members"
          >
            Members
          </Button>
          {canCreate && artifactTypes.length > 0 && (
            artifactTypes.length === 1 ? (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => onCreateArtifact(artifactTypes[0]!.id)}
              >
                New {artifactTypes[0]!.name ?? artifactTypes[0]!.id}
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={(e) => setNewWorkItemMenuAnchor(e.currentTarget)}
                  aria-haspopup="true"
                  aria-expanded={!!newWorkItemMenuAnchor}
                >
                  New work item
                </Button>
                <Menu
                  anchorEl={newWorkItemMenuAnchor}
                  open={!!newWorkItemMenuAnchor}
                  onClose={() => setNewWorkItemMenuAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                >
                  {artifactTypes.map((at) => (
                    <MenuItem
                      key={at.id}
                      onClick={() => {
                        onCreateArtifact(at.id);
                        setNewWorkItemMenuAnchor(null);
                      }}
                    >
                      <ListItemText primary={at.name ?? at.id} />
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )
          )}
        </Box>
      </Box>
      <FormProvider {...toolbarForm}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
          <RhfTextField<ToolbarFilterValues>
            name="searchInput"
            label=""
            placeholder="Search title, description, or key…"
            size="small"
            sx={{ minWidth: 220, flex: "1 1 200px" }}
            inputProps={{ "aria-label": "Search artifacts" }}
          />
          <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setListState({ viewMode: v })} size="small">
            <ToggleButton value="table" aria-label="Table view">
              <TableChart sx={{ mr: 0.5 }} />
              Table
            </ToggleButton>
            <ToggleButton value="board" aria-label="Board view">
              <ViewColumn sx={{ mr: 0.5 }} />
              Board
            </ToggleButton>
            <ToggleButton value="tree" aria-label="Tree view">
              <AccountTree sx={{ mr: 0.5 }} />
              Tree
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ mb: 3 }}>
          <Button size="small" startIcon={filtersPanelOpen ? <ExpandLess /> : <ExpandMore />} onClick={() => setFiltersPanelOpen((o) => !o)} aria-expanded={filtersPanelOpen} aria-controls="artifacts-filters-panel">
            Filters
          </Button>
          <Collapse in={filtersPanelOpen} id="artifacts-filters-panel">
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mt: 1.5, pl: 1 }}>
              <RhfSelect<ToolbarFilterValues>
                name="savedQueryId"
                control={toolbarForm.control}
                label="Saved query"
                options={[{ value: "", label: "Apply saved query…" }, ...savedQueries.map((q) => ({ value: q.id, label: `${q.name}${q.visibility === "private" ? " (private)" : ""}` }))]}
                selectProps={{ size: "small", sx: { minWidth: 160 }, displayEmpty: true }}
              />
              <RhfSelect<ToolbarFilterValues>
                name="cycleNodeFilter"
                control={toolbarForm.control}
                label="Cycle"
                options={[{ value: "", label: "All" }, ...cycleNodesFlat.map((c) => ({ value: c.id, label: c.path || c.name }))]}
                selectProps={{ size: "small", sx: { minWidth: 140 } }}
              />
              <RhfSelect<ToolbarFilterValues>
                name="areaNodeFilter"
                control={toolbarForm.control}
                label="Area"
                options={[{ value: "", label: "All" }, ...areaNodesFlat.map((a) => ({ value: a.id, label: areaNodeDisplayLabel({ name: a.name ?? a.id ?? "", path: a.path }) }))]}
                selectProps={{ size: "small", sx: { minWidth: 140 } }}
              />
              <Select
                size="small"
                value={stateFilter}
                onChange={(e) => setListState({ stateFilter: e.target.value })}
                displayEmpty
                sx={{ minWidth: 130 }}
                renderValue={(v) => v || "All states"}
                inputProps={{ "aria-label": "Filter by state" }}
              >
                <MenuItem value="">All states</MenuItem>
                {filterStates.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={typeFilter}
                onChange={(e) => setListState({ typeFilter: e.target.value })}
                displayEmpty
                sx={{ minWidth: 130 }}
                renderValue={(v) => v || "All types"}
                inputProps={{ "aria-label": "Filter by type" }}
              >
                <MenuItem value="">All types</MenuItem>
                {(bundle?.artifact_types ?? []).map((at) => (
                  <MenuItem key={at.id} value={at.id}>
                    {at.name ?? at.id}
                  </MenuItem>
                ))}
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
                selectProps={{ size: "small", sx: { minWidth: 130 } }}
              />
              <RhfSelect<ToolbarFilterValues>
                name="sortOrder"
                control={toolbarForm.control}
                label="Order"
                options={[
                  { value: "asc", label: "Asc" },
                  { value: "desc", label: "Desc" },
                ]}
                selectProps={{ size: "small", sx: { minWidth: 95 } }}
              />
              <RhfCheckbox<ToolbarFilterValues>
                name="showDeleted"
                control={toolbarForm.control}
                label="Show deleted"
                checkboxProps={{ size: "small", "aria-label": "Show deleted artifacts" }}
              />
              <Button
                size="small"
                startIcon={<Save />}
                onClick={() => {
                  modalApi.openSaveQuery({
                    initialName: "",
                    initialVisibility: "private",
                    onSave: (name, visibility) => {
                      if (!project?.id) return;
                      const filterParams = listStateToFilterParams({
                        stateFilter,
                        typeFilter,
                        searchQuery,
                        cycleNodeFilter,
                        areaNodeFilter,
                        sortBy,
                        sortOrder,
                      });
                      createSavedQueryMutation.mutate(
                        { name, filter_params: filterParams, visibility: visibility as "private" | "project" },
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
                Save filters
              </Button>
              {(stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchInput) && (
                <Button
                  size="small"
                  startIcon={<FilterListOff />}
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
                  Clear filters
                </Button>
              )}
            </Box>
          </Collapse>
        </Box>
      </FormProvider>
    </>
  );
}
