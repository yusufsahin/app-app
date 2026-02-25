import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  TablePagination,
  Paper,
  Chip,
  Skeleton,
  IconButton,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemText,
  Collapse,
  Drawer,
  Link as MuiLink,
  Divider,
  ListItemIcon,
  CircularProgress,
} from "@mui/material";
import {
  Add,
  MoreVert,
  BugReport,
  Assignment,
  TableChart,
  AccountTree,
  ExpandLess,
  ExpandMore,
  People,
  Close,
  ContentCopy,
  Delete,
  Download,
  Edit,
  FilterListOff,
  InsertDriveFile,
  Link as LinkIcon,
  Refresh,
  UploadFile,
  SwapHoriz,
  ViewColumn,
  CheckCircle,
  RadioButtonUnchecked,
  Save,
} from "@mui/icons-material";
import { useEffect, useMemo, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useQuery, useQueries } from "@tanstack/react-query";
import { apiClient } from "../../../shared/api/client";
import {
  useOrgProjects,
  useOrgMembers,
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMember,
} from "../../../shared/api/orgApi";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useFormSchema } from "../../../shared/api/formSchemaApi";
import type { ProblemDetail } from "../../../shared/api/types";
import type { FormFieldSchema, FormSchemaDto } from "../../../shared/types/formSchema";
import { MetadataDrivenForm, RhfCheckbox, RhfSelect, RhfTextField } from "../../../shared/components/forms";
import {
  useArtifacts,
  useArtifact,
  useCreateArtifact,
  usePermittedTransitions,
  useTransitionArtifact,
  useTransitionArtifactById,
  useUpdateArtifact,
  useDeleteArtifact,
  useBatchTransitionArtifacts,
  useBatchDeleteArtifacts,
  useRestoreArtifact,
  type Artifact,
  type ArtifactSortBy,
  type ArtifactSortOrder,
  type PermittedTransitionsResponse,
  type CreateArtifactRequest,
  type TransitionArtifactRequest,
  type UpdateArtifactRequest,
} from "../../../shared/api/artifactApi";
import {
  useTasksByArtifact,
  useMyTasksInProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type Task,
  type CreateTaskRequest,
} from "../../../shared/api/taskApi";
import { useCommentsByArtifact, useCreateComment } from "../../../shared/api/commentApi";
import {
  useArtifactLinks,
  useCreateArtifactLink,
  useDeleteArtifactLink,
  type ArtifactLink,
} from "../../../shared/api/artifactLinkApi";
import { useCycleNodes, useAreaNodes, areaNodeDisplayLabel } from "../../../shared/api/planningApi";
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  downloadAttachmentBlob,
  type Attachment as AttachmentType,
} from "../../../shared/api/attachmentApi";
import {
  useSavedQueries,
  useCreateSavedQuery,
  listStateToFilterParams,
  filterParamsToListStatePatch,
} from "../../../shared/api/savedQueryApi";
import { useListSchema } from "../../../shared/api/listSchemaApi";
import { MetadataDrivenList } from "../../../shared/components/lists/MetadataDrivenList";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { modalApi, useModalStore } from "../../../shared/modal";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useArtifactStore } from "../../../shared/stores/artifactStore";

const CORE_FIELD_KEYS = new Set(["artifact_type", "parent_id", "title", "description", "assignee_id"]);

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
  } catch {
    return "";
  }
}

/** Map artifact to cell value for list-schema columns (MetadataDrivenList). */
function getArtifactCellValue(row: Artifact, columnKey: string): string | number | undefined | null {
  if (columnKey === "created_at" || columnKey === "updated_at") {
    const raw = columnKey === "created_at" ? row.created_at : row.updated_at;
    return formatDateTime(raw ?? undefined) || null;
  }
  const knownKeys: (keyof Artifact)[] = ["artifact_key", "artifact_type", "title", "state", "state_reason", "resolution"];
  if (knownKeys.includes(columnKey as keyof Artifact)) {
    const val = row[columnKey as keyof Artifact];
    return val !== undefined && val !== null ? String(val) : null;
  }
  const val = row.custom_fields?.[columnKey];
  return val !== undefined && val !== null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : null;
}

function downloadArtifactsCsv(artifacts: Artifact[], members: { user_id: string; display_name?: string; email?: string }[] = []): void {
  const headers = ["Key", "Type", "Title", "Description", "State", "State reason", "Resolution", "Assignee", "Created", "Updated"];
  const rows = artifacts.map((a) => {
    const assignee = a.assignee_id
      ? members.find((m) => m.user_id === a.assignee_id)?.display_name ||
        members.find((m) => m.user_id === a.assignee_id)?.email ||
        a.assignee_id
      : "";
    return [
      escapeCsvCell(a.artifact_key ?? a.id),
      escapeCsvCell(a.artifact_type),
      escapeCsvCell(a.title),
      escapeCsvCell(a.description ?? ""),
      escapeCsvCell(a.state),
      escapeCsvCell(a.state_reason ?? ""),
      escapeCsvCell(a.resolution ?? ""),
      escapeCsvCell(assignee),
      escapeCsvCell(formatDateTime(a.created_at ?? undefined)),
      escapeCsvCell(formatDateTime(a.updated_at ?? undefined)),
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `artifacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function getArtifactIcon(type: string) {
  switch (type) {
    case "defect":
      return <BugReport fontSize="small" />;
    case "requirement":
      return <Assignment fontSize="small" />;
    default:
      return <Assignment fontSize="small" />;
  }
}

/** Derive valid transitions from manifest workflow */
function getValidTransitions(
  manifest: { manifest_bundle?: { workflows?: unknown[]; artifact_types?: Array<{ id: string; workflow_id?: string }> } } | null | undefined,
  artifactType: string,
  currentState: string,
): string[] {
  const bundle = manifest?.manifest_bundle;
  if (!bundle) return [];
  const workflows = (bundle.workflows ?? []) as Array<{ id: string; transitions?: Array<{ from: string; to: string }> }>;
  const artifactTypes = bundle.artifact_types ?? [];
  const at = artifactTypes.find((a) => a.id === artifactType);
  if (!at?.workflow_id) return [];
  const wf = workflows.find((w) => w.id === at.workflow_id);
  if (!wf?.transitions) return [];
  return wf.transitions
    .filter((t) => t.from === currentState)
    .map((t) => t.to);
}

export type ViewMode = "table" | "tree";

interface ArtifactNode extends Artifact {
  children: ArtifactNode[];
}

function buildArtifactTree(artifacts: Artifact[]): ArtifactNode[] {
  const byId = new Map<string, ArtifactNode>();
  for (const a of artifacts) {
    byId.set(a.id, { ...a, children: [] });
  }
  const roots: ArtifactNode[] = [];
  for (const a of artifacts) {
    const node = byId.get(a.id)!;
    if (!a.parent_id) {
      roots.push(node);
    } else {
      const parent = byId.get(a.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  return roots;
}

export default function ArtifactsPage() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const artifactIdFromUrl = searchParams.get("artifact");
  const qFromUrl = searchParams.get("q") ?? "";
  const typeFromUrl = searchParams.get("type") ?? "";
  const stateFromUrl = searchParams.get("state") ?? "";
  const cycleNodeIdFromUrl = searchParams.get("cycle_node_id") ?? "";
  const areaNodeIdFromUrl = searchParams.get("area_node_id") ?? "";
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const { data: listSchema } = useListSchema(orgSlug, project?.id, "artifact");
  const { data: formSchema, isError: formSchemaError, error: formSchemaErr } = useFormSchema(orgSlug, project?.id);
  const formSchema403 = formSchemaError && (formSchemaErr as unknown as ProblemDetail)?.status === 403;
  const { data: taskFormSchema } = useFormSchema(orgSlug, project?.id, "task", "create");
  const { data: editFormSchema } = useFormSchema(orgSlug, project?.id, "artifact", "edit");
  const { data: members } = useOrgMembers(orgSlug);
  useProjectMembers(orgSlug, project?.id);
  useAddProjectMember(orgSlug, project?.id);
  useRemoveProjectMember(orgSlug, project?.id);
  useUpdateProjectMember(orgSlug, project?.id);
  const listState = useArtifactStore((s) => s.listState);
  const setListState = useArtifactStore((s) => s.setListState);
  const setSelectedIds = useArtifactStore((s) => s.setSelectedIds);
  const toggleSelectedId = useArtifactStore((s) => s.toggleSelectedId);
  const clearSelection = useArtifactStore((s) => s.clearSelection);

  const {
    sortBy,
    sortOrder,
    stateFilter,
    typeFilter,
    cycleNodeFilter,
    areaNodeFilter,
    searchInput,
    searchQuery,
    page,
    pageSize,
    viewMode,
    showDeleted,
    selectedIds: selectedIdsList,
    detailArtifactId,
    createOpen: _createOpen,
    transitionArtifactId,
    transitionTargetState,
    transitionStateReason,
    transitionResolution,
    bulkTransitionOpen,
    bulkTransitionState,
    bulkTransitionTrigger,
    bulkTransitionStateReason,
    bulkTransitionResolution,
    bulkTransitionLastResult: _bulkTransitionLastResult,
    bulkDeleteConfirmOpen: _bulkDeleteConfirmOpen,
    deleteConfirmArtifactId: _deleteConfirmArtifactId,
    membersDialogOpen,
    detailDrawerEditing,
  } = listState;
  const selectedIds = useMemo(() => new Set(selectedIdsList), [selectedIdsList]);

  type ToolbarFilterValues = {
    searchInput: string;
    savedQueryId: string;
    cycleNodeFilter: string;
    areaNodeFilter: string;
    sortBy: ArtifactSortBy;
    sortOrder: ArtifactSortOrder;
    showDeleted: boolean;
  };
  const toolbarForm = useForm<ToolbarFilterValues>({
    defaultValues: {
      searchInput: searchInput,
      savedQueryId: "",
      cycleNodeFilter: cycleNodeFilter,
      areaNodeFilter: areaNodeFilter,
      sortBy,
      sortOrder,
      showDeleted,
    },
  });
  const toolbarValues = toolbarForm.watch();
  useEffect(() => {
    if (toolbarValues.savedQueryId) {
      const q = savedQueries.find((s) => s.id === toolbarValues.savedQueryId);
      if (q) {
        const patch = filterParamsToListStatePatch(q.filter_params);
        setListState(patch);
        toolbarForm.reset({ ...toolbarForm.getValues(), ...patch, savedQueryId: "" });
      } else {
        toolbarForm.setValue("savedQueryId", "");
      }
    } else {
      setListState({
        searchInput: toolbarValues.searchInput,
        cycleNodeFilter: toolbarValues.cycleNodeFilter,
        areaNodeFilter: toolbarValues.areaNodeFilter,
        sortBy: toolbarValues.sortBy,
        sortOrder: toolbarValues.sortOrder,
        showDeleted: toolbarValues.showDeleted,
      });
      // Keep URL ?q= in sync with toolbar search so header search stays aligned
      const currentQ = searchParams.get("q") ?? "";
      if (toolbarValues.searchInput !== currentQ) {
        setSearchParams(
          (prev) => {
            const p = new URLSearchParams(prev);
            if (toolbarValues.searchInput.trim()) p.set("q", toolbarValues.searchInput);
            else p.delete("q");
            return p;
          },
          { replace: true },
        );
      }
    }
  }, [
    toolbarValues.searchInput,
    toolbarValues.savedQueryId,
    toolbarValues.cycleNodeFilter,
    toolbarValues.areaNodeFilter,
    toolbarValues.sortBy,
    toolbarValues.sortOrder,
    toolbarValues.showDeleted,
    searchParams,
    setSearchParams,
  ]);

  // Sync header search (URL ?q=) into artifact list when on Artifacts page
  useEffect(() => {
    setListState({ searchInput: qFromUrl, searchQuery: qFromUrl });
    toolbarForm.setValue("searchInput", qFromUrl);
  }, [qFromUrl, setListState, toolbarForm]);

  useEffect(() => {
    setListState({
      stateFilter: stateFromUrl,
      typeFilter: typeFromUrl,
      cycleNodeFilter: cycleNodeIdFromUrl,
      areaNodeFilter: areaNodeIdFromUrl,
    });
  }, [stateFromUrl, typeFromUrl, cycleNodeIdFromUrl, areaNodeIdFromUrl, setListState]);
  useEffect(() => {
    toolbarForm.setValue("cycleNodeFilter", cycleNodeIdFromUrl);
    toolbarForm.setValue("areaNodeFilter", areaNodeIdFromUrl);
  }, [cycleNodeIdFromUrl, areaNodeIdFromUrl, toolbarForm]);
  useEffect(() => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (typeFilter) p.set("type", typeFilter);
      else p.delete("type");
      if (stateFilter) p.set("state", stateFilter);
      else p.delete("state");
      if (cycleNodeFilter) p.set("cycle_node_id", cycleNodeFilter);
      else p.delete("cycle_node_id");
      if (areaNodeFilter) p.set("area_node_id", areaNodeFilter);
      else p.delete("area_node_id");
      return p;
    });
  }, [typeFilter, stateFilter, cycleNodeFilter, areaNodeFilter, setSearchParams]);
  useEffect(() => {
    const t = setTimeout(() => setListState({ searchQuery: searchInput }), 350);
    return () => clearTimeout(t);
  }, [searchInput, setListState]);
  useEffect(() => {
    setListState({ page: 0 });
  }, [stateFilter, typeFilter, cycleNodeFilter, areaNodeFilter, searchQuery, setListState]);
  useEffect(() => {
    if (showDeleted) {
      setListState({ page: 0 });
      clearSelection();
    }
  }, [showDeleted, setListState, clearSelection]);
  const { data: cycleNodesFlat = [] } = useCycleNodes(orgSlug, project?.id, true);
  const { data: areaNodesFlat = [] } = useAreaNodes(orgSlug, project?.id, true);
  const { data: savedQueries = [] } = useSavedQueries(orgSlug, project?.id);
  const createSavedQueryMutation = useCreateSavedQuery(orgSlug, project?.id);
  const [_conflictDialogOpen, _setConflictDialogOpen] = useState(false);
  const [_conflictDetail, _setConflictDetail] = useState("");
  const isBoardView = viewMode === "board";
  const { data: listResult, isLoading, isRefetching, refetch: refetchArtifacts } = useArtifacts(
    orgSlug,
    project?.id,
    isBoardView ? undefined : (stateFilter || undefined),
    typeFilter || undefined,
    sortBy,
    sortOrder,
    searchQuery || undefined,
    isBoardView ? 200 : pageSize,
    isBoardView ? 0 : page * pageSize,
    showDeleted,
    cycleNodeFilter || undefined,
    areaNodeFilter || undefined,
  );
  const artifacts = useMemo(() => listResult?.items ?? [], [listResult?.items]);
  const totalArtifacts = listResult?.total ?? 0;
  const selectedArtifacts = useMemo(
    () => artifacts.filter((a) => selectedIds.has(a.id)),
    [artifacts, selectedIds],
  );
  const canBulkTransition = selectedArtifacts.some((a) => a.allowed_actions?.includes("transition"));
  const canBulkDelete = selectedArtifacts.some((a) => a.allowed_actions?.includes("delete"));
  const boardTransitionMutation = useTransitionArtifactById(orgSlug, project?.id);
  const detailOrUrlId = detailArtifactId || artifactIdFromUrl || undefined;
  const {
    data: artifactFromApi,
    isError: artifactFromUrlError,
    isFetching: artifactFromUrlFetching,
  } = useArtifact(orgSlug, project?.id, detailOrUrlId);
  const detailDrawerLoadingFromUrl = !!detailOrUrlId && artifactFromUrlFetching && !artifactFromApi;
  const detailArtifact = useMemo(() => {
    if (artifactFromApi) return artifactFromApi;
    return detailArtifactId ? (artifacts?.find((a) => a.id === detailArtifactId) ?? null) : null;
  }, [artifactFromApi, detailArtifactId, artifacts]);
  const createMutation = useCreateArtifact(orgSlug, project?.id);
  const deleteMutation = useDeleteArtifact(orgSlug, project?.id);
  const updateArtifactMutation = useUpdateArtifact(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );

  const [addTaskOpen, _setAddTaskOpen] = useState(false);
  const [, setTaskCreateFormValues] = useState<Record<string, unknown>>({});
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [, setTaskEditFormValues] = useState<Record<string, unknown>>({});
  const [editFormValues, setEditFormValues] = useState<Record<string, unknown>>({});
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  const { data: tasks = [], isLoading: tasksLoading } = useTasksByArtifact(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const createTaskMutation = useCreateTask(orgSlug, project?.id, detailArtifact?.id);
  const updateTaskMutation = useUpdateTask(
    orgSlug,
    project?.id,
    detailArtifact?.id,
    editingTask?.id,
  );
  const deleteTaskMutation = useDeleteTask(orgSlug, project?.id, detailArtifact?.id);

  const { data: myTasks = [], isLoading: myTasksLoading } = useMyTasksInProject(
    orgSlug,
    project?.id,
  );

  const { data: comments = [], isLoading: commentsLoading } = useCommentsByArtifact(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const createCommentMutation = useCreateComment(orgSlug, project?.id, detailArtifact?.id);
  type CommentFormValues = { body: string };
  const commentForm = useForm<CommentFormValues>({ defaultValues: { body: "" } });
  const commentBody = commentForm.watch("body");

  const { data: artifactLinks = [], isLoading: linksLoading } = useArtifactLinks(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const createLinkMutation = useCreateArtifactLink(orgSlug, project?.id, detailArtifact?.id);
  const deleteLinkMutation = useDeleteArtifactLink(orgSlug, project?.id, detailArtifact?.id);
  const { data: attachments = [], isLoading: attachmentsLoading } = useAttachments(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const uploadAttachmentMutation = useUploadAttachment(orgSlug, project?.id, detailArtifact?.id);
  const deleteAttachmentMutation = useDeleteAttachment(orgSlug, project?.id, detailArtifact?.id);
  const [addLinkOpen, _setAddLinkOpen] = useState(false);
  const [bulkErrorsExpanded, setBulkErrorsExpanded] = useState(true);
  type AddMemberFormValues = { user_id: string; role: string };
  const addMemberForm = useForm<AddMemberFormValues>({
    defaultValues: { user_id: "", role: "PROJECT_VIEWER" },
  });
  type AddLinkFormValues = { linkType: string; artifactId: string };
  const addLinkForm = useForm<AddLinkFormValues>({
    defaultValues: { linkType: "related", artifactId: "" },
  });
  useEffect(() => {
    if (membersDialogOpen) addMemberForm.reset({ user_id: "", role: "PROJECT_VIEWER" });
  }, [membersDialogOpen, addMemberForm]);
  useEffect(() => {
    if (addLinkOpen) addLinkForm.reset({ linkType: "related", artifactId: "" });
  }, [addLinkOpen, addLinkForm]);
  const { data: pickerArtifactsData } = useQuery({
    queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts", "linkPicker"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: Artifact[]; total: number }>(
        `/orgs/${orgSlug}/projects/${project?.id}/artifacts`,
        { params: { limit: 100, offset: 0 } },
      );
      return data;
    },
    enabled: addLinkOpen && !!orgSlug && !!project?.id,
  });
  const pickerArtifacts = pickerArtifactsData?.items ?? [];

  const [createFormValues, setCreateFormValues] = useState<Record<string, unknown>>({});
  const [createFormErrors, setCreateFormErrors] = useState<Record<string, string>>({});
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const transitionArtifact = useMemo(
    () => (transitionArtifactId ? artifacts?.find((a) => a.id === transitionArtifactId) ?? null : null),
    [transitionArtifactId, artifacts],
  );
  const transitionMutation = useTransitionArtifact(
    orgSlug,
    project?.id,
    transitionArtifact?.id,
  );
  const { data: permittedTransitions } = usePermittedTransitions(
    orgSlug,
    project?.id,
    transitionArtifact?.id,
  );
  const batchTransitionMutation = useBatchTransitionArtifacts(orgSlug, project?.id);
  const batchDeleteMutation = useBatchDeleteArtifacts(orgSlug, project?.id);
  const restoreMutation = useRestoreArtifact(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const toggleSelect = (id: string) => toggleSelectedId(id);
  const handleSelectAllInTable = (checked: boolean) => {
    const ids = artifacts?.map((a) => a.id) ?? [];
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    } else {
      const idSet = new Set(ids);
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    }
  };

  useEffect(() => {
    if (artifactIdFromUrl && artifactFromApi) {
      setListState({ detailArtifactId: artifactIdFromUrl });
    }
  }, [artifactIdFromUrl, artifactFromApi, setListState]);

  useEffect(() => {
    if (artifactIdFromUrl && artifactFromUrlError) {
      showNotification("Artifact not found", "error");
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.delete("artifact");
        return p;
      });
    }
  }, [artifactIdFromUrl, artifactFromUrlError, showNotification, setSearchParams]);

  const bundle = manifest?.manifest_bundle as {
    artifact_types?: Array<{
      id: string;
      name: string;
      workflow_id?: string;
      parent_types?: string[];
      fields?: Array<{ id: string; name: string }>;
    }>;
    workflows?: Array<{
      id: string;
      states?: string[];
      transitions?: Array<{ from: string; to: string }>;
      state_reason_options?: Array<{ id: string; label: string }>;
      resolution_options?: Array<{ id: string; label: string }>;
    }>;
  } | undefined;

  const transitionOptions = useMemo(() => {
    if (!transitionArtifact || !bundle?.workflows || !bundle?.artifact_types) {
      return { stateReasonOptions: [], resolutionOptions: [] };
    }
    const artifactType = bundle.artifact_types.find((at) => at.id === transitionArtifact.artifact_type);
    const workflowId = artifactType?.workflow_id ?? bundle.workflows[0]?.id;
    const workflow = bundle.workflows.find((w) => w.id === workflowId);
    return {
      stateReasonOptions: workflow?.state_reason_options ?? [],
      resolutionOptions: workflow?.resolution_options ?? [],
    };
  }, [transitionArtifact, bundle?.workflows, bundle?.artifact_types]);

  const showResolutionField =
    !!transitionTargetState &&
    ["resolved", "closed", "done"].includes(transitionTargetState.toLowerCase());

  const transitionFormSchema = useMemo((): FormSchemaDto | null => {
    const fields: FormFieldSchema[] = [];
    if (transitionOptions.stateReasonOptions.length > 0) {
      fields.push({
        key: "state_reason",
        type: "choice",
        label_key: "State reason",
        required: false,
        order: 1,
        options: transitionOptions.stateReasonOptions,
      });
    }
    if (showResolutionField && transitionOptions.resolutionOptions.length > 0) {
      fields.push({
        key: "resolution",
        type: "choice",
        label_key: "Resolution",
        required: true,
        order: 2,
        options: transitionOptions.resolutionOptions,
      });
    }
    if (fields.length === 0) return null;
    return { entity_type: "transition", context: "single", fields };
  }, [transitionOptions, showResolutionField]);

  const transitionFormValues = useMemo(
    () => ({ state_reason: transitionStateReason, resolution: transitionResolution }),
    [transitionStateReason, transitionResolution],
  );

  // Open transition artifact modal when state is set (e.g. from context menu or detail)
  useEffect(() => {
    if (!transitionArtifact || !transitionTargetState) return;
    const { modalType } = useModalStore.getState();
    if (modalType === "TransitionArtifactModal") return;
    const items = permittedTransitions?.items ?? [];
    modalApi.openTransitionArtifact(
      {
        artifact: {
          id: transitionArtifact.id,
          artifact_key: transitionArtifact.artifact_key ?? null,
          title: transitionArtifact.title,
        },
        targetState: transitionTargetState,
        permittedTransitions: items,
        onSelectTargetState: (state) => setListState({ transitionTargetState: state }),
        schema: transitionFormSchema,
        values: transitionFormValues,
        onChange: (v) =>
          setListState({
            transitionStateReason: (v.state_reason as string) ?? "",
            transitionResolution: (v.resolution as string) ?? "",
          }),
        onConfirm: handleConfirmTransition,
        isPending: transitionMutation.isPending,
        onCloseComplete: handleCloseTransitionDialog,
      },
      { title: `Transition to ${transitionTargetState}` },
    );
  }, [transitionArtifact?.id, transitionTargetState]); // eslint-disable-line react-hooks/exhaustive-deps -- only open when artifact/target change; handlers/state from closure

  // Sync transition artifact modal when form state or target state change
  useEffect(() => {
    if (!transitionArtifact || !transitionTargetState) return;
    const { modalType, updateModalProps } = useModalStore.getState();
    if (modalType !== "TransitionArtifactModal") return;
    updateModalProps({
      targetState: transitionTargetState,
      permittedTransitions: permittedTransitions?.items ?? [],
      schema: transitionFormSchema,
      values: transitionFormValues,
      isPending: transitionMutation.isPending,
    });
  }, [
    transitionArtifact?.id,
    transitionTargetState,
    transitionFormSchema,
    transitionFormValues,
    permittedTransitions?.items,
    transitionMutation.isPending,
  ]);

  const artifactTypeParentMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const at of bundle?.artifact_types ?? []) {
      if (at.parent_types?.length) map[at.id] = at.parent_types;
    }
    return map;
  }, [bundle?.artifact_types]);

  const filterStates = useMemo(() => {
    const states = new Set<string>();
    for (const wf of bundle?.workflows ?? []) {
      for (const s of wf.states ?? []) {
        if (typeof s === "string") states.add(s);
      }
    }
    return Array.from(states).sort((a, b) => a.localeCompare(b));
  }, [bundle?.workflows]);

  const bulkSelectedIds = useMemo(
    () => Array.from(selectedIds).slice(0, 30),
    [selectedIds],
  );
  const permittedResults = useQueries({
    queries: bulkSelectedIds.map((artifactId) => ({
      queryKey: [
        "orgs",
        orgSlug,
        "projects",
        project?.id,
        "artifacts",
        artifactId,
        "permitted-transitions",
      ],
      queryFn: async (): Promise<PermittedTransitionsResponse> => {
        const { data } = await apiClient.get<PermittedTransitionsResponse>(
          `/orgs/${orgSlug}/projects/${project?.id}/artifacts/${artifactId}/permitted-transitions`,
        );
        return data;
      },
      enabled:
        !!orgSlug &&
        !!project?.id &&
        !!artifactId &&
        bulkTransitionOpen &&
        bulkSelectedIds.length > 0,
    })),
  });
  const commonTriggers = useMemo(() => {
    if (permittedResults.length === 0) return [] as Array<{ trigger: string; to_state: string; label?: string | null }>;
    const success = permittedResults.filter((r) => r.isSuccess && r.data?.items?.length);
    if (success.length !== permittedResults.length) return [];
    const firstItems = success[0]?.data?.items;
    if (!firstItems?.length) return [];
    const triggerSet = new Set(firstItems.map((i) => i.trigger));
    for (let i = 1; i < success.length; i++) {
      const items = success[i]?.data?.items;
      if (!items) continue;
      const triggers = new Set(items.map((it) => it.trigger));
      for (const t of Array.from(triggerSet)) {
        if (!triggers.has(t)) triggerSet.delete(t);
      }
    }
    return firstItems.filter((i) => triggerSet.has(i.trigger));
  }, [permittedResults]);

  const bulkTransitionInvalidCount = useMemo(() => {
    if (!bulkTransitionState || !artifacts?.length || !manifest?.manifest_bundle) return 0;
    let count = 0;
    for (const id of selectedIds) {
      const a = artifacts.find((x) => x.id === id);
      if (!a) continue;
      const valid = getValidTransitions(manifest, a.artifact_type, a.state);
      if (!valid.includes(bulkTransitionState)) count += 1;
    }
    return count;
  }, [bulkTransitionState, artifacts, manifest, selectedIds]);

  const bulkTransitionOptions = useMemo(() => {
    if (!bundle?.workflows?.length) return { stateReasonOptions: [], resolutionOptions: [] };
    const w = bundle.workflows[0];
    return {
      stateReasonOptions: (w as { state_reason_options?: Array<{ id: string; label: string }> }).state_reason_options ?? [],
      resolutionOptions: (w as { resolution_options?: Array<{ id: string; label: string }> }).resolution_options ?? [],
    };
  }, [bundle?.workflows]);

  const bulkShowResolutionField =
    !!bulkTransitionState &&
    ["resolved", "closed", "done"].includes(bulkTransitionState.toLowerCase());

  const bulkTransitionForm = useMemo(() => {
    const fields: FormFieldSchema[] = [];
    if (bulkTransitionOptions.stateReasonOptions.length > 0) {
      fields.push({
        key: "state_reason",
        type: "choice",
        label_key: "State reason",
        required: false,
        order: 1,
        options: bulkTransitionOptions.stateReasonOptions,
      });
    }
    if (bulkShowResolutionField && bulkTransitionOptions.resolutionOptions.length > 0) {
      fields.push({
        key: "resolution",
        type: "choice",
        label_key: "Resolution",
        required: true,
        order: 2,
        options: bulkTransitionOptions.resolutionOptions,
      });
    }
    const schema: FormSchemaDto | null =
      fields.length === 0 ? null : { entity_type: "transition", context: "bulk", fields };
    const values = {
      state_reason: bulkTransitionStateReason,
      resolution: bulkTransitionResolution,
    };
    return { schema, values };
  }, [
    bulkTransitionOptions,
    bulkShowResolutionField,
    bulkTransitionStateReason,
    bulkTransitionResolution,
  ]);

  // When user selects a state in bulk transition modal, clear trigger (state and trigger are mutually exclusive)
  useEffect(() => {
    if (bulkTransitionState) setListState({ bulkTransitionTrigger: "" });
  }, [bulkTransitionState, setListState]);

  // Keep bulk transition modal props in sync with parent state
  useEffect(() => {
    if (!bulkTransitionOpen) return;
    const { modalType, updateModalProps } = useModalStore.getState();
    if (modalType !== "BulkTransitionModal") return;
    const transitionValues = {
      state: bulkTransitionState,
      state_reason: bulkTransitionStateReason,
      resolution: bulkTransitionResolution,
    };
    const confirmDisabled =
      (!bulkTransitionTrigger && !bulkTransitionState) ||
      (bulkShowResolutionField &&
        (bulkTransitionOptions?.resolutionOptions?.length ?? 0) > 0 &&
        !bulkTransitionResolution);
    updateModalProps({
      currentTrigger: bulkTransitionTrigger,
      transitionValues,
      invalidCount: bulkTransitionInvalidCount,
      confirmDisabled,
      errorsExpanded: bulkErrorsExpanded,
    });
  }, [
    bulkTransitionOpen,
    bulkTransitionTrigger,
    bulkTransitionState,
    bulkTransitionStateReason,
    bulkTransitionResolution,
    bulkTransitionInvalidCount,
    bulkErrorsExpanded,
    bulkShowResolutionField,
    bulkTransitionOptions?.resolutionOptions?.length,
  ]);

  const artifactsByState = useMemo(() => {
    if (!isBoardView || !filterStates.length) return {} as Record<string, Artifact[]>;
    const map: Record<string, Artifact[]> = {};
    for (const s of filterStates) map[s] = [];
    for (const a of artifacts) {
      const arr = map[a.state];
      if (arr) arr.push(a);
      else map[a.state] = [a];
    }
    return map;
  }, [isBoardView, artifacts, filterStates]);

  const customFieldColumns = useMemo(() => {
    const seen = new Set<string>();
    const cols: { key: string; label: string }[] = [];
    for (const at of bundle?.artifact_types ?? []) {
      for (const f of at.fields ?? []) {
        const id = f.id as string;
        if (id && !seen.has(id)) {
          seen.add(id);
          cols.push({ key: id, label: (f.name as string) || id });
        }
      }
    }
    return cols;
  }, [bundle?.artifact_types]);

  const initialFormValues = useMemo(() => {
    const vals: Record<string, unknown> = {};
    for (const f of formSchema?.fields ?? []) {
      vals[f.key] = f.default_value ?? (f.key === "parent_id" ? null : "");
    }
    return vals;
  }, [formSchema?.fields]);

  const TITLE_MAX_LENGTH = 500;

  const openCreateArtifactModal = (initialValues?: Record<string, unknown>) => {
    setCreateFormErrors({});
    const values = initialValues ?? createFormValues;
    modalApi.openCreateArtifact({
      formSchema: formSchema ?? null,
      formValues: values,
      formErrors: createFormErrors,
      onFormChange: (v) => {
        setCreateFormValues(v);
        setCreateFormErrors({});
      },
      onFormErrors: setCreateFormErrors,
      onCreate: () => handleCreate(),
      isPending: createMutation.isPending,
      parentArtifacts: artifacts?.map((a) => ({
        id: a.id,
        title: a.title,
        artifact_type: a.artifact_type,
      })) ?? [],
      userOptions: members?.map((m) => ({
        id: m.user_id,
        label: m.display_name || m.email || m.user_id,
      })) ?? [],
      artifactTypeParentMap,
      formSchemaError: !!formSchemaError,
      formSchema403: !!formSchema403,
    });
  };

  const handleCreateOpen = () => {
    openCreateArtifactModal(initialFormValues);
  };

  const handleDuplicate = (artifact: Artifact) => {
    const base = { ...initialFormValues };
    const duplicateValues: Record<string, unknown> = {
      ...base,
      artifact_type: artifact.artifact_type,
      title: `${(artifact.title || "").trim() || "Untitled"} (copy)`,
      description: artifact.description ?? "",
      assignee_id: artifact.assignee_id ?? null,
      parent_id: null,
    };
    for (const [key, val] of Object.entries(artifact.custom_fields ?? {})) {
      if (val !== undefined && val !== null) duplicateValues[key] = val;
    }
    openCreateArtifactModal(duplicateValues);
    handleMenuClose();
  };

  const taskCreateInitialValues = useMemo(() => {
    const vals: Record<string, unknown> = {};
    for (const f of taskFormSchema?.fields ?? []) {
      vals[f.key] = f.default_value ?? (f.key === "assignee_id" ? "" : "");
    }
    return vals;
  }, [taskFormSchema?.fields]);

  useEffect(() => {
    if (addTaskOpen && taskFormSchema) {
      setTaskCreateFormValues(taskCreateInitialValues);
    }
  }, [addTaskOpen, taskFormSchema, taskCreateInitialValues]);

  useEffect(() => {
    if (editingTask && taskFormSchema) {
      setTaskEditFormValues({
        title: editingTask.title,
        description: editingTask.description ?? "",
        state: editingTask.state,
        assignee_id: editingTask.assignee_id ?? "",
        rank_order: editingTask.rank_order ?? "",
      });
    }
  }, [editingTask, taskFormSchema]);

  const handleCreate = async () => {
    const title = (createFormValues.title as string)?.trim();
    const artifactType = (createFormValues.artifact_type as string)?.trim();
    const err: Record<string, string> = {};
    if (!title) err.title = "Title is required.";
    else if (title.length > TITLE_MAX_LENGTH) err.title = `Title must be at most ${TITLE_MAX_LENGTH} characters.`;
    if (!artifactType) err.artifact_type = "Type is required.";
    setCreateFormErrors(err);
    if (Object.keys(err).length > 0) return;
    const customFields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(createFormValues)) {
      if (!CORE_FIELD_KEYS.has(key) && val !== undefined && val !== "" && val !== null) {
        customFields[key] = val;
      }
    }
    const rawParent = (createFormValues.parent_id as string | null) ?? null;
    const rawAssignee = (createFormValues.assignee_id as string | null) ?? null;
    const payload: CreateArtifactRequest = {
      artifact_type: artifactType ?? "requirement",
      title,
      description: (createFormValues.description as string) ?? "",
      parent_id: rawParent && String(rawParent).trim() ? String(rawParent).trim() : null,
      assignee_id: rawAssignee && String(rawAssignee).trim() ? String(rawAssignee).trim() : null,
      custom_fields: Object.keys(customFields).length ? customFields : undefined,
    };
    try {
      await createMutation.mutateAsync(payload);
      modalApi.closeModal();
      setListState({ createOpen: false });
      setCreateFormValues({});
      setCreateFormErrors({});
      showNotification("Artifact created successfully");
    } catch {
      // Error handled by mutation
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, a: Artifact) => {
    setAnchorEl(e.currentTarget);
    setSelectedArtifact(a);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedArtifact(null);
  };

  const handleOpenTransitionDialog = (artifact: Artifact, targetState: string) => {
    setListState({
      transitionArtifactId: artifact.id,
      transitionTargetState: targetState,
    });
    setListState({ transitionStateReason: "", transitionResolution: "" });
    handleMenuClose();
  };
  const handleCloseTransitionDialog = () => {
    setListState({
      transitionArtifactId: null,
      transitionTargetState: null,
    });
    setListState({ transitionStateReason: "", transitionResolution: "" });
  };

  const handleConfirmTransition = async () => {
    if (!transitionArtifact || !transitionTargetState) return;
    const permitted = permittedTransitions?.items?.find((i) => i.to_state === transitionTargetState);
    const payload: TransitionArtifactRequest = {
      ...(permitted ? { trigger: permitted.trigger } : { new_state: transitionTargetState }),
      state_reason: transitionStateReason.trim() || undefined,
      resolution: transitionResolution.trim() || undefined,
      expected_updated_at: transitionArtifact.updated_at ?? undefined,
    };
    try {
      await transitionMutation.mutateAsync(payload);
      _setConflictDialogOpen(false);
      modalApi.closeModal();
      handleCloseTransitionDialog();
      showNotification("State updated successfully");
    } catch (err) {
      const problem = err as ProblemDetail & { status?: number };
      if (problem?.status === 409) {
        modalApi.openConflict({
          message: problem?.detail ?? "This artifact was updated by someone else.",
          onOverwrite: handleConflictOverwrite,
          onCancel: handleCloseTransitionDialog,
        });
      } else {
        showNotification(
          problem?.detail ?? "Transition failed. Please try again.",
          "error",
        );
      }
    }
  };

  const handleConflictOverwrite = () => {
    if (!transitionArtifact || !transitionTargetState) return;
    const permitted = permittedTransitions?.items?.find((i) => i.to_state === transitionTargetState);
    const payload: TransitionArtifactRequest = {
      ...(permitted ? { trigger: permitted.trigger } : { new_state: transitionTargetState }),
      state_reason: transitionStateReason.trim() || undefined,
      resolution: transitionResolution.trim() || undefined,
      expected_updated_at: undefined,
    };
    transitionMutation.mutate(payload, {
      onSuccess: () => {
        modalApi.closeModal();
        handleCloseTransitionDialog();
        showNotification("State updated successfully", "success");
      },
      onError: (err: Error) => {
        const problem = err as unknown as ProblemDetail & { status?: number };
        if (problem?.status === 409) {
          _setConflictDetail(problem?.detail ?? "Conflict persists. Refresh and try again.");
        } else {
          _setConflictDialogOpen(false);
          showNotification(problem?.detail ?? "Transition failed", "error");
        }
      },
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <ProjectBreadcrumbs currentPageLabel="Artifacts" projectName={project?.name} />

      {!project && projectSlug && orgSlug ? (
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      ) : (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
              mb: 3,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
                Artifacts
              </Typography>
              {orgSlug && projectSlug && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="body2" color="text.secondary">
                    My tasks:
                  </Typography>
                  {myTasksLoading ? (
                    <Typography variant="body2" color="text.secondary">
                      …
                    </Typography>
                  ) : myTasks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      None assigned
                    </Typography>
                  ) : (
                    myTasks.slice(0, 5).map((task) => (
                      <Chip
                        key={task.id}
                        size="small"
                        label={task.title}
                        component={Link}
                        to={`/${orgSlug}/${projectSlug}/artifacts?artifact=${task.artifact_id}`}
                        sx={{
                          maxWidth: 160,
                          textDecoration: "none",
                          "&:hover": { textDecoration: "none" },
                        }}
                        title={`Open artifact: ${task.artifact_id}`}
                      />
                    ))
                  )}
                  {myTasks.length > 5 && (
                    <Typography variant="body2" color="text.secondary">
                      +{myTasks.length - 5} more
                    </Typography>
                  )}
                </Box>
              )}
              <FormProvider {...toolbarForm}>
                <RhfTextField<ToolbarFilterValues>
                  name="searchInput"
                  label=""
                  placeholder="Search title, description, or key…"
                  size="small"
                  sx={{ minWidth: 200 }}
                  inputProps={{ "aria-label": "Search artifacts" }}
                />
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, v) => v && setListState({ viewMode: v })}
                  size="small"
                >
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
                <RhfSelect<ToolbarFilterValues>
                  name="savedQueryId"
                  control={toolbarForm.control}
                  label="Saved queries"
                  options={[
                    { value: "", label: "Apply a saved query…" },
                    ...savedQueries.map((q) => ({ value: q.id, label: `${q.name}${q.visibility === "private" ? " (private)" : ""}` })),
                  ]}
                  selectProps={{ size: "small", sx: { minWidth: 160 }, displayEmpty: true }}
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
                            onError: (err: Error) => {
                              const body = (err as unknown as { body?: ProblemDetail })?.body;
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
                  options={[{ value: "", label: "All" }, ...areaNodesFlat.map((a) => ({ value: a.id, label: areaNodeDisplayLabel(a) }))]}
                  selectProps={{ size: "small", sx: { minWidth: 140 } }}
                />
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
                  options={[{ value: "asc", label: "Asc" }, { value: "desc", label: "Desc" }]}
                  selectProps={{ size: "small", sx: { minWidth: 95 } }}
                />
                <RhfCheckbox<ToolbarFilterValues>
                  name="showDeleted"
                  control={toolbarForm.control}
                  label="Show deleted"
                  checkboxProps={{ size: "small", "aria-label": "Show deleted artifacts" }}
                />
              </FormProvider>
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
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <IconButton
                onClick={() => refetchArtifacts()}
                disabled={isLoading}
                aria-label="Refresh list"
                title="Refresh list"
              >
                {isRefetching ? (
                  <CircularProgress size={24} aria-hidden />
                ) : (
                  <Refresh />
                )}
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
                onClick={() =>
                  project &&
                  orgSlug &&
                  modalApi.openProjectMembers({
                    orgSlug,
                    projectId: project.id,
                    projectName: project.name,
                  })
                }
                aria-label="Manage project members"
              >
                Members
              </Button>
              {(listResult?.allowed_actions?.includes("create") ??
                artifacts[0]?.allowed_actions?.includes("create") ??
                true) && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleCreateOpen}
                >
                  New artifact
                </Button>
              )}
            </Box>
          </Box>

          {selectedIds.size > 0 && !showDeleted && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                py: 1.5,
                px: 2,
                mb: 2,
                bgcolor: "action.selected",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {selectedIds.size} selected
              </Typography>
              {canBulkTransition && (
                <Button
                  size="small"
                  startIcon={<SwapHoriz />}
                  onClick={() => {
                    setListState({
                      bulkTransitionOpen: true,
                      bulkTransitionLastResult: null,
                      bulkTransitionState: "",
                      bulkTransitionTrigger: "",
                      bulkTransitionStateReason: "",
                      bulkTransitionResolution: "",
                    });
                    const transitionValues = {
                      state: "",
                      state_reason: "",
                      resolution: "",
                    };
                    modalApi.openBulkTransition({
                      selectedCount: selectedIds.size,
                      commonTriggers,
                      currentTrigger: "",
                      onSelectTrigger: (t) =>
                        setListState({ bulkTransitionTrigger: t, bulkTransitionState: "" }),
                      stateOptions: filterStates.map((s) => ({ value: s, label: s })),
                      transitionSchema: bulkTransitionForm.schema,
                      transitionValues,
                      onTransitionFormChange: (v) =>
                        setListState({
                          bulkTransitionState: (v.state as string) ?? "",
                          bulkTransitionStateReason: (v.state_reason as string) ?? "",
                          bulkTransitionResolution: (v.resolution as string) ?? "",
                        }),
                      lastResult: null,
                      errorsExpanded: bulkErrorsExpanded,
                      onToggleErrors: () => setBulkErrorsExpanded((e) => !e),
                      onConfirm: (payload) => {
                        batchTransitionMutation.mutate(
                          {
                            artifact_ids: [...selectedIds],
                            ...(payload.trigger
                              ? { trigger: payload.trigger }
                              : { new_state: payload.state }),
                            state_reason: payload.state_reason || undefined,
                            resolution: payload.resolution || undefined,
                          },
                          {
                            onSuccess: (res) => {
                              if (res.error_count > 0) {
                                useModalStore.getState().updateModalProps({
                                  lastResult: {
                                    success_count: res.success_count,
                                    error_count: res.error_count,
                                    errors: res.errors,
                                    results: res.results,
                                  },
                                });
                                showNotification(
                                  `${res.success_count} transitioned, ${res.error_count} failed.`,
                                  "warning",
                                );
                              } else {
                                setListState({
                                  bulkTransitionOpen: false,
                                  bulkTransitionState: "",
                                  bulkTransitionTrigger: "",
                                  bulkTransitionStateReason: "",
                                  bulkTransitionResolution: "",
                                });
                                clearSelection();
                                if (detailArtifact && selectedIds.has(detailArtifact.id)) {
                                  setListState({ detailArtifactId: null });
                                  setSearchParams((prev) => {
                                    const p = new URLSearchParams(prev);
                                    p.delete("artifact");
                                    return p;
                                  });
                                }
                                modalApi.closeModal();
                                showNotification(`${res.success_count} transitioned.`, "success");
                              }
                            },
                            onError: () => {
                              showNotification("Bulk transition failed", "error");
                            },
                          },
                        );
                      },
                      isPending: batchTransitionMutation.isPending,
                      confirmDisabled: true,
                      invalidCount: bulkTransitionInvalidCount,
                      onCloseComplete: () => {
                        setListState({
                          bulkTransitionOpen: false,
                          bulkTransitionState: "",
                          bulkTransitionTrigger: "",
                          bulkTransitionStateReason: "",
                          bulkTransitionResolution: "",
                          bulkTransitionLastResult: null,
                        });
                        clearSelection();
                      },
                    });
                  }}
                  disabled={batchTransitionMutation.isPending}
                >
                  Transition
                </Button>
              )}
              {canBulkDelete && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => {
                  modalApi.openBulkDelete({
                    selectedIds: [...selectedIds],
                    onConfirm: () => {
                      batchDeleteMutation.mutate(
                        { artifact_ids: [...selectedIds] },
                        {
                          onSuccess: (res) => {
                            setListState({ bulkDeleteConfirmOpen: false });
                            clearSelection();
                            if (detailArtifact && selectedIds.has(detailArtifact.id)) {
                              setListState({ detailArtifactId: null });
                              setSearchParams((prev) => {
                                const p = new URLSearchParams(prev);
                                p.delete("artifact");
                                return p;
                              });
                            }
                            showNotification(
                              `${res.success_count} deleted${res.error_count > 0 ? `, ${res.error_count} failed` : ""}.`,
                              res.error_count > 0 ? "warning" : "success",
                            );
                          },
                          onError: () => {
                            showNotification("Bulk delete failed", "error");
                          },
                        },
                      );
                    },
                  });
                }}
                  disabled={batchDeleteMutation.isPending}
                >
                  Delete
                </Button>
              )}
              <Button size="small" onClick={clearSelection}>
                Clear selection
              </Button>
            </Box>
          )}

          {isLoading ? (
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
          ) : viewMode === "board" ? (
            <Box
              sx={{
                display: "flex",
                gap: 2,
                overflowX: "auto",
                pb: 2,
                minHeight: 400,
                opacity: isRefetching ? 0.8 : 1,
              }}
              aria-label="Kanban board"
            >
              {filterStates.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 4 }}>
                  No workflow states in manifest. Define workflows in Process manifest to use the board.
                </Typography>
              ) : (
              filterStates.map((state) => (
                <Paper
                  key={state}
                  variant="outlined"
                  sx={{
                    minWidth: 280,
                    maxWidth: 280,
                    display: "flex",
                    flexDirection: "column",
                    bgcolor: "action.hover",
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.setAttribute("data-drag-over", "true");
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.removeAttribute("data-drag-over");
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.removeAttribute("data-drag-over");
                    const artifactId = e.dataTransfer.getData("application/artifact-id");
                    if (!artifactId || state === e.dataTransfer.getData("application/artifact-state"))
                      return;
                    boardTransitionMutation.mutate(
                      { artifactId, new_state: state },
                      {
                        onSuccess: () => showNotification("State updated", "success"),
                        onError: (err: Error) =>
                          showNotification(err?.message ?? "Transition failed", "error"),
                      },
                    );
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}
                  >
                    {state.replace(/_/g, " ")}
                  </Typography>
                  <Box sx={{ flex: 1, p: 1, overflowY: "auto", minHeight: 120 }}>
                    {(artifactsByState[state] ?? []).map((a) => (
                      <Paper
                        key={a.id}
                        variant="outlined"
                        sx={{
                          p: 1,
                          mb: 1,
                          cursor: a.allowed_actions?.includes("transition") ? "grab" : "default",
                          "&:active": { cursor: a.allowed_actions?.includes("transition") ? "grabbing" : "default" },
                          "&:hover": { bgcolor: "action.selected" },
                        }}
                        draggable={a.allowed_actions?.includes("transition") ?? true}
                        onDragStart={(e) => {
                          if (!a.allowed_actions?.includes("transition")) {
                            e.preventDefault();
                            return;
                          }
                          e.dataTransfer.setData("application/artifact-id", a.id);
                          e.dataTransfer.setData("application/artifact-state", a.state);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => {
                          setListState({ detailArtifactId: a.id });
                          setSearchParams((prev) => {
                            const p = new URLSearchParams(prev);
                            p.set("artifact", a.id);
                            return p;
                          });
                        }}
                      >
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {a.artifact_key ?? a.id.slice(0, 8)} — {a.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {a.artifact_type}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Paper>
              ))
              )}
            </Box>
          ) : viewMode === "table" && listSchema ? (
            <Box sx={{ opacity: isRefetching ? 0.7 : 1, transition: "opacity 0.2s" }}>
              <MetadataDrivenList<Artifact>
                schema={listSchema}
                data={artifacts ?? []}
                getCellValue={getArtifactCellValue}
                getRowKey={(row) => row.id}
                filterValues={{ state: stateFilter, type: typeFilter }}
                onFilterChange={(key, value) => {
                  if (key === "state") setListState({ stateFilter: value });
                  else if (key === "type") setListState({ typeFilter: value });
                }}
                selectionColumn={!showDeleted}
                selectedKeys={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectAll={handleSelectAllInTable}
                renderRowActions={(row) => (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
                    {showDeleted && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreMutation.mutate(row.id, {
                            onSuccess: () => {
                              showNotification("Artifact restored", "success");
                              setListState({ showDeleted: false });
                            },
                            onError: () => showNotification("Restore failed", "error"),
                          });
                        }}
                        disabled={restoreMutation.isPending}
                      >
                        Restore
                      </Button>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuOpen(e, row);
                      }}
                      aria-label="Actions"
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>
                )}
                emptyMessage={
                  stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchQuery
                    ? "No artifacts match your filters."
                    : "No artifacts yet. Create one to get started."
                }
                onRowClick={(row) => {
                  setListState({ detailArtifactId: row.id });
                  setSearchParams((prev) => {
                    const p = new URLSearchParams(prev);
                    p.set("artifact", row.id);
                    return p;
                  });
                }}
              />
            </Box>
          ) : viewMode === "table" ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                List schema is loading or not available. Switch to Board or Tree view, or try again later.
              </Typography>
            </Paper>
          ) : (
            <Paper
              variant="outlined"
              sx={{ opacity: isRefetching ? 0.7 : 1, transition: "opacity 0.2s" }}
            >
              {artifacts?.length === 0 ? (
                <Box sx={{ py: 4, px: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  <Typography color="text.secondary">
                    {(stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchQuery)
                      ? "No artifacts match your filters."
                      : "No artifacts yet. Create one to get started."}
                  </Typography>
                  {(stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchQuery) && (
                    <Button
                      size="small"
                      startIcon={<FilterListOff />}
                      onClick={() =>
                        setListState({
                          stateFilter: "",
                          typeFilter: "",
                          searchInput: "",
                          page: 0,
                        })
                      }
                    >
                      Clear filters
                    </Button>
                  )}
                </Box>
              ) : (
                <List disablePadding>
                  {buildArtifactTree(artifacts ?? []).map((node) => (
                    <ArtifactTreeNode
                      key={node.id}
                      node={node}
                      manifest={manifest}
                      customFieldColumns={customFieldColumns}
                      onMenuOpen={handleMenuOpen}
                      onSelect={(a) => {
                        setListState({ detailArtifactId: a.id });
                        setSearchParams((prev) => {
                          const p = new URLSearchParams(prev);
                          p.set("artifact", a.id);
                          return p;
                        });
                      }}
                      expandedIds={expandedIds}
                      onToggleExpand={toggleExpand}
                      depth={0}
                      orgSlug={orgSlug}
                      projectId={project?.id}
                    />
                  ))}
                </List>
              )}
            </Paper>
          )}

          <TablePagination
            component="div"
            count={totalArtifacts}
            page={page}
            onPageChange={(_, newPage) => setListState({ page: newPage })}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) =>
              setListState({ pageSize: parseInt(e.target.value, 10), page: 0 })
            }
            rowsPerPageOptions={[10, 20, 50, 100]}
            labelRowsPerPage="Per page:"
            sx={{ borderTop: 1, borderColor: "divider" }}
          />

          <Menu
            anchorEl={anchorEl}
            open={!!anchorEl}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            {selectedArtifact &&
              selectedArtifact.allowed_actions?.includes("transition") &&
              getValidTransitions(
                manifest,
                selectedArtifact.artifact_type,
                selectedArtifact.state,
              ).map((targetState) => (
                <TransitionMenuItem
                  key={targetState}
                  artifact={selectedArtifact}
                  targetState={targetState}
                  onSelect={() => handleOpenTransitionDialog(selectedArtifact, targetState)}
                />
              ))}
            {selectedArtifact &&
              selectedArtifact.allowed_actions?.includes("transition") &&
              getValidTransitions(
                manifest,
                selectedArtifact.artifact_type,
                selectedArtifact.state,
              ).length === 0 && (
                <MenuItem disabled>No valid transitions</MenuItem>
              )}
            {selectedArtifact && (
              <>
                <Divider />
                {selectedArtifact.allowed_actions?.includes("create") && (
                  <MenuItem onClick={() => handleDuplicate(selectedArtifact)}>
                    <ListItemIcon>
                      <ContentCopy fontSize="small" />
                    </ListItemIcon>
                    Duplicate
                  </MenuItem>
                )}
                {selectedArtifact.allowed_actions?.includes("delete") && (
                  <MenuItem
                    onClick={() => {
                      if (!selectedArtifact) return;
                      modalApi.openDeleteArtifact({
                        artifact: {
                          id: selectedArtifact.id,
                          title: selectedArtifact.title,
                          artifact_key: selectedArtifact.artifact_key,
                        },
                        onConfirm: () => {
                          deleteMutation.mutate(selectedArtifact.id, {
                            onSuccess: () => {
                              if (detailArtifact?.id === selectedArtifact.id) {
                                setListState({ detailArtifactId: null });
                                setSearchParams((prev) => {
                                  const p = new URLSearchParams(prev);
                                  p.delete("artifact");
                                  return p;
                                });
                              }
                              showNotification("Artifact deleted successfully.", "success");
                            },
                            onError: (error: Error) => {
                              const body = (error as unknown as { body?: ProblemDetail })?.body;
                              showNotification(
                                body?.detail ?? "Failed to delete artifact",
                                "error",
                              );
                            },
                          });
                        },
                      });
                      handleMenuClose();
                    }}
                    sx={{ color: "error.main" }}
                  >
                    <ListItemIcon sx={{ color: "error.main" }}>
                      <Delete fontSize="small" />
                    </ListItemIcon>
                    Delete
                  </MenuItem>
                )}
              </>
            )}
          </Menu>
        </Box>
      )}

      <Drawer
        anchor="right"
        open={!!detailArtifact || detailDrawerLoadingFromUrl}
        onClose={() => {
          setListState({ detailArtifactId: null });
          setListState({ detailDrawerEditing: false });
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.delete("artifact");
            return p;
          });
        }}
        slotProps={{
          backdrop: { sx: { bgcolor: "rgba(0,0,0,0.2)" } },
          root: { "aria-label": "Artifact details" },
        }}
      >
        <Box sx={{ width: { xs: "100%", sm: 400 }, p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Artifact details</Typography>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {detailDrawerLoadingFromUrl && (
                <Typography variant="body2" color="text.secondary">
                  Loading…
                </Typography>
              )}
              {detailArtifact && !detailDrawerEditing && (
                <>
                  <Button
                    size="small"
                    startIcon={<LinkIcon />}
                    aria-label="Copy link to artifact"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?artifact=${detailArtifact.id}`;
                      void navigator.clipboard.writeText(url);
                      showNotification("Link copied to clipboard", "success");
                    }}
                  >
                    Copy link
                  </Button>
                  {detailArtifact.allowed_actions?.includes("update") && (
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      aria-label="Edit artifact"
                      onClick={() => {
                        setEditFormValues({
                          title: detailArtifact.title,
                          description: detailArtifact.description ?? "",
                          assignee_id: detailArtifact.assignee_id ?? "",
                          cycle_node_id: detailArtifact.cycle_node_id ?? "",
                          area_node_id: detailArtifact.area_node_id ?? "",
                        });
                        setEditFormErrors({});
                        setListState({ detailDrawerEditing: true });
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </>
              )}
              {!detailDrawerLoadingFromUrl && (
                <IconButton
                  size="small"
                  onClick={() => {
                    setListState({ detailArtifactId: null });
                    setListState({ detailDrawerEditing: false });
                    setSearchParams((prev) => {
                      const p = new URLSearchParams(prev);
                      p.delete("artifact");
                      return p;
                    });
                  }}
                  aria-label="Close"
                >
                  <Close />
                </IconButton>
              )}
            </Box>
          </Box>
          {detailDrawerLoadingFromUrl && (
            <Box sx={{ py: 2 }}>
              <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="90%" height={32} sx={{ mb: 2 }} />
              <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
            </Box>
          )}
          {detailArtifact && !detailDrawerLoadingFromUrl && (
            <>
              <Typography variant="overline" color="text.secondary" fontFamily="monospace">
                {detailArtifact.artifact_key ?? detailArtifact.id}
              </Typography>
              {detailDrawerEditing ? (
                <Box sx={{ mt: 1 }}>
                  {editFormSchema ? (
                    <MetadataDrivenForm
                      schema={editFormSchema}
                      values={editFormValues}
                      onChange={setEditFormValues}
                      onSubmit={() => {
                        const titleTrim = (editFormValues.title as string)?.trim();
                        if (!titleTrim) {
                          setEditFormErrors({ title: "Title is required." });
                          return;
                        }
                        if (titleTrim.length > TITLE_MAX_LENGTH) {
                          setEditFormErrors({ title: `Title must be at most ${TITLE_MAX_LENGTH} characters.` });
                          return;
                        }
                        setEditFormErrors({});
                        const payload: UpdateArtifactRequest = {
                          title: titleTrim,
                          description: (editFormValues.description as string) || null,
                          assignee_id: (editFormValues.assignee_id as string) || null,
                          cycle_node_id: (editFormValues.cycle_node_id as string) || null,
                          area_node_id: (editFormValues.area_node_id as string) || null,
                        };
                        updateArtifactMutation.mutate(payload, {
                          onSuccess: (data) => {
                            setListState({ detailArtifactId: data.id, detailDrawerEditing: false });
                            showNotification("Artifact updated successfully.", "success");
                          },
                          onError: (error: Error) => {
                            const body = (error as unknown as { body?: ProblemDetail })?.body;
                            showNotification(
                              body?.detail ?? "Failed to update artifact",
                              "error",
                            );
                          },
                        });
                      }}
                      submitLabel="Save"
                      disabled={updateArtifactMutation.isPending}
                      submitExternally
                      errors={editFormErrors}
                      userOptions={members?.map((m) => ({ id: m.user_id, label: m.display_name || m.email || m.user_id })) ?? []}
                      cycleOptions={cycleNodesFlat.map((c) => ({ id: c.id, label: c.path || c.name }))}
                      areaOptions={areaNodesFlat.map((a) => ({ id: a.id, label: areaNodeDisplayLabel(a) }))}
                    />
                  ) : (
                    <Typography color="text.secondary">Loading form…</Typography>
                  )}
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
                    <Button
                      onClick={() => setListState({ detailDrawerEditing: false })}
                      disabled={updateArtifactMutation.isPending}
                    >
                      Cancel
                    </Button>
                    {editFormSchema && (
                      <Button
                        variant="contained"
                        disabled={updateArtifactMutation.isPending || !(editFormValues.title as string)?.trim()}
                        onClick={() => {
                          const titleTrim = (editFormValues.title as string)?.trim();
                          if (!titleTrim) {
                            setEditFormErrors({ title: "Title is required." });
                            return;
                          }
                          if (titleTrim.length > TITLE_MAX_LENGTH) {
                            setEditFormErrors({ title: `Title must be at most ${TITLE_MAX_LENGTH} characters.` });
                            return;
                          }
                          setEditFormErrors({});
                          const payload: UpdateArtifactRequest = {
                            title: titleTrim,
                            description: (editFormValues.description as string) || null,
                            assignee_id: (editFormValues.assignee_id as string) || null,
                            cycle_node_id: (editFormValues.cycle_node_id as string) || null,
                            area_node_id: (editFormValues.area_node_id as string) || null,
                          };
                          updateArtifactMutation.mutate(payload, {
                            onSuccess: (data) => {
                              setListState({ detailArtifactId: data.id, detailDrawerEditing: false });
                              showNotification("Artifact updated successfully.", "success");
                            },
                            onError: (error: Error) => {
                              const body = (error as unknown as { body?: ProblemDetail })?.body;
                              showNotification(
                                body?.detail ?? "Failed to update artifact",
                                "error",
                              );
                            },
                          });
                        }}
                      >
                        Save
                      </Button>
                    )}
                  </Box>
                </Box>
              ) : (
                <>
                  <Typography variant="h6" sx={{ mt: 0.5, mb: 1 }}>
                    {detailArtifact.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Type: {detailArtifact.artifact_type} · State: {detailArtifact.state}
                  </Typography>
                  {detailArtifact.description && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {detailArtifact.description}
                    </Typography>
                  )}
                </>
              )}
              {!detailDrawerEditing && detailArtifact.state_reason && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>State reason:</strong> {detailArtifact.state_reason}
                </Typography>
              )}
              {!detailDrawerEditing && detailArtifact.resolution && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Resolution:</strong> {detailArtifact.resolution}
                </Typography>
              )}
              {!detailDrawerEditing && (detailArtifact.created_at || detailArtifact.updated_at) && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {detailArtifact.created_at && <>Created: {formatDateTime(detailArtifact.created_at)}</>}
                  {detailArtifact.created_at && detailArtifact.updated_at && " · "}
                  {detailArtifact.updated_at && <>Updated: {formatDateTime(detailArtifact.updated_at)}</>}
                </Typography>
              )}
              {!detailDrawerEditing && detailArtifact.assignee_id && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  <strong>Assignee:</strong>{" "}
                  {members?.find((m) => m.user_id === detailArtifact.assignee_id)?.display_name ||
                    members?.find((m) => m.user_id === detailArtifact.assignee_id)?.email ||
                    detailArtifact.assignee_id}
                </Typography>
              )}
              {!detailDrawerEditing && (detailArtifact.cycle_node_id || detailArtifact.area_node_id) && (
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {detailArtifact.cycle_node_id && (
                    <>
                      <strong>Cycle:</strong>{" "}
                      {cycleNodesFlat.find((c) => c.id === detailArtifact.cycle_node_id)?.path ||
                        cycleNodesFlat.find((c) => c.id === detailArtifact.cycle_node_id)?.name ||
                        detailArtifact.cycle_node_id}
                    </>
                  )}
                  {detailArtifact.cycle_node_id && detailArtifact.area_node_id && " · "}
                  {detailArtifact.area_node_id && (
                    <>
                      <strong>Area:</strong>{" "}
                      {(() => {
                        const a = areaNodesFlat.find((n) => n.id === detailArtifact.area_node_id);
                        return a ? areaNodeDisplayLabel(a) : detailArtifact.area_node_id;
                      })()}
                    </>
                  )}
                </Typography>
              )}
              {!detailDrawerEditing && detailArtifact.custom_fields &&
                Object.keys(detailArtifact.custom_fields).length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Custom fields
                    </Typography>
                    {Object.entries(detailArtifact.custom_fields).map(([key, val]) => (
                      <Typography key={key} variant="body2">
                        {key}: {String(val)}
                      </Typography>
                    ))}
                  </Box>
                )}
              {!detailDrawerEditing &&
                detailArtifact.allowed_actions?.includes("transition") &&
                getValidTransitions(
                  manifest,
                  detailArtifact.artifact_type,
                  detailArtifact.state,
                ).length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Change state
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {getValidTransitions(
                      manifest,
                      detailArtifact.artifact_type,
                      detailArtifact.state,
                    ).map((targetState) => (
                      <Button
                        key={targetState}
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          handleOpenTransitionDialog(detailArtifact, targetState);
                          setListState({ detailArtifactId: null });
                          setSearchParams((prev) => {
                            const p = new URLSearchParams(prev);
                            p.delete("artifact");
                            return p;
                          });
                        }}
                      >
                        Move to {targetState}
                      </Button>
                    ))}
                  </Box>
                </Box>
              )}
              {!detailDrawerEditing && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Linked tasks
                  </Typography>
                  {tasksLoading ? (
                    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                  ) : (
                    <>
                      <List dense disablePadding>
                        {tasks.map((task) => (
                          <ListItem
                            key={task.id}
                            secondaryAction={
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  aria-label="Edit task"
                                  onClick={() => {
                                    const editValues = {
                                      title: task.title,
                                      description: task.description ?? "",
                                      state: task.state,
                                      assignee_id: task.assignee_id ?? "",
                                      rank_order: task.rank_order ?? "",
                                    };
                                    modalApi.openEditTask({
                                      taskFormSchema: taskFormSchema ?? null,
                                      task,
                                      values: editValues,
                                      onChange: setTaskEditFormValues,
                                      onSubmit: (values) => {
                                        const title = (values.title as string)?.trim();
                                        if (!title) return;
                                        updateTaskMutation.mutate(
                                          {
                                            title,
                                            description: (values.description as string) ?? null,
                                            state: (values.state as string) ?? undefined,
                                            assignee_id: (values.assignee_id as string) || null,
                                            rank_order: typeof values.rank_order === "number" ? values.rank_order : undefined,
                                          },
                                          {
                                            onSuccess: () => {
                                              modalApi.closeModal();
                                              setEditingTask(null);
                                              showNotification("Task updated", "success");
                                            },
                                            onError: (err: Error) => {
                                              const body = (err as unknown as { body?: ProblemDetail })?.body;
                                              showNotification(body?.detail ?? "Failed to update task", "error");
                                            },
                                          },
                                        );
                                      },
                                      isPending: updateTaskMutation.isPending,
                                      userOptions: members?.map((m) => ({
                                        id: m.user_id,
                                        label: m.display_name || m.email || m.user_id,
                                      })) ?? [],
                                    });
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="Delete task"
                                  onClick={() => {
                                    if (window.confirm("Delete this task?")) {
                                      deleteTaskMutation.mutate(task.id, {
                                        onError: (err: Error) => {
                                          const body = (err as unknown as { body?: ProblemDetail })?.body;
                                          showNotification(
                                            body?.detail ?? "Failed to delete task",
                                            "error",
                                          );
                                        },
                                      });
                                    }
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            }
                            sx={{ py: 0.5, px: 0 }}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              {task.state === "done" ? (
                                <CheckCircle fontSize="small" color="primary" />
                              ) : (
                                <RadioButtonUnchecked fontSize="small" color="action" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={task.title}
                              secondary={
                                <>
                                  <Chip
                                    size="small"
                                    label={task.state}
                                    sx={{ mr: 0.5, mt: 0.25 }}
                                  />
                                  {task.assignee_id &&
                                    (members?.find((m) => m.user_id === task.assignee_id)?.display_name ||
                                      members?.find((m) => m.user_id === task.assignee_id)?.email ||
                                      task.assignee_id)}
                                </>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => {
                          const payloadFromValues = (v: Record<string, unknown>): CreateTaskRequest => ({
                            title: (v.title as string)?.trim() ?? "",
                            description: (v.description as string) || undefined,
                            state: (v.state as string) || "todo",
                            assignee_id: (v.assignee_id as string) || null,
                            rank_order: typeof v.rank_order === "number" ? v.rank_order : undefined,
                          });
                          modalApi.openAddTask({
                            taskFormSchema: taskFormSchema ?? null,
                            initialValues: taskCreateInitialValues,
                            onChange: setTaskCreateFormValues,
                            onSubmit: (values) => {
                              const title = (values.title as string)?.trim();
                              if (!title) return;
                              createTaskMutation.mutate(payloadFromValues(values), {
                                onSuccess: () => {
                                  modalApi.closeModal();
                                  setTaskCreateFormValues({});
                                  showNotification("Task added", "success");
                                },
                                onError: (err: Error) => {
                                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                                  showNotification(body?.detail ?? "Failed to add task", "error");
                                },
                              });
                            },
                            isPending: createTaskMutation.isPending,
                            userOptions: members?.map((m) => ({
                              id: m.user_id,
                              label: m.display_name || m.email || m.user_id,
                            })) ?? [],
                          });
                        }}
                      >
                        Add task
                      </Button>
                    </>
                  )}
                </Box>
              )}
              {!detailDrawerEditing && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Links
                  </Typography>
                  {linksLoading ? (
                    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                  ) : (
                    <>
                      <List dense disablePadding>
                        {artifactLinks.map((link: ArtifactLink) => {
                          const otherId =
                            link.from_artifact_id === detailArtifact?.id
                              ? link.to_artifact_id
                              : link.from_artifact_id;
                          const isOutgoing = link.from_artifact_id === detailArtifact?.id;
                          const otherArtifact = artifacts?.find((a) => a.id === otherId);
                          const otherTitle = otherArtifact?.title ?? `Artifact ${otherId.slice(0, 8)}…`;
                          return (
                            <ListItem
                              key={link.id}
                              secondaryAction={
                                <IconButton
                                  size="small"
                                  aria-label="Remove link"
                                  onClick={() => {
                                    if (window.confirm("Remove this link?")) {
                                      deleteLinkMutation.mutate(link.id, {
                                        onError: (err: Error) => {
                                          const body = (err as unknown as { body?: ProblemDetail })?.body;
                                          showNotification(
                                            body?.detail ?? "Failed to remove link",
                                            "error",
                                          );
                                        },
                                      });
                                    }
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              }
                              sx={{ py: 0.5, px: 0 }}
                            >
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <LinkIcon fontSize="small" color="action" />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <MuiLink
                                    component={Link}
                                    to={`/${orgSlug}/${projectSlug}/artifacts?artifact=${otherId}`}
                                    underline="hover"
                                    onClick={() => setListState({ detailArtifactId: otherId })}
                                  >
                                    {otherTitle}
                                  </MuiLink>
                                }
                                secondary={
                                  <Chip
                                    size="small"
                                    label={`${isOutgoing ? "→" : "←"} ${link.link_type}`}
                                    sx={{ mt: 0.25 }}
                                  />
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => {
                          modalApi.openAddLink({
                            sourceArtifactId: detailArtifact!.id,
                            artifactOptions: pickerArtifacts
                              .filter((a) => a.id !== detailArtifact?.id)
                              .map((a) => ({
                                value: a.id,
                                label: `[${a.artifact_key ?? a.id.slice(0, 8)}] ${a.title}`,
                              })),
                            onCreateLink: (linkType, targetArtifactId) => {
                              createLinkMutation.mutate(
                                { to_artifact_id: targetArtifactId, link_type: linkType },
                                {
                                  onSuccess: () => {
                                    modalApi.closeModal();
                                    showNotification("Link added", "success");
                                  },
                                  onError: (err: Error) => {
                                    const body = (err as unknown as { body?: ProblemDetail })?.body;
                                    showNotification(body?.detail ?? "Failed to add link", "error");
                                  },
                                },
                              );
                            },
                          });
                        }}
                      >
                        Add link
                      </Button>
                    </>
                  )}
                </Box>
              )}
              {!detailDrawerEditing && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Attachments
                  </Typography>
                  {attachmentsLoading ? (
                    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                  ) : (
                    <>
                      <List dense disablePadding>
                        {attachments.map((att: AttachmentType) => (
                          <ListItem
                            key={att.id}
                            secondaryAction={
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  aria-label="Download"
                                  onClick={async () => {
                                    try {
                                      const blob = await downloadAttachmentBlob(
                                        orgSlug!,
                                        project!.id,
                                        detailArtifact!.id,
                                        att.id,
                                      );
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement("a");
                                      a.href = url;
                                      a.download = att.file_name;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } catch {
                                      showNotification("Download failed", "error");
                                    }
                                  }}
                                >
                                  <Download fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  aria-label="Delete attachment"
                                  onClick={() => {
                                    if (window.confirm("Delete this attachment?")) {
                                      deleteAttachmentMutation.mutate(att.id, {
                                        onError: (err: Error) => {
                                          const body = (err as unknown as { body?: ProblemDetail })?.body;
                                          showNotification(
                                            body?.detail ?? "Failed to delete attachment",
                                            "error",
                                          );
                                        },
                                      });
                                    }
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            }
                            sx={{ py: 0.5, px: 0 }}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <InsertDriveFile fontSize="small" color="action" />
                            </ListItemIcon>
                            <ListItemText
                              primary={att.file_name}
                              secondary={`${(att.size / 1024).toFixed(1)} KB`}
                            />
                          </ListItem>
                        ))}
                      </List>
                      <Button
                        size="small"
                        startIcon={<UploadFile />}
                        component="label"
                        disabled={uploadAttachmentMutation.isPending}
                      >
                        Upload file
                        <input
                          type="file"
                          hidden
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (!files?.length) return;
                            for (let i = 0; i < files.length; i++) {
                              const file = files[i];
                              if (!file) continue;
                              uploadAttachmentMutation.mutate(file, {
                                onSuccess: () => showNotification("File uploaded", "success"),
                                onError: (err: Error) =>
                                  showNotification(err?.message ?? "Upload failed", "error"),
                              });
                            }
                            e.target.value = "";
                          }}
                        />
                      </Button>
                    </>
                  )}
                </Box>
              )}
              {!detailDrawerEditing && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Comments
                  </Typography>
                  {commentsLoading ? (
                    <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                  ) : (
                    <>
                      <List dense disablePadding>
                        {comments.map((c) => (
                          <ListItem key={c.id} sx={{ py: 0.5, px: 0, flexDirection: "column", alignItems: "stretch" }}>
                            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                              {c.body}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {c.created_by
                                ? (members?.find((m) => m.user_id === c.created_by)?.display_name ||
                                    members?.find((m) => m.user_id === c.created_by)?.email ||
                                    c.created_by)
                                : "Unknown"}{" "}
                              · {formatDateTime(c.created_at)}
                            </Typography>
                          </ListItem>
                        ))}
                      </List>
                      <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                        <FormProvider {...commentForm}>
                          <Box
                            component="form"
                            onSubmit={commentForm.handleSubmit((data) => {
                              const body = data.body.trim();
                              if (!body) return;
                              createCommentMutation.mutate(
                                { body },
                                {
                                  onSuccess: () => {
                                    commentForm.reset({ body: "" });
                                    showNotification("Comment added", "success");
                                  },
                                  onError: (err: Error) => {
                                    const b = (err as unknown as { body?: ProblemDetail })?.body;
                                    showNotification(b?.detail ?? "Failed to add comment", "error");
                                  },
                                },
                              );
                            })}
                            sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                          >
                            <RhfTextField<CommentFormValues>
                              name="body"
                              label=""
                              placeholder="Add a comment..."
                              size="small"
                              fullWidth
                              multiline
                              minRows={2}
                            />
                            <Button
                              type="submit"
                              size="small"
                              variant="outlined"
                              disabled={!commentBody?.trim() || createCommentMutation.isPending}
                            >
                              Add comment
                            </Button>
                          </Box>
                        </FormProvider>
                      </Box>
                    </>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
      </Drawer>
    </Container>
  );
}

function ArtifactTreeNode({
  node,
  manifest,
  customFieldColumns,
  onMenuOpen,
  onSelect,
  expandedIds,
  onToggleExpand,
  depth,
  orgSlug,
  projectId,
}: {
  node: ArtifactNode;
  manifest: Parameters<typeof getValidTransitions>[0];
  customFieldColumns: { key: string; label: string }[];
  onMenuOpen: (e: React.MouseEvent<HTMLElement>, a: Artifact) => void;
  onSelect?: (artifact: Artifact) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  depth: number;
  orgSlug: string | undefined;
  projectId: string | undefined;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);

  return (
    <>
      <ListItem
        sx={{
          pl: 2 + depth * 3,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: onSelect ? "pointer" : undefined,
        }}
        onClick={() => onSelect?.(node)}
        secondaryAction={
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onMenuOpen(e, node);
            }}
            aria-label="Actions"
          >
            <MoreVert />
          </IconButton>
        }
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            sx={{ mr: 0.5 }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        ) : (
          <Box component="span" sx={{ width: 32, display: "inline-block" }} />
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
          {node.artifact_key && (
            <Typography variant="body2" color="text.secondary" fontFamily="monospace" sx={{ minWidth: 56 }}>
              {node.artifact_key}
            </Typography>
          )}
          {getArtifactIcon(node.artifact_type)}
          <Typography variant="body2" textTransform="capitalize" color="text.secondary">
            {node.artifact_type}
          </Typography>
          <Typography fontWeight={500} noWrap>
            {node.title}
          </Typography>
          <Chip label={node.state} size="small" variant="outlined" sx={{ ml: 1 }} />
          {node.state_reason && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              {node.state_reason}
            </Typography>
          )}
          {node.resolution && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              · {node.resolution}
            </Typography>
          )}
          {customFieldColumns.slice(0, 2).map(
            (c) =>
              node.custom_fields?.[c.key] != null && (
                <Chip
                  key={c.key}
                  label={`${c.label}: ${node.custom_fields![c.key]}`}
                  size="small"
                  variant="filled"
                  sx={{ ml: 0.5, fontSize: "0.7rem", height: 20 }}
                />
              ),
          )}
        </Box>
      </ListItem>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List disablePadding>
          {node.children.map((child) => (
            <ArtifactTreeNode
              key={child.id}
              node={child}
              manifest={manifest}
              customFieldColumns={customFieldColumns}
              onMenuOpen={onMenuOpen}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
              orgSlug={orgSlug}
              projectId={projectId}
            />
          ))}
        </List>
      </Collapse>
    </>
  );
}

function TransitionMenuItem({
  targetState,
  onSelect,
}: {
  artifact: Artifact;
  targetState: string;
  onSelect: () => void;
}) {
  return (
    <MenuItem onClick={onSelect}>
      Move to {targetState}
    </MenuItem>
  );
}
