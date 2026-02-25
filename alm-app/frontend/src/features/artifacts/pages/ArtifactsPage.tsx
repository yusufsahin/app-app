import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Skeleton,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemText,
  Collapse,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  TextField,
  Drawer,
  Breadcrumbs,
  Link as MuiLink,
  Divider,
  ListItemIcon,
  CircularProgress,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  ArrowBack,
  Add,
  MoreVert,
  BugReport,
  Assignment,
  TableChart,
  AccountTree,
  ExpandLess,
  ExpandMore,
  People,
  PersonRemove,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { MetadataDrivenForm } from "../../../shared/components/forms/MetadataDrivenForm";
import {
  useArtifacts,
  useArtifact,
  useCreateArtifact,
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
  type CreateArtifactRequest,
  type TransitionArtifactRequest,
  type UpdateArtifactRequest,
} from "../../../shared/api/artifactApi";
import {
  useTasksByArtifact,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type Task,
  type CreateTaskRequest,
  type UpdateTaskRequest,
} from "../../../shared/api/taskApi";
import {
  useCommentsByArtifact,
  useCreateComment,
  type CreateCommentRequest,
} from "../../../shared/api/commentApi";
import {
  useArtifactLinks,
  useCreateArtifactLink,
  useDeleteArtifactLink,
  type ArtifactLink,
  type CreateArtifactLinkRequest,
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
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useArtifactStore } from "../../../shared/stores/artifactStore";
import type { ProblemDetail } from "../../../shared/api/types";

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const artifactIdFromUrl = searchParams.get("artifact");
  const typeFromUrl = searchParams.get("type") ?? "";
  const stateFromUrl = searchParams.get("state") ?? "";
  const cycleNodeIdFromUrl = searchParams.get("cycle_node_id") ?? "";
  const areaNodeIdFromUrl = searchParams.get("area_node_id") ?? "";
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const { data: listSchema } = useListSchema(orgSlug, project?.id, "artifact");
  const { data: formSchema } = useFormSchema(orgSlug, project?.id);
  const { data: members } = useOrgMembers(orgSlug);
  const { data: projectMembers, isLoading: projectMembersLoading } = useProjectMembers(orgSlug, project?.id);
  const addProjectMemberMutation = useAddProjectMember(orgSlug, project?.id);
  const removeProjectMemberMutation = useRemoveProjectMember(orgSlug, project?.id);
  const updateProjectMemberMutation = useUpdateProjectMember(orgSlug, project?.id);
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
    createOpen,
    transitionArtifactId,
    transitionTargetState,
    transitionStateReason,
    transitionResolution,
    bulkTransitionOpen,
    bulkTransitionState,
    bulkTransitionStateReason,
    bulkTransitionResolution,
    bulkDeleteConfirmOpen,
    deleteConfirmArtifactId,
    membersDialogOpen,
    addMemberUserId,
    addMemberRole,
    detailDrawerEditing,
    editTitle,
    editDescription,
    editAssigneeId,
    editTitleError,
  } = listState;
  const selectedIds = useMemo(() => new Set(selectedIdsList), [selectedIdsList]);

  useEffect(() => {
    setListState({
      stateFilter: stateFromUrl,
      typeFilter: typeFromUrl,
      cycleNodeFilter: cycleNodeIdFromUrl,
      areaNodeFilter: areaNodeIdFromUrl,
    });
  }, [stateFromUrl, typeFromUrl, cycleNodeIdFromUrl, areaNodeIdFromUrl, setListState]);
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
  const [saveQueryDialogOpen, setSaveQueryDialogOpen] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState("");
  const [saveQueryVisibility, setSaveQueryVisibility] = useState<"private" | "project">("private");
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictDetail, setConflictDetail] = useState("");
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

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormState, setTaskFormState] = useState("todo");
  const [taskFormAssigneeId, setTaskFormAssigneeId] = useState<string>("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskState, setEditTaskState] = useState("todo");
  const [editTaskAssigneeId, setEditTaskAssigneeId] = useState<string>("");

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

  const { data: comments = [], isLoading: commentsLoading } = useCommentsByArtifact(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const createCommentMutation = useCreateComment(orgSlug, project?.id, detailArtifact?.id);
  const [newCommentBody, setNewCommentBody] = useState("");

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
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkToId, setAddLinkToId] = useState<string>("");
  const [addLinkType, setAddLinkType] = useState<string>("related");
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
  const duplicateSourceRef = useRef<Artifact | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const transitionArtifact = useMemo(
    () => (transitionArtifactId ? artifacts?.find((a) => a.id === transitionArtifactId) ?? null : null),
    [transitionArtifactId, artifacts],
  );
  const deleteConfirmArtifact = useMemo(
    () => (deleteConfirmArtifactId ? artifacts?.find((a) => a.id === deleteConfirmArtifactId) ?? null : null),
    [deleteConfirmArtifactId, artifacts],
  );

  const transitionMutation = useTransitionArtifact(
    orgSlug,
    project?.id,
    transitionArtifact?.id,
  );
  const batchTransitionMutation = useBatchTransitionArtifacts(orgSlug, project?.id);
  const batchDeleteMutation = useBatchDeleteArtifacts(orgSlug, project?.id);
  const restoreMutation = useRestoreArtifact(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const toggleSelect = (id: string) => toggleSelectedId(id);
  const toggleSelectAll = () => {
    const ids = artifacts?.map((a) => a.id) ?? [];
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? [] : ids);
  };
  const handleSelectAllInTable = (checked: boolean) => {
    const ids = artifacts?.map((a) => a.id) ?? [];
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    } else {
      const idSet = new Set(ids);
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    }
  };
  const pageArtifactIds = useMemo(
    () => new Set(artifacts?.map((a) => a.id) ?? []),
    [artifacts],
  );
  const isAllPageSelected =
    pageArtifactIds.size > 0 && [...pageArtifactIds].every((id) => selectedIds.has(id));
  const isSomePageSelected =
    pageArtifactIds.size > 0 && [...pageArtifactIds].some((id) => selectedIds.has(id));

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

  const filterTypes = useMemo(
    () =>
      (bundle?.artifact_types ?? []).map((at) => ({
        id: at.id,
        name: (at.name as string) || at.id.replace(/_/g, " "),
      })),
    [bundle?.artifact_types],
  );

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

  const handleCreateOpen = () => {
    setCreateFormErrors({});
    setListState({ createOpen: true });
  };

  const handleDuplicate = (artifact: Artifact) => {
    duplicateSourceRef.current = artifact;
    setListState({ createOpen: true });
    handleMenuClose();
  };

  useEffect(() => {
    if (!createOpen || !formSchema) return;
    const artifact = duplicateSourceRef.current;
    if (artifact) {
      duplicateSourceRef.current = null;
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
      setCreateFormValues(duplicateValues);
    } else {
      setCreateFormValues(initialFormValues);
    }
  }, [createOpen, formSchema, initialFormValues]);

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

  const showResolutionField =
    !!transitionTargetState &&
    ["resolved", "closed", "done"].includes(transitionTargetState.toLowerCase());
  const handleConfirmTransition = async () => {
    if (!transitionArtifact || !transitionTargetState) return;
    const payload: TransitionArtifactRequest = {
      new_state: transitionTargetState,
      state_reason: transitionStateReason.trim() || undefined,
      resolution: transitionResolution.trim() || undefined,
      expected_updated_at: transitionArtifact.updated_at ?? undefined,
    };
    try {
      await transitionMutation.mutateAsync(payload);
      setConflictDialogOpen(false);
      handleCloseTransitionDialog();
      showNotification("State updated successfully");
    } catch (err) {
      const problem = err as ProblemDetail & { status?: number };
      if (problem?.status === 409) {
        setConflictDetail(problem?.detail ?? "This artifact was updated by someone else.");
        setConflictDialogOpen(true);
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
    const payload: TransitionArtifactRequest = {
      new_state: transitionTargetState,
      state_reason: transitionStateReason.trim() || undefined,
      resolution: transitionResolution.trim() || undefined,
      expected_updated_at: undefined,
    };
    transitionMutation.mutate(payload, {
      onSuccess: () => {
        setConflictDialogOpen(false);
        handleCloseTransitionDialog();
        showNotification("State updated successfully", "success");
      },
      onError: (err: Error) => {
        const problem = err as unknown as ProblemDetail & { status?: number };
        if (problem?.status === 409) {
          setConflictDetail(problem?.detail ?? "Conflict persists. Refresh and try again.");
        } else {
          setConflictDialogOpen(false);
          showNotification(problem?.detail ?? "Transition failed", "error");
        }
      },
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink
          component={Link}
          to={orgSlug ? `/${orgSlug}` : "#"}
          underline="hover"
          color="inherit"
        >
          {orgSlug ?? "Org"}
        </MuiLink>
        {project && (
          <MuiLink
            component={Link}
            to={`/${orgSlug}/${projectSlug}`}
            underline="hover"
            color="inherit"
          >
            {project.name}
          </MuiLink>
        )}
        <Typography color="text.primary">Artifacts</Typography>
      </Breadcrumbs>
      <Button
        startIcon={<ArrowBack />}
        onClick={() =>
          navigate(orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "..")
        }
        sx={{ mb: 3 }}
      >
        Back to project
      </Button>

      {!project && projectSlug ? (
        <Typography color="text.secondary">
          Project &quot;{projectSlug}&quot; not found.
        </Typography>
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
              <Typography variant="h4" fontWeight={700}>
                Artifacts
              </Typography>
              <TextField
                size="small"
                placeholder="Search title, description, or key…"
                value={searchInput}
                onChange={(e) => setListState({ searchInput: e.target.value })}
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
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Saved queries</InputLabel>
                <Select
                  label="Saved queries"
                  value=""
                  displayEmpty
                  onChange={(e) => {
                    const id = e.target.value as string;
                    if (!id) return;
                    const q = savedQueries.find((s) => s.id === id);
                    if (q) setListState(filterParamsToListStatePatch(q.filter_params));
                  }}
                >
                  <MenuItem value="">
                    <em>Apply a saved query…</em>
                  </MenuItem>
                  {savedQueries.map((q) => (
                    <MenuItem key={q.id} value={q.id}>
                      {q.name}
                      {q.visibility === "private" ? " (private)" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                size="small"
                startIcon={<Save />}
                onClick={() => {
                  setSaveQueryName("");
                  setSaveQueryVisibility("private");
                  setSaveQueryDialogOpen(true);
                }}
                aria-label="Save current filters"
              >
                Save filters
              </Button>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>State</InputLabel>
                <Select
                  label="State"
                  value={stateFilter}
                  onChange={(e) => setListState({ stateFilter: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  {filterStates.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s.replace(/_/g, " ").replace(/-/g, " ")}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  label="Type"
                  value={typeFilter}
                  onChange={(e) => setListState({ typeFilter: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  {filterTypes.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Cycle</InputLabel>
                <Select
                  label="Cycle"
                  value={cycleNodeFilter}
                  onChange={(e) => setListState({ cycleNodeFilter: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  {cycleNodesFlat.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.path || c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Area</InputLabel>
                <Select
                  label="Area"
                  value={areaNodeFilter}
                  onChange={(e) => setListState({ areaNodeFilter: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  {areaNodesFlat.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {areaNodeDisplayLabel(a)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Sort by</InputLabel>
                <Select
                  label="Sort by"
                  value={sortBy}
                  onChange={(e) => setListState({ sortBy: e.target.value as ArtifactSortBy })}
                >
                  <MenuItem value="artifact_key">Key</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="state">State</MenuItem>
                  <MenuItem value="artifact_type">Type</MenuItem>
                  <MenuItem value="created_at">Created</MenuItem>
                  <MenuItem value="updated_at">Updated</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 95 }}>
                <InputLabel>Order</InputLabel>
                <Select
                  label="Order"
                  value={sortOrder}
                  onChange={(e) => setListState({ sortOrder: e.target.value as ArtifactSortOrder })}
                >
                  <MenuItem value="asc">Asc</MenuItem>
                  <MenuItem value="desc">Desc</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={showDeleted}
                    onChange={(_, checked) => setListState({ showDeleted: !!checked })}
                    aria-label="Show deleted artifacts"
                  />
                }
                label="Show deleted"
              />
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
                onClick={() => setListState({ membersDialogOpen: true })}
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
                  onClick={() => setListState({ bulkTransitionOpen: true })}
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
                  onClick={() => setListState({ bulkDeleteConfirmOpen: true })}
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
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ opacity: isRefetching ? 0.7 : 1, transition: "opacity 0.2s" }}
              aria-label="Artifacts list"
            >
              <Table aria-label="Artifacts">
                <TableHead>
                  <TableRow>
                    {!showDeleted && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={isSomePageSelected && !isAllPageSelected}
                          checked={isAllPageSelected}
                          onChange={toggleSelectAll}
                          disabled={!artifacts?.length}
                          aria-label="Select all on page"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}
                    <TableCell>Key</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>State reason</TableCell>
                    <TableCell>Resolution</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Updated</TableCell>
                    {customFieldColumns.map((c) => (
                      <TableCell key={c.key}>{c.label}</TableCell>
                    ))}
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {artifacts?.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={showDeleted ? 9 + customFieldColumns.length : 10 + customFieldColumns.length} align="center" sx={{ py: 4 }}>
                        {(stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchQuery) ? (
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <Typography color="text.secondary">
                              No artifacts match your filters.
                            </Typography>
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
                          </Box>
                        ) : (
                          <Typography color="text.secondary">
                            No artifacts yet. Create one to get started.
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    artifacts?.map((a) => (
                      <ArtifactRow
                        key={a.id}
                        artifact={a}
                        manifest={manifest}
                        customFieldColumns={customFieldColumns}
                        selected={!showDeleted && selectedIds.has(a.id)}
                        onToggleSelect={showDeleted ? undefined : () => toggleSelect(a.id)}
                        onMenuOpen={handleMenuOpen}
                        onSelect={() => {
                          setListState({ detailArtifactId: a.id });
                          setSearchParams((prev) => {
                            const p = new URLSearchParams(prev);
                            p.set("artifact", a.id);
                            return p;
                          });
                        }}
                        showRestore={showDeleted && (a.allowed_actions?.includes("restore") ?? false)}
                        onRestore={() => {
                          restoreMutation.mutate(a.id, {
                            onSuccess: () => {
                              showNotification("Artifact restored", "success");
                              setListState({ showDeleted: false });
                            },
                            onError: () => showNotification("Restore failed", "error"),
                          });
                        }}
                        restorePending={restoreMutation.isPending}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
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
                      setListState({ deleteConfirmArtifactId: selectedArtifact?.id ?? null });
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

          <Dialog
            open={!!deleteConfirmArtifact}
            onClose={() => setListState({ deleteConfirmArtifactId: null })}
            maxWidth="xs"
            fullWidth
            aria-labelledby="delete-artifact-dialog-title"
          >
            <DialogTitle id="delete-artifact-dialog-title">Delete artifact</DialogTitle>
            <DialogContent>
              {deleteConfirmArtifact && (
                <Typography>
                  Delete <strong>{deleteConfirmArtifact.artifact_key ?? deleteConfirmArtifact.id}</strong> — {deleteConfirmArtifact.title}? This will remove the artifact from the list.
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setListState({ deleteConfirmArtifactId: null })}>Cancel</Button>
              <Button
                color="error"
                variant="contained"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!deleteConfirmArtifact) return;
                  deleteMutation.mutate(deleteConfirmArtifact.id, {
                    onSuccess: () => {
                      setListState({ deleteConfirmArtifactId: null });
                      if (detailArtifact?.id === deleteConfirmArtifact.id) {
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
                }}
              >
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setListState({ createOpen: false })}
        maxWidth="sm"
        fullWidth
        aria-labelledby="create-artifact-dialog-title"
      >
        <DialogTitle id="create-artifact-dialog-title">Create artifact</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {formSchema ? (
            <MetadataDrivenForm
              schema={formSchema}
              values={createFormValues}
              onChange={(v) => { setCreateFormValues(v); setCreateFormErrors({}); }}
              onSubmit={handleCreate}
              submitLabel="Create"
              disabled={createMutation.isPending}
              submitExternally
              errors={createFormErrors}
              parentArtifacts={artifacts?.map((a) => ({
                id: a.id,
                title: a.title,
                artifact_type: a.artifact_type,
              })) ?? []}
              artifactTypeParentMap={artifactTypeParentMap}
              userOptions={members?.map((m) => ({
                id: m.user_id,
                label: m.display_name || m.email,
              })) ?? []}
            />
          ) : (
            <Typography color="text.secondary">Loading form schema…</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListState({ createOpen: false })}>Cancel</Button>
          {formSchema && (
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={
                !(createFormValues.title as string)?.trim() || createMutation.isPending
              }
            >
              Create
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkTransitionOpen}
        onClose={() => {
          setListState({ bulkTransitionOpen: false });
          setListState({
          bulkTransitionState: "",
          bulkTransitionStateReason: "",
          bulkTransitionResolution: "",
        });
        }}
        maxWidth="xs"
        fullWidth
        aria-labelledby="bulk-transition-dialog-title"
      >
        <DialogTitle id="bulk-transition-dialog-title">
          Transition {selectedIds.size} artifact(s)
        </DialogTitle>
        <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl fullWidth size="small" required>
            <InputLabel>New state</InputLabel>
            <Select
              label="New state"
              value={bulkTransitionState}
              onChange={(e) => setListState({ bulkTransitionState: e.target.value })}
            >
              {filterStates.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            fullWidth
            label="State reason (optional)"
            value={bulkTransitionStateReason}
            onChange={(e) => setListState({ bulkTransitionStateReason: e.target.value })}
          />
          <TextField
            size="small"
            fullWidth
            label="Resolution (optional)"
            value={bulkTransitionResolution}
            onChange={(e) => setListState({ bulkTransitionResolution: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setListState({
                bulkTransitionOpen: false,
                bulkTransitionState: "",
                bulkTransitionStateReason: "",
                bulkTransitionResolution: "",
              });
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!bulkTransitionState || batchTransitionMutation.isPending}
            onClick={() => {
              batchTransitionMutation.mutate(
                {
                  artifact_ids: [...selectedIds],
                  new_state: bulkTransitionState,
                  state_reason: bulkTransitionStateReason || undefined,
                  resolution: bulkTransitionResolution || undefined,
                },
                {
                  onSuccess: (res) => {
                    setListState({
                      bulkTransitionOpen: false,
                      bulkTransitionState: "",
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
                    showNotification(
                      `${res.success_count} transitioned${res.error_count > 0 ? `, ${res.error_count} failed` : ""}.`,
                      res.error_count > 0 ? "warning" : "success",
                    );
                  },
                  onError: () => {
                    showNotification("Bulk transition failed", "error");
                  },
                },
              );
            }}
          >
            Transition
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bulkDeleteConfirmOpen}
        onClose={() => setListState({ bulkDeleteConfirmOpen: false })}
        maxWidth="xs"
        fullWidth
        aria-labelledby="bulk-delete-dialog-title"
      >
        <DialogTitle id="bulk-delete-dialog-title">
          Delete {selectedIds.size} artifact(s)?
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            This will soft-delete the selected artifacts. This action cannot be undone from this screen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListState({ bulkDeleteConfirmOpen: false })}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={batchDeleteMutation.isPending}
            onClick={() => {
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
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!transitionArtifact && !!transitionTargetState}
        onClose={handleCloseTransitionDialog}
        maxWidth="sm"
        fullWidth
        aria-labelledby="transition-artifact-dialog-title"
      >
        <DialogTitle id="transition-artifact-dialog-title">
          Transition to {transitionTargetState ?? ""}
          {transitionArtifact && (
            <Typography component="span" display="block" variant="body2" color="text.secondary" fontWeight={400}>
              {transitionArtifact.artifact_key ?? transitionArtifact.id} — {transitionArtifact.title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {transitionOptions.stateReasonOptions.length > 0 && (
            <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2 }}>
              <InputLabel>State reason</InputLabel>
              <Select
                label="State reason"
                value={transitionStateReason}
                onChange={(e) => setListState({ transitionStateReason: e.target.value })}
              >
                {transitionOptions.stateReasonOptions.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {showResolutionField && transitionOptions.resolutionOptions.length > 0 && (
            <FormControl fullWidth size="small" sx={{ mb: 2 }} required>
              <InputLabel>Resolution</InputLabel>
              <Select
                label="Resolution *"
                value={transitionResolution}
                onChange={(e) => setListState({ transitionResolution: e.target.value })}
              >
                {transitionOptions.resolutionOptions.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>Required when closing or resolving.</FormHelperText>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTransitionDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleConfirmTransition}
            disabled={
              transitionMutation.isPending ||
              (showResolutionField &&
                transitionOptions.resolutionOptions.length > 0 &&
                !transitionResolution)
            }
          >
            Transition
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={conflictDialogOpen}
        onClose={() => setConflictDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="conflict-resolution-dialog-title"
      >
        <DialogTitle id="conflict-resolution-dialog-title">Conflict</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            {conflictDetail}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Do you want to apply your state change anyway (overwrite)?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConflictDialogOpen(false);
              handleCloseTransitionDialog();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConflictOverwrite}
            disabled={transitionMutation.isPending}
          >
            Overwrite
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={membersDialogOpen}
        onClose={() => setListState({ membersDialogOpen: false })}
        maxWidth="sm"
        fullWidth
        aria-labelledby="project-members-dialog-title"
      >
        <DialogTitle id="project-members-dialog-title">Project members</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {projectMembersLoading ? (
            <Typography color="text.secondary">Loading members…</Typography>
          ) : (
            <>
              <List dense disablePadding>
                {(projectMembers ?? []).map((pm) => {
                  const orgMember = members?.find((m) => m.user_id === pm.user_id);
                  const label = orgMember?.display_name || orgMember?.email || pm.user_id;
                  const isOnlyAdmin =
                    pm.role === "PROJECT_ADMIN" &&
                    (projectMembers ?? []).filter((m) => m.role === "PROJECT_ADMIN").length <= 1;
                  return (
                    <ListItem
                      key={pm.id}
                      secondaryAction={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={pm.role}
                              size="small"
                              onChange={(e) =>
                                updateProjectMemberMutation.mutate(
                                  {
                                    userId: pm.user_id,
                                    role: e.target.value as string,
                                  },
                                  {
                                    onSuccess: () =>
                                      showNotification("Role updated successfully"),
                                  },
                                )
                              }
                              disabled={updateProjectMemberMutation.isPending}
                            >
                              <MenuItem value="PROJECT_VIEWER">Viewer</MenuItem>
                              <MenuItem value="PROJECT_CONTRIBUTOR">Contributor</MenuItem>
                              <MenuItem value="PROJECT_ADMIN">Admin</MenuItem>
                            </Select>
                          </FormControl>
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label="Remove member"
                            disabled={
                              removeProjectMemberMutation.isPending || isOnlyAdmin
                            }
                            title={isOnlyAdmin ? "Cannot remove the last admin" : "Remove member"}
                            onClick={() =>
                              removeProjectMemberMutation.mutate(pm.user_id, {
                                onSuccess: () =>
                                  showNotification("Member removed successfully"),
                                onError: (error: Error) => {
                                  const body = (error as unknown as { body?: ProblemDetail })?.body;
                                  showNotification(
                                    body?.detail ?? "Failed to remove member.",
                                    "error",
                                  );
                                },
                              })
                            }
                          >
                            <PersonRemove fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText primary={label} />
                    </ListItem>
                  );
                })}
                {(projectMembers ?? []).length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No members yet"
                      secondary="Add org members below."
                    />
                  </ListItem>
                )}
              </List>
              <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Add member
                </Typography>
                <FormControl size="small" fullWidth>
                  <InputLabel>User</InputLabel>
                  <Select
                    value={addMemberUserId}
                    label="User"
                    onChange={(e) => setListState({ addMemberUserId: e.target.value })}
                  >
                    {(members ?? [])
                      .filter((m) => !(projectMembers ?? []).some((pm) => pm.user_id === m.user_id))
                      .map((m) => (
                        <MenuItem key={m.user_id} value={m.user_id}>
                          {m.display_name || m.email}
                        </MenuItem>
                      ))}
                    {(members ?? []).filter((m) => !(projectMembers ?? []).some((pm) => pm.user_id === m.user_id)).length === 0 && (
                      <MenuItem disabled>All org members are already in the project</MenuItem>
                    )}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={addMemberRole}
                    label="Role"
                    onChange={(e) => setListState({ addMemberRole: e.target.value })}
                  >
                    <MenuItem value="PROJECT_VIEWER">Viewer</MenuItem>
                    <MenuItem value="PROJECT_CONTRIBUTOR">Contributor</MenuItem>
                    <MenuItem value="PROJECT_ADMIN">Admin</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListState({ membersDialogOpen: false })}>Close</Button>
          {!projectMembersLoading && (
            <Button
              variant="contained"
              disabled={!addMemberUserId || addProjectMemberMutation.isPending}
              onClick={async () => {
                if (!addMemberUserId) return;
                try {
                  await addProjectMemberMutation.mutateAsync({
                    user_id: addMemberUserId,
                    role: addMemberRole,
                  });
                  setListState({ addMemberUserId: "", addMemberRole: "PROJECT_VIEWER" });
                  showNotification("Member added successfully");
                } catch {
                  // Error handled by mutation / global handler
                }
              }}
            >
              Add member
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add task</DialogTitle>
        <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Title"
            size="small"
            fullWidth
            required
            value={taskFormTitle}
            onChange={(e) => setTaskFormTitle(e.target.value)}
            inputProps={{ maxLength: 500 }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>State</InputLabel>
            <Select
              label="State"
              value={taskFormState}
              onChange={(e) => setTaskFormState(e.target.value)}
            >
              <MenuItem value="todo">Todo</MenuItem>
              <MenuItem value="in_progress">In progress</MenuItem>
              <MenuItem value="done">Done</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Assignee</InputLabel>
            <Select
              label="Assignee"
              value={taskFormAssigneeId}
              onChange={(e) => setTaskFormAssigneeId(e.target.value)}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {(members ?? []).map((m) => (
                <MenuItem key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email || m.user_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTaskOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!taskFormTitle.trim() || createTaskMutation.isPending}
            onClick={() => {
              const title = taskFormTitle.trim();
              if (!title) return;
              const payload: CreateTaskRequest = {
                title,
                state: taskFormState,
                assignee_id: taskFormAssigneeId || null,
              };
              createTaskMutation.mutate(payload, {
                onSuccess: () => {
                  setAddTaskOpen(false);
                  setTaskFormTitle("");
                  showNotification("Task added", "success");
                },
                onError: (err: Error) => {
                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                  showNotification(body?.detail ?? "Failed to add task", "error");
                },
              });
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit task</DialogTitle>
        <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Title"
            size="small"
            fullWidth
            required
            value={editTaskTitle}
            onChange={(e) => setEditTaskTitle(e.target.value)}
            inputProps={{ maxLength: 500 }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>State</InputLabel>
            <Select
              label="State"
              value={editTaskState}
              onChange={(e) => setEditTaskState(e.target.value)}
            >
              <MenuItem value="todo">Todo</MenuItem>
              <MenuItem value="in_progress">In progress</MenuItem>
              <MenuItem value="done">Done</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Assignee</InputLabel>
            <Select
              label="Assignee"
              value={editTaskAssigneeId}
              onChange={(e) => setEditTaskAssigneeId(e.target.value)}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {(members ?? []).map((m) => (
                <MenuItem key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email || m.user_id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingTask(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editTaskTitle.trim() || updateTaskMutation.isPending}
            onClick={() => {
              if (!editingTask) return;
              const title = editTaskTitle.trim();
              if (!title) return;
              const payload: UpdateTaskRequest = {
                title,
                state: editTaskState,
                assignee_id: editTaskAssigneeId || null,
              };
              updateTaskMutation.mutate(payload, {
                onSuccess: () => {
                  setEditingTask(null);
                  showNotification("Task updated", "success");
                },
                onError: (err: Error) => {
                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                  showNotification(body?.detail ?? "Failed to update task", "error");
                },
              });
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={addLinkOpen}
        onClose={() => setAddLinkOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add link</DialogTitle>
        <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Link type</InputLabel>
            <Select
              label="Link type"
              value={addLinkType}
              onChange={(e) => setAddLinkType(e.target.value)}
            >
              <MenuItem value="related">Related</MenuItem>
              <MenuItem value="parent">Parent</MenuItem>
              <MenuItem value="child">Child</MenuItem>
              <MenuItem value="blocks">Blocks</MenuItem>
              <MenuItem value="duplicate">Duplicate</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Artifact to link to</InputLabel>
            <Select
              label="Artifact to link to"
              value={addLinkToId}
              onChange={(e) => setAddLinkToId(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <em>Select an artifact</em>
              </MenuItem>
              {pickerArtifacts
                .filter((a) => a.id !== detailArtifact?.id)
                .map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    [{a.artifact_key ?? a.id.slice(0, 8)}] {a.title}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddLinkOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!addLinkToId || createLinkMutation.isPending}
            onClick={() => {
              if (!addLinkToId) return;
              const payload: CreateArtifactLinkRequest = {
                to_artifact_id: addLinkToId,
                link_type: addLinkType,
              };
              createLinkMutation.mutate(payload, {
                onSuccess: () => {
                  setAddLinkOpen(false);
                  setAddLinkToId("");
                  showNotification("Link added", "success");
                },
                onError: (err: Error) => {
                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                  showNotification(body?.detail ?? "Failed to add link", "error");
                },
              });
            }}
          >
            Add link
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={saveQueryDialogOpen}
        onClose={() => setSaveQueryDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="save-query-dialog-title">Save current filters</DialogTitle>
        <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for dialog UX
            autoFocus
            label="Query name"
            value={saveQueryName}
            onChange={(e) => setSaveQueryName(e.target.value)}
            fullWidth
            placeholder="e.g. My open bugs"
          />
          <FormControl fullWidth>
            <InputLabel>Visibility</InputLabel>
            <Select
              label="Visibility"
              value={saveQueryVisibility}
              onChange={(e) => setSaveQueryVisibility(e.target.value as "private" | "project")}
            >
              <MenuItem value="private">Private (only me)</MenuItem>
              <MenuItem value="project">Project (all members)</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveQueryDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!saveQueryName.trim() || createSavedQueryMutation.isPending}
            onClick={() => {
              const name = saveQueryName.trim();
              if (!name || !project?.id) return;
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
                { name, filter_params: filterParams, visibility: saveQueryVisibility },
                {
                  onSuccess: () => {
                    setSaveQueryDialogOpen(false);
                    setSaveQueryName("");
                    showNotification("Saved query created", "success");
                  },
                  onError: (err: Error) => {
                    const body = (err as unknown as { body?: ProblemDetail })?.body;
                    showNotification(body?.detail ?? "Failed to save query", "error");
                  },
                },
              );
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

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
                        setListState({
                          editTitle: detailArtifact.title,
                          editDescription: detailArtifact.description ?? "",
                          editAssigneeId: detailArtifact.assignee_id ?? "",
                          editTitleError: "",
                          detailDrawerEditing: true,
                        });
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
                <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    label="Title"
                    size="small"
                    fullWidth
                    value={editTitle}
                    onChange={(e) => {
                      setListState({ editTitle: e.target.value, editTitleError: "" });
                    }}
                    error={!!editTitleError}
                    helperText={editTitleError}
                    inputProps={{ maxLength: TITLE_MAX_LENGTH }}
                  />
                  <TextField
                    label="Description"
                    size="small"
                    fullWidth
                    multiline
                    minRows={3}
                    value={editDescription}
                    onChange={(e) => setListState({ editDescription: e.target.value })}
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Assignee</InputLabel>
                    <Select
                      label="Assignee"
                      value={editAssigneeId}
                      onChange={(e) => setListState({ editAssigneeId: e.target.value })}
                    >
                      <MenuItem value="">Unassigned</MenuItem>
                      {(members ?? []).map((m) => (
                        <MenuItem key={m.user_id} value={m.user_id}>
                          {m.display_name || m.email || m.user_id}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    <Button
                      onClick={() => setListState({ detailDrawerEditing: false })}
                      disabled={updateArtifactMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      disabled={updateArtifactMutation.isPending}
                      onClick={() => {
                        const titleTrim = editTitle.trim();
                        if (!titleTrim) {
                          setListState({ editTitleError: "Title is required." });
                          return;
                        }
                        if (titleTrim.length > TITLE_MAX_LENGTH) {
                          setListState({ editTitleError: `Title must be at most ${TITLE_MAX_LENGTH} characters.` });
                          return;
                        }
                        setListState({ editTitleError: "" });
                        const payload: UpdateArtifactRequest = {
                          title: titleTrim,
                          description: editDescription || null,
                          assignee_id: editAssigneeId || null,
                        };
                        updateArtifactMutation.mutate(payload, {
                          onSuccess: (data) => {
                            setListState({ detailArtifactId: data.id });
                            setListState({ detailDrawerEditing: false });
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
              {!detailDrawerEditing && (
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Planning
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Cycle</InputLabel>
                      <Select
                        label="Cycle"
                        value={detailArtifact.cycle_node_id ?? ""}
                        onChange={(e) => {
                          const v = e.target.value as string;
                          updateArtifactMutation.mutate(
                            { cycle_node_id: v || null },
                            {
                              onSuccess: () => showNotification("Cycle updated", "success"),
                              onError: (err: Error) => showNotification(err?.message ?? "Update failed", "error"),
                            },
                          );
                        }}
                        disabled={updateArtifactMutation.isPending}
                      >
                        <MenuItem value="">None</MenuItem>
                        {cycleNodesFlat.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.path || c.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Area</InputLabel>
                      <Select
                        label="Area"
                        value={detailArtifact.area_node_id ?? ""}
                        onChange={(e) => {
                          const v = e.target.value as string;
                          updateArtifactMutation.mutate(
                            { area_node_id: v || null },
                            {
                              onSuccess: () => showNotification("Area updated", "success"),
                              onError: (err: Error) => showNotification(err?.message ?? "Update failed", "error"),
                            },
                          );
                        }}
                        disabled={updateArtifactMutation.isPending}
                      >
                        <MenuItem value="">None</MenuItem>
                        {areaNodesFlat.map((a) => (
                          <MenuItem key={a.id} value={a.id}>
                            {areaNodeDisplayLabel(a)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
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
                                    setEditingTask(task);
                                    setEditTaskTitle(task.title);
                                    setEditTaskState(task.state);
                                    setEditTaskAssigneeId(task.assignee_id ?? "");
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
                          setTaskFormTitle("");
                          setTaskFormState("todo");
                          setTaskFormAssigneeId("");
                          setAddTaskOpen(true);
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
                          setAddLinkToId("");
                          setAddLinkType("related");
                          setAddLinkOpen(true);
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
                        <TextField
                          size="small"
                          fullWidth
                          multiline
                          minRows={2}
                          placeholder="Add a comment..."
                          value={newCommentBody}
                          onChange={(e) => setNewCommentBody(e.target.value)}
                          disabled={createCommentMutation.isPending}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!newCommentBody.trim() || createCommentMutation.isPending}
                          onClick={() => {
                            const body = newCommentBody.trim();
                            if (!body) return;
                            const payload: CreateCommentRequest = { body };
                            createCommentMutation.mutate(payload, {
                              onSuccess: () => {
                                setNewCommentBody("");
                                showNotification("Comment added", "success");
                              },
                              onError: (err: Error) => {
                                const body = (err as unknown as { body?: ProblemDetail })?.body;
                                showNotification(body?.detail ?? "Failed to add comment", "error");
                              },
                            });
                          }}
                        >
                          Add comment
                        </Button>
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

function ArtifactRow({
  artifact,
  manifest: _manifest,
  customFieldColumns,
  selected,
  onToggleSelect,
  onMenuOpen,
  onSelect,
  showRestore,
  onRestore,
  restorePending,
}: {
  artifact: Artifact;
  manifest: Parameters<typeof getValidTransitions>[0];
  customFieldColumns: { key: string; label: string }[];
  selected?: boolean;
  onToggleSelect?: () => void;
  onMenuOpen: (e: React.MouseEvent<HTMLElement>, a: Artifact) => void;
  onSelect?: () => void;
  showRestore?: boolean;
  onRestore?: () => void;
  restorePending?: boolean;
}) {
  return (
    <TableRow
      onClick={onSelect}
      sx={{ cursor: onSelect ? "pointer" : undefined }}
    >
      {onToggleSelect != null && (
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={!!selected}
            onChange={onToggleSelect}
            aria-label={`Select ${artifact.artifact_key ?? artifact.title}`}
            onClick={(e) => e.stopPropagation()}
          />
        </TableCell>
      )}
      <TableCell>
        <Typography variant="body2" color="text.secondary" fontFamily="monospace">
          {artifact.artifact_key ?? "—"}
        </Typography>
      </TableCell>
      <TableCell sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {getArtifactIcon(artifact.artifact_type)}
        <Typography variant="body2" textTransform="capitalize">
          {artifact.artifact_type}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography fontWeight={500}>{artifact.title}</Typography>
        {artifact.description && (
          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
            {artifact.description}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Chip label={artifact.state} size="small" variant="outlined" />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {artifact.state_reason ?? "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {artifact.resolution ?? "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {formatDateTime(artifact.created_at ?? undefined) || "—"}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {formatDateTime(artifact.updated_at ?? undefined) || "—"}
        </Typography>
      </TableCell>
      {customFieldColumns.map((c) => (
        <TableCell key={c.key}>
          <Typography variant="body2" color="text.secondary">
            {artifact.custom_fields?.[c.key] != null
              ? String(artifact.custom_fields[c.key])
              : "—"}
          </Typography>
        </TableCell>
      ))}
      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
          {showRestore && onRestore && (
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              disabled={restorePending}
            >
              Restore
            </Button>
          )}
          <IconButton
            size="small"
            onClick={(e) => onMenuOpen(e, artifact)}
            aria-label="Actions"
          >
            <MoreVert />
          </IconButton>
        </Box>
      </TableCell>
    </TableRow>
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
