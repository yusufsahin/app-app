import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
} from "../../../shared/components/ui";
import {
  MoreHorizontal,
  Copy,
  Pencil,
  Plus,
  Trash2,
  ArrowLeftRight,
  ListChecks,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../shared/api/client";
import { useOrgMembers, useProjectTeams } from "../../../shared/api/orgApi";
import {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMember,
} from "../../../shared/api/orgApi";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useFormSchema } from "../../../shared/api/formSchemaApi";
import type { ProblemDetail } from "../../../shared/api/types";
import type { FormFieldSchema, FormSchemaDto } from "../../../shared/types/formSchema";
import {
  buildArtifactListParams,
  useArtifacts,
  useArtifact,
  useCreateArtifact,
  usePermittedTransitions,
  useTransitionArtifact,
  useDeleteArtifact,
  useBatchTransitionArtifacts,
  useBatchDeleteArtifacts,
  useRestoreArtifact,
  type Artifact,
  type PermittedTransitionsResponse,
  type TransitionArtifactRequest,
  type UpdateArtifactRequest,
} from "../../../shared/api/artifactApi";
import {
  useProjectTags,
  useCreateProjectTag,
  useRenameProjectTag,
  useDeleteProjectTag,
} from "../../../shared/api/projectTagApi";
import {
  useTasksByArtifact,
  useMyTasksInProject,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderArtifactTasks,
  fetchTasksForArtifact,
  type Task,
  type CreateTaskRequest,
} from "../../../shared/api/taskApi";
import {
  useArtifactRelationships,
  useArtifactImpactAnalysis,
  useCreateArtifactRelationship,
  useDeleteArtifactRelationship,
  useRelationshipTypeOptions,
} from "../../../shared/api/relationshipApi";
import { useCadences, useAreaNodes } from "../../../shared/api/planningApi";
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  downloadAttachmentBlob,
} from "../../../shared/api/attachmentApi";
import {
  useSavedQueries,
  useCreateSavedQuery,
  listStateToFilterParams,
} from "../../../shared/api/savedQueryApi";
import { useEntityHistory } from "../../../shared/api/auditApi";
import { useListSchema } from "../../../shared/api/listSchemaApi";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { LoadingState } from "../../../shared/components/LoadingState";
import { modalApi, useModalStore } from "../../../shared/modal";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useAuthStore } from "../../../shared/stores/authStore";
import { hasPermission } from "../../../shared/utils/permissions";
import { useCommentsByArtifact } from "../../../shared/api/commentApi";
import { useArtifactStore } from "../../../shared/stores/artifactStore";
import { useRealtimeStore } from "../../../shared/stores/realtimeStore";
import {
  TITLE_MAX_LENGTH,
  formatDateTime,
  filterListSchemaForBacklog,
  getArtifactIcon,
  getManifestChildTypeIdsForParent,
  getValidTransitions,
  isRootArtifact,
  getSystemRootArtifactTypes,
  manifestArtifactTypeAllowsChildren,
} from "../utils";
import { BacklogToolbar, BacklogWorkspaceLayout, BacklogListFooter, BacklogTabularView, BacklogTreeView, ArtifactDetailSurface } from "../components";
import { BacklogArtifactDetailContent } from "../components/BacklogArtifactDetailContent";
import { BacklogTreeTaskPreviewStrip } from "../components/BacklogTreeTaskPreviewStrip";
import { useBacklogWorkspaceProject } from "./useBacklogWorkspaceProject";
import { useBacklogWorkspaceDetailState } from "./useBacklogWorkspaceDetailState";
import { useBacklogWorkspaceListFilters } from "./useBacklogWorkspaceListFilters";
import { useBacklogWorkspaceCreateFlow } from "./useBacklogWorkspaceCreateFlow";
import { getTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import { artifactDetailPath } from "../../../shared/utils/appPaths";

export type ViewMode = "table" | "tree";

export type BacklogWorkspaceVariant = "default" | "quality";

function buildUpdateArtifactPayload(
  schema: FormSchemaDto | null | undefined,
  values: Record<string, unknown>,
  titleMaxLength: number,
): { payload?: UpdateArtifactRequest; errors?: Record<string, string> } {
  const titleTrim = (values.title as string)?.trim();
  if (!titleTrim) {
    return { errors: { title: "Title is required." } };
  }
  if (titleTrim.length > titleMaxLength) {
    return { errors: { title: `Title must be at most ${titleMaxLength} characters.` } };
  }
  const coreKeys = new Set(["title", "description", "assignee_id", "cycle_id", "area_node_id", "tag_ids"]);
  const customFields: Record<string, unknown> = {};
  for (const field of schema?.fields ?? []) {
    if (!coreKeys.has(field.key)) {
      customFields[field.key] = values[field.key] ?? null;
    }
  }
  const tagIds = Array.isArray(values.tag_ids) ? (values.tag_ids as string[]) : [];
  return {
    payload: {
      title: titleTrim,
      description: (values.description as string) || null,
      assignee_id: (values.assignee_id as string) || null,
      cycle_id: (values.cycle_id as string) || null,
      area_node_id: (values.area_node_id as string) || null,
      tag_ids: tagIds,
      ...(Object.keys(customFields).length ? { custom_fields: customFields } : {}),
    },
  };
}

function ProjectTagRowEditor({
  initialName,
  onRename,
  onDelete,
  renamePending,
  deletePending,
}: {
  initialName: string;
  onRename: (name: string) => void;
  onDelete: () => void;
  renamePending: boolean;
  deletePending: boolean;
}) {
  const [name, setName] = useState(initialName);
  useEffect(() => {
    setName(initialName);
  }, [initialName]);
  return (
    <>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1"
        aria-label={`Tag ${initialName}`}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={renamePending || !name.trim() || name.trim() === initialName}
        onClick={() => onRename(name.trim())}
      >
        Rename
      </Button>
      <Button type="button" size="sm" variant="destructive" disabled={deletePending} onClick={onDelete}>
        Delete
      </Button>
    </>
  );
}

export interface BacklogWorkspacePageProps {
  /** `"quality"` — Quality suite route: breadcrumb + default `tree=quality` when manifest includes that tree. */
  variant?: BacklogWorkspaceVariant;
  routeArtifactId?: string;
  detailMode?: "drawer" | "page";
}

export default function BacklogWorkspacePage({
  variant = "default",
  routeArtifactId,
  detailMode = "drawer",
}: BacklogWorkspacePageProps) {
  const { t } = useTranslation("quality");
  const queryClient = useQueryClient();
  const { orgSlug, projectSlug, project, projectsLoading } = useBacklogWorkspaceProject();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const treeRootOptions = useMemo(
    () => getTreeRootsFromManifestBundle(manifest?.manifest_bundle),
    [manifest?.manifest_bundle],
  );
  const systemRootTypes = useMemo(
    () => getSystemRootArtifactTypes(manifest?.manifest_bundle),
    [manifest?.manifest_bundle],
  );
  const validTreeIds = useMemo(() => new Set(treeRootOptions.map((o) => o.tree_id)), [treeRootOptions]);

  /** Quality: `?under=<uuid>` lists direct children of that folder/root within the quality subtree. */
  const underFolderIdFromUrl = useMemo(() => {
    if (variant !== "quality") return null;
    const raw = searchParams.get("under")?.trim() ?? "";
    if (!raw) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
  }, [variant, searchParams]);

  const surface = variant === "quality" ? "quality" : "backlog";
  const { data: listSchema, isLoading: listSchemaLoading, isError: listSchemaError, refetch: refetchListSchema } = useListSchema(orgSlug, project?.id, "artifact", surface);
  const [createFormArtifactTypeId, setCreateFormArtifactTypeId] = useState<string | null>(null);
  const [editModalArtifactType, setEditModalArtifactType] = useState<string | null>(null);
  const defaultArtifactTypeId = useMemo(
    () =>
      (manifest?.manifest_bundle as { artifact_types?: Array<{ id: string }> } | undefined)?.artifact_types?.[0]?.id ??
      "",
    [manifest?.manifest_bundle],
  );
  const effectiveCreateArtifactType = useMemo(() => {
    const t = (createFormArtifactTypeId ?? defaultArtifactTypeId).trim();
    return t || undefined;
  }, [createFormArtifactTypeId, defaultArtifactTypeId]);
  const {
    data: formSchema,
    isError: formSchemaError,
    error: formSchemaErr,
    isFetching: createFormSchemaFetching,
  } = useFormSchema(orgSlug, project?.id, "artifact", "create", effectiveCreateArtifactType, true);
  const { data: artifactEditSchema } = useFormSchema(orgSlug, project?.id, "artifact", "edit");
  const formSchema403 = formSchemaError && (formSchemaErr as unknown as ProblemDetail)?.status === 403;
  const { data: taskCreateFormSchema } = useFormSchema(orgSlug, project?.id, "task", "create");
  const { data: taskEditFormSchema } = useFormSchema(orgSlug, project?.id, "task", "edit");
  const { data: members } = useOrgMembers(orgSlug);
  const { data: projectTeams = [] } = useProjectTeams(orgSlug, project?.id);
  const permissions = useAuthStore((s) => s.permissions);
  const canCommentArtifact = hasPermission(permissions, "artifact:comment");
  useProjectMembers(orgSlug, project?.id);
  useAddProjectMember(orgSlug, project?.id);
  useRemoveProjectMember(orgSlug, project?.id);
  useUpdateProjectMember(orgSlug, project?.id);
  const listState = useArtifactStore((s) => s.listState);
  const setListState = useArtifactStore((s) => s.setListState);
  const backlogTreeDefaultAppliedRef = useRef(false);

  /**
   * Quality route must list only the quality tree (`tree=quality`). Runs in layout so it wins over
   * the store→URL sync effect: otherwise a stale backlog workspace `treeFilter` (e.g. requirement)
   * could write `?tree=requirement` into the URL after navigation and show the wrong subtree.
   */
  useLayoutEffect(() => {
    if (variant !== "quality") return;
    if (!validTreeIds.has("quality")) return;
    if (searchParams.get("tree") === "quality") return;
    setListState({ treeFilter: "quality" });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tree", "quality");
        return next;
      },
      { replace: true },
    );
  }, [variant, validTreeIds, searchParams, setSearchParams, setListState]);

  const setSelectedIds = useArtifactStore((s) => s.setSelectedIds);
  const toggleSelectedId = useArtifactStore((s) => s.toggleSelectedId);
  const clearSelection = useArtifactStore((s) => s.clearSelection);

  const {
    sortBy,
    sortOrder,
    stateFilter,
    typeFilter,
    treeFilter,
    cycleFilter,
    releaseFilter,
    areaNodeFilter,
    tagFilter,
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
  } = listState;
  const selectedIds = useMemo(() => new Set(selectedIdsList), [selectedIdsList]);
  useEffect(() => {
    if (backlogTreeDefaultAppliedRef.current) return;
    backlogTreeDefaultAppliedRef.current = true;
    if (variant !== "default" || detailMode !== "drawer") return;
    if (viewMode === "tree") return;
    setListState({ viewMode: "tree" });
  }, [detailMode, setListState, variant, viewMode]);
  const effectiveListSchema = useMemo(
    () => (surface === "backlog" ? filterListSchemaForBacklog(listSchema) : listSchema),
    [listSchema, surface],
  );

  /**
   * For empty-state copy: default backlog scope is `tree=requirement` — that is not an optional user filter.
   * Quality route always scopes to quality; do not treat tree as a “narrowing filter” there either.
   */
  const treeFilterCountsForEmptyCopy = useMemo(() => {
    if (variant === "quality") return "";
    if (variant === "default" && treeFilter === "requirement") return "";
    return treeFilter;
  }, [variant, treeFilter]);

  const hasActiveArtifactFilters = useMemo(
    () =>
      !!(
        stateFilter ||
        typeFilter ||
        treeFilterCountsForEmptyCopy ||
        cycleFilter ||
        releaseFilter ||
        areaNodeFilter ||
        tagFilter ||
        searchQuery
      ),
    [
      stateFilter,
      typeFilter,
      treeFilterCountsForEmptyCopy,
      cycleFilter,
      releaseFilter,
      areaNodeFilter,
      tagFilter,
      searchQuery,
    ],
  );

  const emptyListTitle = useMemo(
    () =>
      hasActiveArtifactFilters
        ? "No backlog items match your filters"
        : variant === "quality"
          ? "No quality items yet"
          : "No backlog items yet",
    [hasActiveArtifactFilters, variant],
  );

  const emptyListDescription = useMemo(
    () =>
      hasActiveArtifactFilters
        ? "Try clearing filters or changing the tree."
        : variant === "quality"
          ? "Create test cases in catalog groups, or suites, runs, and campaigns in campaign collections."
          : "Create a backlog item or defect to get started.",
    [hasActiveArtifactFilters, variant],
  );

  const emptyTableMessage = useMemo(
    () =>
      hasActiveArtifactFilters
        ? "No backlog items match your filters."
        : variant === "quality"
          ? "No quality items yet. Create one under the Quality tree."
          : "No backlog items yet. Create one to get started.",
    [hasActiveArtifactFilters, variant],
  );

  useEffect(() => {
    setListState({ page: 0 });
  }, [
    stateFilter,
    typeFilter,
    treeFilter,
    cycleFilter,
    areaNodeFilter,
    tagFilter,
    searchQuery,
    underFolderIdFromUrl,
    setListState,
  ]);
  const { data: cadencesFlat = [] } = useCadences(orgSlug, project?.id, true);
  const { data: cycleCadences = [] } = useCadences(orgSlug, project?.id, true, "cycle");
  const { data: releaseCadences = [] } = useCadences(orgSlug, project?.id, true, "release");
  const { data: areaNodesFlat = [] } = useAreaNodes(orgSlug, project?.id, true);
  const { data: savedQueries = [] } = useSavedQueries(orgSlug, project?.id);
  const createSavedQueryMutation = useCreateSavedQuery(orgSlug, project?.id);
  const { toolbarForm, handleClearArtifactFilters } = useBacklogWorkspaceListFilters({
    variant,
    validTreeIds,
    searchParams,
    setSearchParams,
    savedQueries,
    clearSelection,
    setListState,
    searchInput,
    releaseFilter,
    cycleFilter,
    areaNodeFilter,
    tagFilter,
    sortBy,
    sortOrder,
    showDeleted,
    stateFilter,
    typeFilter,
    treeFilter,
  });
  const [_conflictDialogOpen, _setConflictDialogOpen] = useState(false);
  const [_conflictDetail, _setConflictDetail] = useState("");
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const { data: projectTags = [] } = useProjectTags(orgSlug, project?.id);
  const createTagMutation = useCreateProjectTag(orgSlug, project?.id);
  const renameTagMutation = useRenameProjectTag(orgSlug, project?.id);
  const deleteTagMutation = useDeleteProjectTag(orgSlug, project?.id);
  const isTreeSplitView = viewMode === "tree" && detailMode === "drawer";
  /**
   * Quality: always quality subtree. Backlog workspace (default): requirement subtree by default so test cases
   * stay on Quality; `?tree=all` shows every tree (incl. quality).
   */
  const treeForList = useMemo(() => {
    if (variant === "quality" && validTreeIds.has("quality")) return "quality";
    if (variant === "default" && validTreeIds.has("requirement")) {
      const raw = searchParams.get("tree");
      if (raw === "all") return undefined;
      if (raw === null || raw === "") return "requirement";
      if (validTreeIds.has(raw)) return raw;
      return "requirement";
    }
    return treeFilter || undefined;
  }, [variant, validTreeIds, treeFilter, searchParams]);
  const {
    data: listResult,
    isLoading,
    isRefetching,
    isError: artifactsListError,
    error: artifactsListErr,
    refetch: refetchArtifacts,
  } = useArtifacts(
    orgSlug,
    project?.id,
    stateFilter || undefined,
    typeFilter || undefined,
    sortBy,
    sortOrder,
    searchQuery || undefined,
    pageSize,
    page * pageSize,
    showDeleted,
    releaseFilter ? undefined : (cycleFilter || undefined),
    releaseFilter || undefined,
    areaNodeFilter || undefined,
    treeForList,
    false,
    underFolderIdFromUrl,
    tagFilter || undefined,
  );
  const artifacts = useMemo(() => listResult?.items ?? [], [listResult?.items]);
  const totalArtifacts = listResult?.total ?? 0;

  const backlogTraceEnabled =
    import.meta.env.DEV || import.meta.env.VITE_DEBUG_BACKLOG === "true";
  useEffect(() => {
    if (!backlogTraceEnabled || !orgSlug || !project?.id) return;
    console.info("[alm:backlog]", {
      variant,
      orgSlug,
      projectSlug,
      projectId: project.id,
      treeForList: treeForList ?? null,
      total: totalArtifacts,
      pageRows: artifacts.length,
      loading: isLoading,
      listError: artifactsListError,
    });
  }, [
    backlogTraceEnabled,
    variant,
    orgSlug,
    projectSlug,
    project?.id,
    treeForList,
    totalArtifacts,
    artifacts.length,
    isLoading,
    artifactsListError,
  ]);

  /**
   * Parent picker data for create modal.
   *
   * Important for Quality: creating `test-case` etc. must default under a `quality-folder`.
   * The main list is often filtered by `type`, so it may not include folder/root rows.
   */
  const { data: parentPickerResult } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "updated_at",
    "desc",
    undefined,
    500,
    0,
    false,
    undefined,
    undefined,
    undefined,
    treeForList ?? undefined,
    true,
  );
  const parentPickerArtifacts = useMemo(() => parentPickerResult?.items ?? [], [parentPickerResult?.items]);
  const selectedArtifacts = useMemo(
    () => artifacts.filter((a) => selectedIds.has(a.id)),
    [artifacts, selectedIds],
  );
  const canBulkTransition = selectedArtifacts.some((a) => a.allowed_actions?.includes("transition"));
  const canBulkDelete =
    selectedArtifacts.some((a) => a.allowed_actions?.includes("delete")) &&
    !selectedArtifacts.some((a) => isRootArtifact(a, systemRootTypes));
  const detailOrUrlId = detailArtifactId || routeArtifactId || undefined;
  const {
    data: artifactFromApi,
    isError: artifactFromUrlError,
    isFetching: artifactFromUrlFetching,
  } = useArtifact(orgSlug, project?.id, detailOrUrlId);
  const detailDrawerLoadingFromUrl = !!detailOrUrlId && artifactFromUrlFetching && !artifactFromApi;
  const detailArtifact = useMemo(() => {
    if (artifactFromApi) return artifactFromApi;
    return detailOrUrlId ? (artifacts?.find((a) => a.id === detailOrUrlId) ?? null) : null;
  }, [artifactFromApi, detailOrUrlId, artifacts]);
  const [impactDepth, setImpactDepth] = useState(2);
  const [impactRelationshipTypes, setImpactRelationshipTypes] = useState<string[]>(["impacts", "blocks"]);
  const { data: editFormSchema } = useFormSchema(
    orgSlug,
    project?.id,
    "artifact",
    "edit",
    editModalArtifactType ?? undefined,
  );
  const editFormSchemaRef = useRef(editFormSchema);
  editFormSchemaRef.current = editFormSchema;
  const createMutation = useCreateArtifact(orgSlug, project?.id);
  const deleteMutation = useDeleteArtifact(orgSlug, project?.id);
  const [addTaskOpen, _setAddTaskOpen] = useState(false);
  const [, setTaskCreateFormValues] = useState<Record<string, unknown>>({});
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [, setTaskEditFormValues] = useState<Record<string, unknown>>({});
  const { data: tasks = [], isLoading: tasksLoading } = useTasksByArtifact(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const createTaskMutation = useCreateTask(orgSlug, project?.id);
  const updateTaskMutation = useUpdateTask(orgSlug, project?.id);
  const deleteTaskMutation = useDeleteTask(orgSlug, project?.id);
  const reorderTasksMutation = useReorderArtifactTasks(orgSlug, project?.id);

  const { data: myTasks = [], isLoading: myTasksLoading } = useMyTasksInProject(
    orgSlug,
    project?.id,
  );

  const { data: comments = [] } = useCommentsByArtifact(orgSlug, project?.id, detailArtifact?.id);

  const { data: artifactLinks = [], isLoading: linksLoading } = useArtifactRelationships(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const createLinkMutation = useCreateArtifactRelationship(orgSlug, project?.id, detailArtifact?.id);
  const deleteLinkMutation = useDeleteArtifactRelationship(orgSlug, project?.id, detailArtifact?.id);
  const { data: relationshipTypeOptionsData = [] } = useRelationshipTypeOptions(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const { data: attachments = [], isLoading: attachmentsLoading } = useAttachments(
    orgSlug,
    project?.id,
    detailArtifact?.id,
  );
  const uploadAttachmentMutation = useUploadAttachment(orgSlug, project?.id, detailArtifact?.id);
  const deleteAttachmentMutation = useDeleteAttachment(orgSlug, project?.id, detailArtifact?.id);
  const [bulkErrorsExpanded, setBulkErrorsExpanded] = useState(true);
  type AddMemberFormValues = { user_id: string; role: string };
  const addMemberForm = useForm<AddMemberFormValues>({
    defaultValues: { user_id: "", role: "PROJECT_VIEWER" },
  });
  useEffect(() => {
    if (membersDialogOpen) addMemberForm.reset({ user_id: "", role: "PROJECT_VIEWER" });
  }, [membersDialogOpen, addMemberForm]);
  const linkPickerParams = useMemo(
    () =>
      buildArtifactListParams({
        limit: 100,
        offset: 0,
        tree: variant === "quality" && treeForList ? treeForList : undefined,
        includeSystemRoots: variant === "quality" && !!treeForList,
      }),
    [variant, treeForList],
  );
  const { data: pickerArtifactsData } = useQuery({
    queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts", "linkPicker", linkPickerParams],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: Artifact[]; total: number }>(
        `/orgs/${orgSlug}/projects/${project?.id}/artifacts`,
        { params: Object.keys(linkPickerParams).length ? linkPickerParams : undefined },
      );
      return data;
    },
    enabled: !!detailArtifact?.id && !!orgSlug && !!project?.id,
  });
  const pickerArtifacts = pickerArtifactsData?.items ?? [];

  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [myTasksMenuAnchor, setMyTasksMenuAnchor] = useState<null | HTMLElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [tableExpandedArtifactIds, setTableExpandedArtifactIds] = useState<Set<string>>(new Set());
  const expandedArtifactIdsForTasks = useMemo(() => {
    const src = viewMode === "table" ? tableExpandedArtifactIds : expandedIds;
    return Array.from(src).sort();
  }, [viewMode, tableExpandedArtifactIds, expandedIds]);
  const taskTreeQueries = useQueries({
    queries: expandedArtifactIdsForTasks.map((artifactId) => ({
      queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts", artifactId, "tasks", null] as const,
      queryFn: () => fetchTasksForArtifact(orgSlug!, project!.id!, artifactId, null),
      enabled: Boolean(orgSlug && project?.id && expandedArtifactIdsForTasks.length > 0),
    })),
  });
  const expandedTasksByArtifactId = useMemo(() => {
    const m = new Map<string, Task[]>();
    expandedArtifactIdsForTasks.forEach((id, i) => {
      m.set(id, taskTreeQueries[i]?.data ?? []);
    });
    return m;
  }, [expandedArtifactIdsForTasks, taskTreeQueries]);
  const expandedTasksLoadingArtifactIds = useMemo(() => {
    const s = new Set<string>();
    expandedArtifactIdsForTasks.forEach((id, i) => {
      const q = taskTreeQueries[i];
      if (q?.isPending && !q?.data) s.add(id);
    });
    return s;
  }, [expandedArtifactIdsForTasks, taskTreeQueries]);
  const [treeTaskPreview, setTreeTaskPreview] = useState<{ artifactId: string; task: Task } | null>(null);

  useEffect(() => {
    setTreeTaskPreview((prev) => {
      if (!prev) return prev;
      if (detailArtifactId !== prev.artifactId) return null;
      return prev;
    });
  }, [detailArtifactId]);

  const resolvedTreePreviewTask = useMemo(() => {
    if (!treeTaskPreview) return null;
    const tid = treeTaskPreview.task.id;
    const aid = treeTaskPreview.artifactId;
    if (detailArtifactId === aid) {
      const fromDetail = tasks.find((t) => t.id === tid);
      if (fromDetail) return fromDetail;
    }
    const fromExpanded = expandedTasksByArtifactId.get(aid)?.find((t) => t.id === tid);
    return fromExpanded ?? treeTaskPreview.task;
  }, [treeTaskPreview, detailArtifactId, tasks, expandedTasksByArtifactId]);

  const treePreviewArtifact = useMemo(
    () => (treeTaskPreview ? artifacts?.find((a) => a.id === treeTaskPreview.artifactId) ?? null : null),
    [artifacts, treeTaskPreview],
  );

  const [, setEditFormValues] = useState<Record<string, unknown>>({});
  const [, setEditFormErrors] = useState<Record<string, string>>({});
  const editFormValuesRef = useRef<Record<string, unknown>>({});
  const {
    detailDrawerTab,
    setDetailDrawerTab,
    auditTarget,
    setAuditTarget,
  } = useBacklogWorkspaceDetailState({
    detailArtifactId,
  });
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
  const taskFormHideKeys = useMemo(() => {
    const keys: string[] = [];
    if (projectTeams.length <= 1) keys.push("team_id");
    return keys;
  }, [projectTeams.length]);
  const defaultProjectTeamId = useMemo(() => {
    const d = projectTeams.find((t) => t.is_default);
    return d?.id ?? "";
  }, [projectTeams]);
  const soleProjectTeamId = useMemo(
    () => (projectTeams.length === 1 ? (projectTeams[0]?.id ?? null) : null),
    [projectTeams],
  );
  const handleReorderArtifactTasks = useCallback(
    (artifactId: string, orderedTaskIds: string[]) => {
      reorderTasksMutation.mutate(
        { artifactId, orderedTaskIds },
        {
          onSuccess: () => showNotification("Task order updated", "success"),
          onError: (err: Error) => {
            const body = (err as unknown as { body?: ProblemDetail })?.body;
            showNotification(body?.detail ?? "Failed to reorder tasks", "error");
          },
        },
      );
    },
    [reorderTasksMutation, showNotification],
  );
  const recentlyUpdatedArtifactIds = useRealtimeStore((s) => s.recentlyUpdatedArtifactIds);
  const presenceByArtifactId = useRealtimeStore((s) => s.presenceByArtifactId);

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

  const backlogListPath = useMemo(() => {
    if (!orgSlug || !projectSlug) return null;
    const qs = searchParams.toString();
    return qs ? `/${orgSlug}/${projectSlug}/backlog?${qs}` : `/${orgSlug}/${projectSlug}/backlog`;
  }, [orgSlug, projectSlug, searchParams]);
  const isRouteDetailPage = detailMode === "page";

  const openArtifactDetail = useCallback((artifactId: string) => {
    setListState({ detailArtifactId: artifactId, detailDrawerEditing: false });
    if (isTreeSplitView) return;
    if (!orgSlug || !projectSlug) return;
    navigate(
      artifactDetailPath(orgSlug, projectSlug, artifactId) + (searchParams.toString() ? `?${searchParams.toString()}` : ""),
    );
  }, [isTreeSplitView, navigate, orgSlug, projectSlug, searchParams, setListState]);

  const closeArtifactDetail = useCallback(() => {
    setTreeTaskPreview(null);
    setListState({ detailArtifactId: null, detailDrawerEditing: false });
    if (isTreeSplitView) return;
    if (backlogListPath) navigate(backlogListPath);
  }, [backlogListPath, isTreeSplitView, navigate, setListState]);

  const openTaskReadOnlyPreview = useCallback(
    (artifact: Artifact, task: Task) => {
      openArtifactDetail(artifact.id);
      setDetailDrawerTab("tasks");
      setTreeTaskPreview({ artifactId: artifact.id, task });
    },
    [openArtifactDetail, setDetailDrawerTab],
  );

  const toggleTableArtifactExpand = useCallback((artifactId: string) => {
    setTableExpandedArtifactIds((prev) => {
      const next = new Set(prev);
      if (next.has(artifactId)) next.delete(artifactId);
      else next.add(artifactId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (routeArtifactId && artifactFromApi) {
      setListState({ detailArtifactId: routeArtifactId });
    }
  }, [routeArtifactId, artifactFromApi, setListState]);

  useEffect(() => {
    if (routeArtifactId && artifactFromUrlError) {
      showNotification("Artifact not found", "error");
      if (backlogListPath) navigate(backlogListPath);
    }
  }, [routeArtifactId, artifactFromUrlError, showNotification, backlogListPath, navigate]);

  const detailDrawerPrevNext = useMemo(() => {
    if (!detailArtifactId || !artifacts?.length) return { prevId: null, nextId: null };
    const idx = artifacts.findIndex((a) => a.id === detailArtifactId);
    if (idx < 0) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? artifacts[idx - 1]?.id ?? null : null,
      nextId: idx >= 0 && idx < artifacts.length - 1 ? artifacts[idx + 1]?.id ?? null : null,
    };
  }, [artifacts, detailArtifactId]);

  useEffect(() => {
    if (!detailArtifact && !detailDrawerLoadingFromUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeArtifactDetail();
      } else if (e.key === "ArrowLeft" && detailDrawerPrevNext.prevId) {
        openArtifactDetail(detailDrawerPrevNext.prevId);
      } else if (e.key === "ArrowRight" && detailDrawerPrevNext.nextId) {
        openArtifactDetail(detailDrawerPrevNext.nextId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeArtifactDetail, detailArtifact, detailDrawerLoadingFromUrl, detailDrawerPrevNext, openArtifactDetail]);

  const bundle = manifest?.manifest_bundle as {
    artifact_types?: Array<{
      id: string;
      name: string;
      workflow_id?: string;
      parent_types?: string[];
      child_types?: string[];
      fields?: Array<{ id: string; name: string }>;
    }>;
    defs?: unknown[];
    workflows?: Array<{
      id: string;
      states?: string[];
      transitions?: Array<{ from: string; to: string }>;
      state_reason_options?: Array<{ id: string; label: string }>;
      resolution_options?: Array<{ id: string; label: string }>;
      resolution_target_states?: string[];
    }>;
    link_types?: Array<{ id?: string; name?: string; label?: string }>;
  } | undefined;

  const manifestLinkTypeOptions = useMemo(
    () =>
      relationshipTypeOptionsData.map((item) => ({
        value: item.key,
        label: item.label,
        category: item.category,
        allowedTargetTypes: item.allowed_target_types,
        description: item.description,
      })),
    [relationshipTypeOptionsData],
  );
  const impactTypeOptions = useMemo(() => {
    const preferred = manifestLinkTypeOptions.filter(
      (item) => item.value === "impacts" || item.value === "blocks",
    );
    if (preferred.length > 0) {
      return preferred.map((item) => ({ value: item.value, label: item.label }));
    }
    return [
      { value: "impacts", label: "Impacts" },
      { value: "blocks", label: "Blocks" },
    ];
  }, [manifestLinkTypeOptions]);
  useEffect(() => {
    setImpactDepth(2);
    setImpactRelationshipTypes(["impacts", "blocks"]);
  }, [detailArtifact?.id]);
  const {
    data: impactAnalysis,
    isLoading: impactAnalysisLoading,
    refetch: refetchImpactAnalysis,
  } = useArtifactImpactAnalysis(orgSlug, project?.id, detailArtifact?.id, {
    direction: "both",
    depth: impactDepth,
    relationshipTypes: impactRelationshipTypes,
    includeHierarchy: true,
  });

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
      resolutionTargetStates: workflow?.resolution_target_states,
    };
  }, [transitionArtifact, bundle?.workflows, bundle?.artifact_types]);

  const showResolutionField = useMemo(() => {
    if (!transitionTargetState) return false;
    const rts = transitionOptions.resolutionTargetStates;
    if (Array.isArray(rts) && rts.length > 0) {
      return rts.includes(transitionTargetState);
    }
    return ["resolved", "closed", "done"].includes(transitionTargetState.toLowerCase());
  }, [transitionTargetState, transitionOptions.resolutionTargetStates]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- transitionArtifact identity intentionally not in deps
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
  const selectedAuditEntity = useMemo(() => {
    if (!detailArtifact) return null;
    if (auditTarget === "artifact") {
      return { entityType: "Artifact", entityId: detailArtifact.id };
    }
    if (auditTarget.startsWith("task:")) {
      const taskId = auditTarget.slice("task:".length);
      if (taskId) return { entityType: "Task", entityId: taskId };
    }
    return { entityType: "Artifact", entityId: detailArtifact.id };
  }, [auditTarget, detailArtifact]);
  const {
    data: entityHistory,
    isLoading: entityHistoryLoading,
    isError: entityHistoryError,
  } = useEntityHistory(
    selectedAuditEntity?.entityType,
    selectedAuditEntity?.entityId,
    20,
    0,
  );

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

  const syncCreateFormArtifactType = useCallback((artifactTypeId: string | null) => {
    flushSync(() => setCreateFormArtifactTypeId(artifactTypeId));
  }, []);

  const onCreateModalClosed = useCallback(() => {
    setCreateFormArtifactTypeId(null);
  }, []);

  const onEditModalClosed = useCallback(() => {
    setEditModalArtifactType(null);
  }, []);

  const {
    initialFormValues,
    openCreateArtifactModal,
    handleCreateOpen,
  } = useBacklogWorkspaceCreateFlow({
    formSchema,
    formSchemaError: !!formSchemaError,
    formSchema403: !!formSchema403,
    members,
    parentPickerArtifacts,
    artifactTypeParentMap,
    systemRootTypes,
    defaultArtifactTypeId,
    variant,
    underFolderIdFromUrl,
    createMutation,
    setCreateOpen: (isOpen) => setListState({ createOpen: isOpen }),
    showNotification,
    syncCreateFormArtifactType,
    onCreateModalClosed,
  });

  const modalTypeOpen = useModalStore((s) => (s.isOpened ? s.modalType : null));

  useEffect(() => {
    if (modalTypeOpen !== "CreateArtifactModal") return;
    useModalStore.getState().updateModalProps({
      ...(formSchema ? { formSchema } : {}),
      formSchemaRefreshing: !!createFormSchemaFetching && !!formSchema,
    });
  }, [modalTypeOpen, formSchema, createFormSchemaFetching]);

  useEffect(() => {
    if (modalTypeOpen !== "EditArtifactModal") return;
    if (editFormSchema) {
      useModalStore.getState().updateModalProps({ formSchema: editFormSchema });
    }
  }, [modalTypeOpen, editFormSchema]);

  function handleDuplicate(artifact: Artifact) {
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
  }

  const openEditArtifactModal = useCallback(
    (artifact: Artifact) => {
      flushSync(() => setEditModalArtifactType(artifact.artifact_type));
      const schemaForPayload = () => editFormSchemaRef.current ?? null;
      const initialValues: Record<string, unknown> = {
        title: artifact.title,
        description: artifact.description ?? "",
        assignee_id: artifact.assignee_id ?? "",
        cycle_id: artifact.cycle_id ?? "",
        area_node_id: artifact.area_node_id ?? "",
        tag_ids: artifact.tags?.map((tag) => tag.id) ?? [],
        artifact_type: artifact.artifact_type,
        ...(artifact.custom_fields ?? {}),
      };
      editFormValuesRef.current = initialValues;
      setEditFormValues(initialValues);
      setEditFormErrors({});
      modalApi.openEditArtifact(
        {
          mode: "edit",
          formSchema: schemaForPayload(),
          formValues: initialValues,
          formErrors: {},
          onFormChange: (values) => {
            editFormValuesRef.current = values;
            setEditFormValues(values);
            setEditFormErrors({});
          },
          onFormErrors: setEditFormErrors,
          onCreate: async (currentValues) => {
            const values = currentValues ?? editFormValuesRef.current;
            const result = buildUpdateArtifactPayload(schemaForPayload(), values, TITLE_MAX_LENGTH);
            if (result.errors) {
              setEditFormErrors(result.errors);
              if (useModalStore.getState().modalType === "EditArtifactModal") {
                useModalStore.getState().updateModalProps({ formErrors: result.errors });
              }
              return;
            }
            try {
              await apiClient.patch(`/orgs/${orgSlug}/projects/${project?.id}/artifacts/${artifact.id}`, result.payload);
              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts"],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["orgs", orgSlug, "projects", project?.id, "artifacts", artifact.id],
                }),
              ]);
              modalApi.closeModal();
              showNotification("Artifact updated successfully.", "success");
            } catch (error) {
              const body = (error as { body?: ProblemDetail })?.body;
              showNotification(body?.detail ?? "Failed to update artifact", "error");
            }
          },
          isPending: false,
          parentArtifacts:
            parentPickerArtifacts?.map((a) => ({
              id: a.id,
              title: a.title,
              artifact_type: a.artifact_type,
            })) ?? [],
          userOptions:
            members?.map((m) => ({
              id: m.user_id,
              label: m.display_name || m.email || m.user_id,
            })) ?? [],
          artifactTypeParentMap: Object.fromEntries(
            Object.entries(artifactTypeParentMap).filter(([, parentTypes]) => Array.isArray(parentTypes)),
          ) as Record<string, string[]>,
          formSchemaError: !!formSchemaError,
          formSchema403: !!formSchema403,
          hideFieldKeys: ["parent_id"],
          onCloseComplete: onEditModalClosed,
        },
        { title: `Edit: ${artifact.title}` },
      );
    },
    [
      artifactTypeParentMap,
      formSchema403,
      formSchemaError,
      members,
      onEditModalClosed,
      orgSlug,
      parentPickerArtifacts,
      project?.id,
      queryClient,
      showNotification,
    ],
  );

  const taskCreateInitialValues = useMemo(() => {
    const vals: Record<string, unknown> = {};
    for (const f of taskCreateFormSchema?.fields ?? []) {
      if (f.key === "assignee_id") vals[f.key] = "";
      else if (f.type === "tag_list") vals[f.key] = [];
      else if (f.key === "team_id" && projectTeams.length > 1) vals[f.key] = defaultProjectTeamId;
      else vals[f.key] = f.default_value ?? "";
    }
    return vals;
  }, [taskCreateFormSchema?.fields, projectTeams.length, defaultProjectTeamId]);

  useEffect(() => {
    if (addTaskOpen && taskCreateFormSchema) {
      setTaskCreateFormValues(taskCreateInitialValues);
    }
  }, [addTaskOpen, taskCreateFormSchema, taskCreateInitialValues]);

  useEffect(() => {
    if (editingTask && taskEditFormSchema) {
      setTaskEditFormValues({
        title: editingTask.title,
        description: editingTask.description ?? "",
        state: editingTask.state,
        assignee_id: editingTask.assignee_id ?? "",
        team_id: editingTask.team_id ?? "",
        tag_ids: editingTask.tags?.map((x) => x.id) ?? [],
      });
    }
  }, [editingTask, taskEditFormSchema]);

  const payloadFromTaskFormValues = useCallback(
    (v: Record<string, unknown>): CreateTaskRequest => {
      const teamId = soleProjectTeamId ?? ((v.team_id as string) || null);
      return {
        title: (v.title as string)?.trim() ?? "",
        description: (v.description as string) || undefined,
        state: (v.state as string) || "todo",
        assignee_id: (v.assignee_id as string) || null,
        team_id: teamId || null,
        tag_ids: Array.isArray(v.tag_ids) ? (v.tag_ids as string[]) : undefined,
      };
    },
    [soleProjectTeamId],
  );

  const openAddTaskForArtifact = useCallback(
    (artifactId: string) => {
      modalApi.openAddTask({
        taskFormSchema: taskCreateFormSchema ?? null,
        initialValues: taskCreateInitialValues,
        onChange: setTaskCreateFormValues,
        onSubmit: (values) => {
          const title = (values.title as string)?.trim();
          if (!title) return;
          createTaskMutation.mutate(
            { artifactId, ...payloadFromTaskFormValues(values) },
            {
              onSuccess: () => {
                modalApi.closeModal();
                setTaskCreateFormValues({});
                showNotification("Task added", "success");
              },
              onError: (err: Error) => {
                const body = (err as unknown as { body?: ProblemDetail })?.body;
                showNotification(body?.detail ?? "Failed to add task", "error");
              },
            },
          );
        },
        isPending: createTaskMutation.isPending,
        userOptions:
          members?.map((m) => ({
            id: m.user_id,
            label: m.display_name || m.email || m.user_id,
          })) ?? [],
        projectTagOptions: projectTags.map((t) => ({ id: t.id, name: t.name })),
        hideFieldKeys: taskFormHideKeys,
      });
    },
    [
      createTaskMutation,
      members,
      payloadFromTaskFormValues,
      projectTags,
      showNotification,
      taskCreateFormSchema,
      taskCreateInitialValues,
      taskFormHideKeys,
    ],
  );

  const openEditTaskFlow = useCallback(
    (artifact: Artifact, task: Task) => {
      openArtifactDetail(artifact.id);
      setEditingTask(task);
      const editValues = {
        title: task.title,
        description: task.description ?? "",
        state: task.state,
        assignee_id: task.assignee_id ?? "",
        team_id: task.team_id ?? "",
        tag_ids: task.tags?.map((x) => x.id) ?? [],
      };
      modalApi.openEditTask({
        taskFormSchema: taskEditFormSchema ?? null,
        task,
        values: editValues,
        onChange: setTaskEditFormValues,
        onSubmit: (values) => {
          const title = (values.title as string)?.trim();
          if (!title) return;
          const tagIds = Array.isArray(values.tag_ids) ? (values.tag_ids as string[]) : [];
          updateTaskMutation.mutate(
            {
              artifactId: task.artifact_id,
              taskId: task.id,
              title,
              description: (values.description as string) ?? null,
              state: (values.state as string) ?? undefined,
              assignee_id: (values.assignee_id as string) || null,
              team_id: soleProjectTeamId ?? ((values.team_id as string) || null),
              tag_ids: tagIds,
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
        userOptions:
          members?.map((m) => ({
            id: m.user_id,
            label: m.display_name || m.email || m.user_id,
          })) ?? [],
        projectTagOptions: projectTags.map((t) => ({ id: t.id, name: t.name })),
        hideFieldKeys: taskFormHideKeys,
      });
    },
    [
      members,
      openArtifactDetail,
      projectTags,
      showNotification,
      soleProjectTeamId,
      taskEditFormSchema,
      taskFormHideKeys,
      updateTaskMutation,
    ],
  );

  const taskTreePreviewFooter =
    treeTaskPreview &&
    detailArtifactId === treeTaskPreview.artifactId &&
    resolvedTreePreviewTask ? (
      <BacklogTreeTaskPreviewStrip
        task={resolvedTreePreviewTask}
        parentLabel={
          treePreviewArtifact
            ? `[${treePreviewArtifact.artifact_key ?? treePreviewArtifact.id.slice(0, 8)}] ${treePreviewArtifact.title}`
            : "Work item"
        }
        members={members}
        onEdit={() => {
          const art = treePreviewArtifact ?? detailArtifact;
          if (art && resolvedTreePreviewTask) {
            openEditTaskFlow(art, resolvedTreePreviewTask);
          }
        }}
        onDismiss={() => setTreeTaskPreview(null)}
      />
    ) : null;

  const detailTaskPreviewFooter =
    detailDrawerTab === "tasks" || detailDrawerTab === "details" ? null : taskTreePreviewFooter;

  const confirmDeleteTask = useCallback(
    (task: Task) => {
      modalApi.openConfirm(
        {
          message: "Delete this task?",
          confirmLabel: "Delete",
          variant: "destructive",
          onConfirm: () => {
            deleteTaskMutation.mutate(
              { artifactId: task.artifact_id, taskId: task.id },
              {
                onSuccess: () => {
                  setTreeTaskPreview((p) => (p?.task.id === task.id ? null : p));
                  showNotification("Task deleted", "success");
                },
                onError: (err: Error) => {
                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                  showNotification(body?.detail ?? "Failed to delete task", "error");
                },
              },
            );
          },
        },
        { title: "Delete task" },
      );
    },
    [deleteTaskMutation, showNotification],
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const handleImpactToggleRelationshipType = useCallback((relationshipType: string, checked: boolean) => {
    setImpactRelationshipTypes((prev) => {
      if (checked) {
        return prev.includes(relationshipType) ? prev : [...prev, relationshipType];
      }
      return prev.filter((item) => item !== relationshipType);
    });
  }, []);
  const artifactParentIds = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const artifact of artifacts) {
      map.set(artifact.id, artifact.parent_id ?? null);
    }
    return map;
  }, [artifacts]);

  useEffect(() => {
    if (!detailArtifactId) return;
    const next = new Set<string>();
    let currentParentId = artifactParentIds.get(detailArtifactId) ?? detailArtifact?.parent_id ?? null;
    while (currentParentId) {
      next.add(currentParentId);
      currentParentId = artifactParentIds.get(currentParentId) ?? null;
    }
    if (next.size === 0) return;
    setExpandedIds((prev) => {
      let changed = false;
      const merged = new Set(prev);
      for (const id of next) {
        if (!merged.has(id)) {
          merged.add(id);
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
  }, [artifactParentIds, detailArtifact?.parent_id, detailArtifactId]);

  const renderArtifactActionMenu = (artifact: Artifact) => (
      <>
        {artifact.allowed_actions?.includes("create") &&
          manifestArtifactTypeAllowsChildren(manifest?.manifest_bundle, artifact.artifact_type) && (
          <DropdownMenuItem
            onClick={() => {
              const childIds = getManifestChildTypeIdsForParent(manifest?.manifest_bundle, artifact.artifact_type);
              const childArtifactTypeId = childIds[0] ?? defaultArtifactTypeId;
              openCreateArtifactModal(
                {
                  ...initialFormValues,
                  artifact_type: childArtifactTypeId,
                  parent_id: artifact.id,
                },
                { hideFieldKeys: ["parent_id"] },
              );
            }}
          >
            <Plus className="mr-2 size-4" />
            New child
          </DropdownMenuItem>
        )}
        {artifact.allowed_actions?.includes("update") && (
          <DropdownMenuItem onClick={() => openAddTaskForArtifact(artifact.id)}>
            <ListChecks className="mr-2 size-4" />
            Add task
          </DropdownMenuItem>
        )}
        {artifact.allowed_actions?.includes("update") && (
          <DropdownMenuItem onClick={() => openEditArtifactModal(artifact)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
        )}
        {artifact.allowed_actions?.includes("transition") &&
          getValidTransitions(manifest, artifact.artifact_type, artifact.state).map((targetState) => (
            <TransitionMenuItem
              key={targetState}
              artifact={artifact}
              targetState={targetState}
              onSelect={() => handleOpenTransitionDialog(artifact, targetState)}
            />
          ))}
        {artifact.allowed_actions?.includes("transition") &&
          getValidTransitions(manifest, artifact.artifact_type, artifact.state).length === 0 && (
            <DropdownMenuItem disabled>No valid transitions</DropdownMenuItem>
          )}
        {artifact.allowed_actions?.includes("create") && (
          <DropdownMenuItem onClick={() => handleDuplicate(artifact)}>
            <Copy className="mr-2 size-4" />
            Duplicate
          </DropdownMenuItem>
        )}
        {artifact.allowed_actions?.includes("delete") && !isRootArtifact(artifact, systemRootTypes) && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              modalApi.openDeleteArtifact({
                artifact: { id: artifact.id, title: artifact.title, artifact_key: artifact.artifact_key },
                onConfirm: () => {
                  deleteMutation.mutate(artifact.id, {
                    onSuccess: () => {
                      if (detailArtifact?.id === artifact.id) {
                        closeArtifactDetail();
                      }
                      showNotification("Artifact deleted successfully.", "success");
                    },
                    onError: (error: Error) => {
                      const body = (error as unknown as { body?: ProblemDetail })?.body;
                      showNotification(body?.detail ?? "Failed to delete artifact", "error");
                    },
                  });
                },
              });
            }}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        )}
      </>
  );

  function handleOpenTransitionDialog(artifact: Artifact, targetState: string) {
    setListState({
      transitionArtifactId: artifact.id,
      transitionTargetState: targetState,
    });
    setListState({ transitionStateReason: "", transitionResolution: "" });
  }
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

  const detailPanelContent = (
    <BacklogArtifactDetailContent
      detailArtifact={detailArtifact}
      detailLoading={detailDrawerLoadingFromUrl}
      detailTab={detailDrawerTab}
      setDetailTab={setDetailDrawerTab}
      auditTarget={auditTarget}
      setAuditTarget={setAuditTarget}
      canCommentArtifact={canCommentArtifact}
      canEditArtifact={!!detailArtifact?.allowed_actions?.includes("update")}
      hasPrev={!!detailDrawerPrevNext.prevId}
      hasNext={!!detailDrawerPrevNext.nextId}
      onPrev={() => {
        if (detailDrawerPrevNext.prevId) {
          openArtifactDetail(detailDrawerPrevNext.prevId);
        }
      }}
      onNext={() => {
        if (detailDrawerPrevNext.nextId) {
          openArtifactDetail(detailDrawerPrevNext.nextId);
        }
      }}
      onCopyLink={() => {
        if (!detailArtifact || !orgSlug || !projectSlug) return;
        const url = `${window.location.origin}${artifactDetailPath(orgSlug, projectSlug, detailArtifact.id)}`;
        void navigator.clipboard.writeText(url);
        showNotification("Link copied to clipboard", "success");
      }}
      onEdit={() => {
        if (detailArtifact) openEditArtifactModal(detailArtifact);
      }}
      onClose={closeArtifactDetail}
      orgSlug={orgSlug}
      projectId={project?.id}
      projectSlug={projectSlug}
      members={members}
      cadencesFlat={cadencesFlat}
      cycleCadences={cycleCadences.length ? cycleCadences : cadencesFlat}
      areaNodesFlat={areaNodesFlat}
      projectTags={projectTags}
      recentlyUpdatedArtifactIds={recentlyUpdatedArtifactIds}
      presenceByArtifactId={presenceByArtifactId}
      formatDateTime={formatDateTime}
      onOpenTransitionDialog={handleOpenTransitionDialog}
      getValidTransitions={(artifactType, state) => getValidTransitions(manifest, artifactType, state)}
      tasks={tasks}
      tasksLoading={tasksLoading}
      onEditTask={(task) => {
        if (!detailArtifact) return;
        openEditTaskFlow(detailArtifact, task);
      }}
      onDeleteTask={confirmDeleteTask}
      onAddTask={() => {
        if (!detailArtifact) return;
        openAddTaskForArtifact(detailArtifact.id);
      }}
      highlightedDetailTaskId={
        treeTaskPreview && detailArtifact?.id === treeTaskPreview.artifactId ? treeTaskPreview.task.id : null
      }
      onReorderTasksCommitted={
        detailArtifact?.allowed_actions?.includes("update")
          ? (orderedTaskIds) => handleReorderArtifactTasks(detailArtifact.id, orderedTaskIds)
          : undefined
      }
      taskReorderPending={reorderTasksMutation.isPending}
      artifactLinks={artifactLinks}
      linksLoading={linksLoading}
      impactAnalysis={impactAnalysis}
      impactAnalysisLoading={impactAnalysisLoading}
      impactDepth={impactDepth}
      impactRelationshipTypes={impactRelationshipTypes}
      impactTypeOptions={impactTypeOptions}
      onImpactDepthChange={setImpactDepth}
      onImpactToggleRelationshipType={handleImpactToggleRelationshipType}
      onRefreshImpactAnalysis={() => {
        void refetchImpactAnalysis();
      }}
      commentsCount={comments.length}
      onOpenLinkedArtifact={openArtifactDetail}
      onRemoveLink={(link) => {
        modalApi.openConfirm(
          {
            message: "Remove this relationship?",
            confirmLabel: "Remove",
            variant: "destructive",
            onConfirm: () => {
              deleteLinkMutation.mutate(link.id, {
                onError: (err: Error) => {
                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                  showNotification(body?.detail ?? "Failed to remove relationship", "error");
                },
              });
            },
          },
          { title: "Remove relationship" },
        );
      }}
      onAddLink={() => {
        if (!detailArtifact) return;
        modalApi.openAddLink({
          sourceArtifactId: detailArtifact.id,
          artifactOptions: pickerArtifacts
            .filter((a) => a.id !== detailArtifact.id)
            .map((a) => ({
              value: a.id,
              label: `[${a.artifact_key ?? a.id.slice(0, 8)}] ${a.title}`,
              artifactType: a.artifact_type,
            })),
          linkTypeOptions: manifestLinkTypeOptions,
          onCreateLink: (relationshipType, targetArtifactId) => {
            createLinkMutation.mutate(
              { target_artifact_id: targetArtifactId, relationship_type: relationshipType },
              {
                onSuccess: () => {
                  modalApi.closeModal();
                  showNotification("Relationship added", "success");
                },
                onError: (err: Error) => {
                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                  showNotification(body?.detail ?? "Failed to add relationship", "error");
                },
              },
            );
          },
        });
      }}
      attachments={attachments}
      attachmentsLoading={attachmentsLoading}
      onDownloadAttachment={async (attachment) => {
        try {
          const blob = await downloadAttachmentBlob(orgSlug!, project!.id, detailArtifact!.id, attachment.id);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = attachment.file_name;
          link.click();
          URL.revokeObjectURL(url);
        } catch {
          showNotification(t("backlogAttachments.downloadFailed"), "error");
        }
      }}
      onDeleteAttachment={(attachment) => {
        modalApi.openConfirm(
          {
            message: t("backlogAttachments.deletePrompt"),
            confirmLabel: t("backlogAttachments.deleteConfirm"),
            variant: "destructive",
            onConfirm: () => {
              deleteAttachmentMutation.mutate(attachment.id, {
                onError: (err: Error) => {
                  const body = (err as unknown as { body?: ProblemDetail })?.body;
                  showNotification(body?.detail ?? "Failed to delete attachment", "error");
                },
              });
            },
          },
          { title: t("backlogAttachments.deleteTitle") },
        );
      }}
      onUploadAttachments={(files) => {
        for (const file of files) {
          uploadAttachmentMutation.mutate(file, {
            onSuccess: () => showNotification(t("backlogAttachments.uploadSuccess"), "success"),
            onError: (err: Error) => showNotification(err?.message ?? t("backlogAttachments.uploadFailed"), "error"),
          });
        }
      }}
      onRejectedAttachmentFiles={(files) => {
        for (const file of files) {
          showNotification(t("backlogAttachments.fileRejected", { name: file.name }), "error");
        }
      }}
      onDuplicateAttachmentFiles={(files) => {
        for (const file of files) {
          showNotification(t("backlogAttachments.fileDuplicate", { name: file.name }), "error");
        }
      }}
      onAttachmentCaptureResult={(result) => {
        if (result === "added") {
          showNotification(t("backlogAttachments.captureAdded"), "success");
        } else if (result === "unsupported") {
          showNotification(t("backlogAttachments.captureUnsupported"), "error");
        } else {
          showNotification(t("backlogAttachments.captureFailed"), "error");
        }
      }}
      entityHistoryLoading={entityHistoryLoading}
      entityHistoryError={entityHistoryError}
      entityHistory={entityHistory}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[min(1600px,100%)] px-4 py-6">
      <ProjectBreadcrumbs
        currentPageLabel={variant === "quality" ? "Quality" : "Backlog"}
        projectName={project?.name}
      />

      {projectSlug && orgSlug && !projectsLoading && !project ? (
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      ) : projectSlug && orgSlug && projectsLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading project…</div>
      ) : (
        <div>
          <BacklogToolbar
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            project={project ?? undefined}
            listState={listState}
            setListState={setListState}
            toolbarForm={toolbarForm}
            filtersPanelOpen={filtersPanelOpen}
            setFiltersPanelOpen={setFiltersPanelOpen}
            myTasksMenuAnchor={myTasksMenuAnchor}
            setMyTasksMenuAnchor={setMyTasksMenuAnchor}
            filterStates={filterStates}
            bundle={bundle}
            treeRootOptions={treeRootOptions}
            releaseCadenceOptions={releaseCadences}
            cycleNodesFlat={cycleCadences.length ? cycleCadences : cadencesFlat}
            areaNodesFlat={areaNodesFlat}
            savedQueries={savedQueries}
            createSavedQueryMutation={createSavedQueryMutation}
            myTasks={myTasks}
            myTasksLoading={myTasksLoading}
            refetchArtifacts={refetchArtifacts}
            isLoading={isLoading}
            isRefetching={isRefetching}
            artifacts={artifacts}
            members={members}
            listResult={listResult}
            listColumns={effectiveListSchema?.columns}
            onCreateArtifact={handleCreateOpen}
            listStateToFilterParams={listStateToFilterParams}
            showNotification={showNotification}
            projectTagOptions={projectTags.map((t) => ({ id: t.id, name: t.name }))}
            onOpenTagsManager={() => setTagsDialogOpen(true)}
            workItemTreeId={treeForList ?? null}
          />

          {artifactsListError ? (
            <div
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
              role="alert"
            >
              <p className="font-medium text-destructive">Could not load backlog items</p>
              <p className="mt-1 text-muted-foreground">
                {(artifactsListErr as unknown as ProblemDetail | undefined)?.detail ??
                  "Request failed. Check the browser Network tab for the artifacts request, or try again."}
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => refetchArtifacts()}>
                Retry
              </Button>
            </div>
          ) : null}

          <Dialog open={tagsDialogOpen} onOpenChange={setTagsDialogOpen}>
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>Project tags</DialogTitle>
                <DialogDescription className="sr-only">
                  Create, rename, or delete work item tags for this project.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 py-2">
                <Input
                  placeholder="New tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  aria-label="New tag name"
                />
                <Button
                  type="button"
                  disabled={!newTagName.trim() || createTagMutation.isPending}
                  onClick={() => {
                    const n = newTagName.trim();
                    if (!n) return;
                    createTagMutation.mutate(n, {
                      onSuccess: () => {
                        setNewTagName("");
                        showNotification("Tag created", "success");
                      },
                      onError: () => showNotification("Could not create tag", "error"),
                    });
                  }}
                >
                  Add
                </Button>
              </div>
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {projectTags.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 border-b border-border pb-2">
                    <ProjectTagRowEditor
                      initialName={t.name}
                      onRename={(name) =>
                        renameTagMutation.mutate(
                          { tagId: t.id, name },
                          {
                            onSuccess: () => showNotification("Tag renamed", "success"),
                            onError: () => showNotification("Could not rename tag", "error"),
                          },
                        )
                      }
                      onDelete={() =>
                        deleteTagMutation.mutate(t.id, {
                          onSuccess: () => showNotification("Tag deleted", "success"),
                          onError: () => showNotification("Could not delete tag", "error"),
                        })
                      }
                      renamePending={renameTagMutation.isPending}
                      deletePending={deleteTagMutation.isPending}
                    />
                  </li>
                ))}
              </ul>
              {projectTags.length === 0 && (
                <p className="text-sm text-muted-foreground">No tags yet. Add one above.</p>
              )}
            </DialogContent>
          </Dialog>

          <DndProvider backend={HTML5Backend}>
          <BacklogWorkspaceLayout>
          <BacklogListFooter
            bulkActions={
              selectedIds.size > 0 && !showDeleted ? (
                <div className="mb-4 flex items-center gap-4 rounded-md border border-border bg-muted/50 px-4 py-3">
                  <span className="text-sm font-semibold">{selectedIds.size} selected</span>
                  {canBulkTransition && (
                    <Button
                      size="sm"
                      variant="outline"
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
                                      closeArtifactDetail();
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
                      <ArrowLeftRight className="mr-2 size-4" />
                      Transition
                    </Button>
                  )}
                  {canBulkDelete && (
                    <Button
                      size="sm"
                      variant="destructive"
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
                                    closeArtifactDetail();
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
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    Clear selection
                  </Button>
                </div>
              ) : null
            }
            page={page}
            pageSize={pageSize}
            totalArtifacts={totalArtifacts}
            onPageSizeChange={(value) => setListState({ pageSize: value, page: 0 })}
            onPreviousPage={() => setListState({ page: page - 1 })}
            onNextPage={() => setListState({ page: page + 1 })}
          />

          {isLoading ? (
            <div className="rounded-lg border border-border min-h-[320px] flex items-center justify-center">
              <LoadingState label="Loading artifacts…" minHeight={280} />
            </div>
          ) : viewMode === "table" ? (
          <BacklogTabularView
              orgSlug={orgSlug}
              projectId={project?.id}
              effectiveListSchema={effectiveListSchema}
              editFormSchema={artifactEditSchema}
              members={members}
              projectTags={projectTags}
              artifacts={artifacts ?? []}
              renderCell={(row, columnKey, val) =>
                columnKey === "artifact_type" ? (
                  <span className="inline-flex items-center gap-1.5">
                    {getArtifactIcon(row.artifact_type, bundle)}
                    <span className="capitalize">{val != null && val !== "" ? String(val) : "—"}</span>
                  </span>
                ) : columnKey === "tags" ? (
                  <span className="flex max-w-[220px] flex-wrap gap-0.5">
                    {(Array.isArray(val) ? val : row.tags?.map((tag) => tag.id) ?? []).length ? (
                      (Array.isArray(val) ? val : row.tags?.map((tag) => tag.id) ?? []).map((tagId) => {
                        const tag = projectTags.find((item) => item.id === String(tagId));
                        return (
                          <Badge key={String(tagId)} variant="outline" className="px-1 py-0 text-[0.65rem] font-normal">
                            {tag?.name ?? String(tagId)}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                ) : null
              }
              showDeleted={showDeleted}
              selectedKeys={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={handleSelectAllInTable}
              renderRowActions={(row) => (
                <div className="flex items-center justify-end gap-1">
                  {showDeleted && (
                    <Button
                      size="sm"
                      variant="outline"
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {renderArtifactActionMenu(row)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              emptyTableMessage={emptyTableMessage}
              onRowClick={(row) => {
                openArtifactDetail(row.id);
              }}
              isRefetching={isRefetching}
              listSchemaLoading={listSchemaLoading}
              listSchemaError={listSchemaError}
              refetchListSchema={refetchListSchema}
              showNotification={showNotification}
              expandedTableRowKeys={tableExpandedArtifactIds}
              onToggleTableExpandRow={toggleTableArtifactExpand}
              tasksByArtifactId={expandedTasksByArtifactId}
              tasksLoadingArtifactIds={expandedTasksLoadingArtifactIds}
              onOpenTableTask={openTaskReadOnlyPreview}
              onEditTableTask={openEditTaskFlow}
              onDeleteTableTask={(_artifact, task) => confirmDeleteTask(task)}
              selectedTableTask={
                treeTaskPreview
                  ? { artifactId: treeTaskPreview.artifactId, taskId: treeTaskPreview.task.id }
                  : null
              }
            />
          ) : isTreeSplitView ? (
            <div className="grid grid-cols-1 gap-4 xl:[grid-template-columns:minmax(0,1fr)_var(--artifact-detail-track)]">
              <div className="min-w-0">
                <BacklogTreeView
                  artifacts={artifacts ?? []}
                  treeRootOptions={treeRootOptions}
                  iconBundle={bundle}
                  expandedIds={expandedIds}
                  selectedArtifactId={detailArtifactId}
                  onToggleExpand={toggleExpand}
                  onOpenArtifact={openArtifactDetail}
                  onClearFilters={handleClearArtifactFilters}
                  onCreateArtifact={() => handleCreateOpen(defaultArtifactTypeId)}
                  hasActiveArtifactFilters={hasActiveArtifactFilters}
                  emptyListTitle={emptyListTitle}
                  emptyListDescription={emptyListDescription}
                  isRefetching={isRefetching}
                  renderMenuContent={renderArtifactActionMenu}
                  tasksByArtifactId={expandedTasksByArtifactId}
                  tasksLoadingArtifactIds={expandedTasksLoadingArtifactIds}
                  selectedTreeTask={
                    treeTaskPreview
                      ? { artifactId: treeTaskPreview.artifactId, taskId: treeTaskPreview.task.id }
                      : null
                  }
                  onOpenTask={openTaskReadOnlyPreview}
                  onEditTask={openEditTaskFlow}
                  onDeleteTask={(_artifact, task) => confirmDeleteTask(task)}
                  onReorderArtifactTasks={(art, ids) => handleReorderArtifactTasks(art.id, ids)}
                  artifactTaskReorderPending={reorderTasksMutation.isPending}
                />
              </div>
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {detailArtifact || detailDrawerLoadingFromUrl ? (
                    detailPanelContent
                  ) : (
                    <div className="flex h-full min-h-[320px] flex-col justify-center">
                      <h3 className="text-lg font-semibold">Backlog details</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Select an item from the tree to inspect details, tasks, links, attachments, comments, and audit history.
                      </p>
                      {hasActiveArtifactFilters && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Active filters can narrow which items appear in the tree.
                        </p>
                      )}
                      <div className="mt-4">
                        <Button variant="outline" onClick={() => handleCreateOpen(defaultArtifactTypeId)}>
                          New work item
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {detailTaskPreviewFooter}
              </div>
            </div>
          ) : (
            <BacklogTreeView
              artifacts={artifacts ?? []}
              treeRootOptions={treeRootOptions}
              iconBundle={bundle}
              expandedIds={expandedIds}
              selectedArtifactId={detailArtifactId}
              onToggleExpand={toggleExpand}
              onOpenArtifact={openArtifactDetail}
              onClearFilters={handleClearArtifactFilters}
              onCreateArtifact={() => handleCreateOpen(defaultArtifactTypeId)}
              hasActiveArtifactFilters={hasActiveArtifactFilters}
              emptyListTitle={emptyListTitle}
              emptyListDescription={emptyListDescription}
              isRefetching={isRefetching}
              renderMenuContent={renderArtifactActionMenu}
              tasksByArtifactId={expandedTasksByArtifactId}
              tasksLoadingArtifactIds={expandedTasksLoadingArtifactIds}
              selectedTreeTask={
                treeTaskPreview
                  ? { artifactId: treeTaskPreview.artifactId, taskId: treeTaskPreview.task.id }
                  : null
              }
              onOpenTask={openTaskReadOnlyPreview}
              onEditTask={openEditTaskFlow}
              onDeleteTask={(_artifact, task) => confirmDeleteTask(task)}
              onReorderArtifactTasks={(art, ids) => handleReorderArtifactTasks(art.id, ids)}
              artifactTaskReorderPending={reorderTasksMutation.isPending}
            />
          )}

          </BacklogWorkspaceLayout>
          </DndProvider>
        </div>
      )}

      {!isTreeSplitView && (
        <ArtifactDetailSurface
          isPage={isRouteDetailPage}
          open={!!detailArtifact || detailDrawerLoadingFromUrl}
          onOpenChange={(open) => {
            if (!open) {
              closeArtifactDetail();
            }
          }}
          footer={detailTaskPreviewFooter}
        >
          {detailPanelContent}
        </ArtifactDetailSurface>
      )}
    </div>
  );
}

export { BacklogWorkspacePage };

function TransitionMenuItem({
  targetState,
  onSelect,
}: {
  artifact: Artifact;
  targetState: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onSelect}>
      Move to {targetState}
    </DropdownMenuItem>
  );
}
