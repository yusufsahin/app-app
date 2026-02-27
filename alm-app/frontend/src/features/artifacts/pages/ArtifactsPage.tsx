import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  Button,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Sheet,
  SheetContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Badge,
} from "../../../shared/components/ui";
import {
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  X,
  Copy,
  Trash2,
  Download,
  Pencil,
  FileText,
  Link as LinkIcon,
  Upload,
  ArrowLeftRight,
  ChevronLeft,
  FilterX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useQuery, useQueries } from "@tanstack/react-query";
import { apiClient } from "../../../shared/api/client";
import {
  useOrgProjects,
  useOrgMembers,
} from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
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
import { MetadataDrivenForm, RhfTextField } from "../../../shared/components/forms";
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
import {
  CORE_FIELD_KEYS,
  TITLE_MAX_LENGTH,
  formatDateTime,
  getArtifactCellValue,
  getArtifactIcon,
  getValidTransitions,
  buildArtifactTree,
  type ArtifactNode,
} from "../utils";
import { ArtifactsToolbar, ArtifactsList, ArtifactDetailDrawer } from "../components";
import type { ToolbarFilterValues } from "../components/ArtifactsToolbar";

export type ViewMode = "table" | "tree";

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
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const project =
    projects?.find((p) => p.slug === projectSlug) ??
    (currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined);
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const { data: listSchema, isLoading: listSchemaLoading, isError: listSchemaError, refetch: refetchListSchema } = useListSchema(orgSlug, project?.id, "artifact");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toolbarForm/savedQueries omitted to avoid sync loops
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
  const createFormValuesRef = useRef<Record<string, unknown>>({});
  /** Type chosen when opening create modal via button (New Epic / New Issue); used as fallback at save so button choice is never lost. */
  const createArtifactTypeIdRef = useRef<string>("");
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [myTasksMenuAnchor, setMyTasksMenuAnchor] = useState<null | HTMLElement>(null);
  const [detailDrawerTab, setDetailDrawerTab] = useState<"details" | "tasks" | "links" | "attachments" | "comments">("details");
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
    setDetailDrawerTab("details");
  }, [detailArtifactId]);

  useEffect(() => {
    if (!detailArtifact && !detailDrawerLoadingFromUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setListState({ detailArtifactId: null, detailDrawerEditing: false });
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.delete("artifact");
          return p;
        });
      } else if (e.key === "ArrowLeft" && detailDrawerPrevNext.prevId) {
        setListState({ detailArtifactId: detailDrawerPrevNext.prevId });
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.set("artifact", detailDrawerPrevNext.prevId!);
          return p;
        });
      } else if (e.key === "ArrowRight" && detailDrawerPrevNext.nextId) {
        setListState({ detailArtifactId: detailDrawerPrevNext.nextId });
        setSearchParams((prev) => {
          const p = new URLSearchParams(prev);
          p.set("artifact", detailDrawerPrevNext.nextId!);
          return p;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailArtifact, detailDrawerLoadingFromUrl, detailDrawerPrevNext, setListState, setSearchParams]);

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

  const openCreateArtifactModal = (initialValues?: Record<string, unknown>) => {
    setCreateFormErrors({});
    const values = initialValues ?? createFormValues;
    createFormValuesRef.current = values;
    setCreateFormValues(values);
    modalApi.openCreateArtifact({
      formSchema: formSchema ?? null,
      formValues: values,
      formErrors: createFormErrors,
      onFormChange: (v) => {
        createFormValuesRef.current = v;
        setCreateFormValues(v);
        setCreateFormErrors({});
      },
      onFormErrors: setCreateFormErrors,
      onCreate: (currentValues) => handleCreate(currentValues),
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

  const defaultArtifactTypeId = useMemo(
    () =>
      bundle?.artifact_types?.[0]?.id ??
      (formSchema?.artifact_type_options?.[0]?.id as string | undefined) ??
      "",
    [bundle?.artifact_types, formSchema?.artifact_type_options],
  );

  const handleCreateOpen = (artifactTypeId: string) => {
    const typeId = artifactTypeId || defaultArtifactTypeId;
    createArtifactTypeIdRef.current = typeId || "";
    if (!typeId) {
      openCreateArtifactModal(initialFormValues);
      return;
    }
    openCreateArtifactModal({ ...initialFormValues, artifact_type: typeId });
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

  const handleCreate = async (currentValues?: Record<string, unknown>) => {
    const currentCreateValues = currentValues ?? createFormValuesRef.current;
    const title = (currentCreateValues.title as string)?.trim();
    const artifactType =
      (currentCreateValues.artifact_type as string)?.trim() || createArtifactTypeIdRef.current?.trim() || "";
    const err: Record<string, string> = {};
    if (!title) err.title = "Title is required.";
    else if (title.length > TITLE_MAX_LENGTH) err.title = `Title must be at most ${TITLE_MAX_LENGTH} characters.`;
    if (!artifactType) err.artifact_type = "Type is required.";
    setCreateFormErrors(err);
    if (Object.keys(err).length > 0) {
      const firstMsg = err.title ?? err.artifact_type ?? "Please fix the form errors.";
      showNotification(firstMsg, "error");
      return;
    }
    const customFields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(currentCreateValues)) {
      if (!CORE_FIELD_KEYS.has(key) && val !== undefined && val !== "" && val !== null) {
        customFields[key] = val;
      }
    }
    const rawParent = (currentCreateValues.parent_id as string | null) ?? null;
    const rawAssignee = (currentCreateValues.assignee_id as string | null) ?? null;
    const payload: CreateArtifactRequest = {
      artifact_type: artifactType ?? "requirement",
      title,
      description: (currentCreateValues.description as string) ?? "",
      parent_id: rawParent && String(rawParent).trim() ? String(rawParent).trim() : null,
      assignee_id: rawAssignee && String(rawAssignee).trim() ? String(rawAssignee).trim() : null,
      custom_fields: Object.keys(customFields).length ? customFields : undefined,
    };
    try {
      await createMutation.mutateAsync(payload);
      modalApi.closeModal();
      setListState({ createOpen: false });
      createFormValuesRef.current = {};
      setCreateFormValues({});
      setCreateFormErrors({});
      createArtifactTypeIdRef.current = "";
      showNotification("Artifact created successfully");
    } catch (err) {
      const problem = err as unknown as ProblemDetail;
      const message = problem?.detail ?? (err instanceof Error ? err.message : "Failed to create artifact");
      showNotification(message, "error");
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

  const handleOpenTransitionDialog = (artifact: Artifact, targetState: string) => {
    setListState({
      transitionArtifactId: artifact.id,
      transitionTargetState: targetState,
    });
    setListState({ transitionStateReason: "", transitionResolution: "" });
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
    <div className="mx-auto max-w-5xl py-6">
      <ProjectBreadcrumbs currentPageLabel="Artifacts" projectName={project?.name} />

      {projectSlug && orgSlug && !projectsLoading && !project ? (
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      ) : projectSlug && orgSlug && projectsLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading project…</div>
      ) : (
        <div>
          <ArtifactsToolbar
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
            cycleNodesFlat={cycleNodesFlat}
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
            onCreateArtifact={handleCreateOpen}
            listStateToFilterParams={listStateToFilterParams}
            showNotification={showNotification}
          />

          <ArtifactsList>
          {selectedIds.size > 0 && !showDeleted && (
            <div className="mb-4 flex items-center gap-4 rounded-md border border-border bg-muted/50 px-4 py-3">
              <span className="text-sm font-semibold">
                {selectedIds.size} selected
              </span>
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
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                Clear selection
              </Button>
            </div>
          )}

          {isLoading ? (
            <Skeleton className="h-[200px] rounded-md" />
          ) : viewMode === "board" ? (
            <div
              className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]"
              style={{ opacity: isRefetching ? 0.8 : 1 }}
              aria-label="Kanban board"
            >
              {filterStates.length === 0 ? (
                <p className="py-8 text-muted-foreground">
                  No workflow states in manifest. Define workflows in Process manifest to use the board.
                </p>
              ) : (
              filterStates.map((state) => (
                <div
                  key={state}
                  className="flex min-w-[240px] max-w-[280px] flex-shrink-0 flex flex-col rounded-lg border bg-muted/50"
                  style={{ width: 260 }}
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
                  <p className="border-b px-3 py-2 text-sm font-semibold">
                    {state.replace(/_/g, " ")}
                  </p>
                  <div className="flex-1 overflow-y-auto p-2 min-h-[120px]">
                    {(artifactsByState[state] ?? []).map((a) => (
                      <div
                        key={a.id}
                        className="mb-2 rounded border p-2 cursor-grab active:cursor-grabbing hover:bg-muted"
                        style={{ cursor: a.allowed_actions?.includes("transition") ? "grab" : "default" }}
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
                        <p className="truncate text-sm font-medium">
                          {a.artifact_key ?? a.id.slice(0, 8)} — {a.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-xs text-muted-foreground">
                            {a.artifact_type}
                          </span>
                          {(a.custom_fields?.priority != null && String(a.custom_fields.priority) !== "") && (
                            <Badge variant="secondary" className="h-[18px] text-[0.7rem]">{String(a.custom_fields.priority)}</Badge>
                          )}
                          {a.assignee_id && (
                            <span className="truncate text-xs text-muted-foreground" title={members?.find((m) => m.user_id === a.assignee_id)?.display_name || members?.find((m) => m.user_id === a.assignee_id)?.email || a.assignee_id}>
                              {(members?.find((m) => m.user_id === a.assignee_id)?.display_name || members?.find((m) => m.user_id === a.assignee_id)?.email || a.assignee_id).slice(0, 14)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
              )}
            </div>
          ) : viewMode === "table" && listSchema ? (
            <div className="transition-opacity duration-200" style={{ opacity: isRefetching ? 0.7 : 1 }}>
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
                hideFilters
                selectionColumn={!showDeleted}
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
                        {row.allowed_actions?.includes("transition") &&
                          getValidTransitions(manifest, row.artifact_type, row.state).map((targetState) => (
                            <TransitionMenuItem
                              key={targetState}
                              artifact={row}
                              targetState={targetState}
                              onSelect={() => handleOpenTransitionDialog(row, targetState)}
                            />
                          ))}
                        {row.allowed_actions?.includes("transition") &&
                          getValidTransitions(manifest, row.artifact_type, row.state).length === 0 && (
                            <DropdownMenuItem disabled>No valid transitions</DropdownMenuItem>
                          )}
                        {row.allowed_actions?.includes("create") && (
                          <DropdownMenuItem onClick={() => handleDuplicate(row)}>
                            <Copy className="mr-2 size-4" />
                            Duplicate
                          </DropdownMenuItem>
                        )}
                        {row.allowed_actions?.includes("delete") && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              modalApi.openDeleteArtifact({
                                artifact: { id: row.id, title: row.title, artifact_key: row.artifact_key },
                                onConfirm: () => {
                                  deleteMutation.mutate(row.id, {
                                    onSuccess: () => {
                                      if (detailArtifact?.id === row.id) {
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
            </div>
          ) : viewMode === "table" ? (
            <div className="rounded-lg border p-8 text-center">
              {listSchemaLoading ? (
                <p className="text-muted-foreground">Loading list schema…</p>
              ) : listSchemaError ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-muted-foreground">
                    Could not load list schema. Switch to Board or Tree view, or try again.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetchListSchema()}>
                    Try again
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  List schema is not available. Switch to Board or Tree view, or try again later.
                </p>
              )}
            </div>
          ) : (
            <div
              className="rounded-lg border transition-opacity duration-200"
              style={{ opacity: isRefetching ? 0.7 : 1 }}
            >
              {artifacts?.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                  <p className="text-muted-foreground">
                    {(stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchQuery)
                      ? "No artifacts match your filters."
                      : "No artifacts yet. Create one to get started."}
                  </p>
                  {(stateFilter || typeFilter || cycleNodeFilter || areaNodeFilter || searchQuery) && (
                    <Button
                      size="sm"
                      onClick={() =>
                        setListState({
                          stateFilter: "",
                          typeFilter: "",
                          searchInput: "",
                          page: 0,
                        })
                      }
                    >
                      <FilterX className="size-4" />
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="list-none p-0">
                  {buildArtifactTree(artifacts ?? []).map((node) => (
                    <ArtifactTreeNode
                      key={node.id}
                      node={node}
                      manifest={manifest}
                      customFieldColumns={customFieldColumns}
                      renderMenuContent={(artifact) => (
                        <>
                          {artifact.allowed_actions?.includes("transition") &&
                            getValidTransitions(manifest, artifact.artifact_type, artifact.state).map((targetState) => (
                              <TransitionMenuItem
                                key={targetState}
                                artifact={artifact}
                                targetState={targetState}
                                onSelect={() => handleOpenTransitionDialog(artifact, targetState)}
                              />
                            ))}
                          {artifact.allowed_actions?.includes("create") && (
                            <DropdownMenuItem onClick={() => handleDuplicate(artifact)}>
                              <Copy className="mr-2 size-4" />
                              Duplicate
                            </DropdownMenuItem>
                          )}
                          {artifact.allowed_actions?.includes("delete") && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                modalApi.openDeleteArtifact({
                                  artifact: { id: artifact.id, title: artifact.title, artifact_key: artifact.artifact_key },
                                  onConfirm: () => {
                                    deleteMutation.mutate(artifact.id, {
                                      onSuccess: () => {
                                        if (detailArtifact?.id === artifact.id) {
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
                      )}
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
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2">
            <span className="text-sm text-muted-foreground">Per page:</span>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e) =>
                setListState({ pageSize: parseInt(e.target.value, 10), page: 0 })
              }
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">
              {page * pageSize + 1}-{Math.min(page * pageSize + pageSize, totalArtifacts)} of {totalArtifacts}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setListState({ page: page - 1 })}
                disabled={page <= 0}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setListState({ page: page + 1 })}
                disabled={page >= Math.ceil(totalArtifacts / pageSize) - 1}
              >
                Next
              </Button>
            </div>
          </div>

          </ArtifactsList>
        </div>
      )}

      <Sheet
        open={!!detailArtifact || detailDrawerLoadingFromUrl}
        onOpenChange={(open) => {
          if (!open) {
            setListState({ detailArtifactId: null, detailDrawerEditing: false });
            setSearchParams((prev) => {
              const p = new URLSearchParams(prev);
              p.delete("artifact");
              return p;
            });
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-[420px] p-4" aria-label="Artifact details">
        <ArtifactDetailDrawer>
        <div className="w-full sm:w-[420px] p-4" role="document" aria-label="Artifact details">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {detailArtifact && !detailDrawerLoadingFromUrl && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                        onClick={() => {
                          if (detailDrawerPrevNext.prevId) {
                            setListState({ detailArtifactId: detailDrawerPrevNext.prevId });
                            setSearchParams((prev) => {
                              const p = new URLSearchParams(prev);
                              p.set("artifact", detailDrawerPrevNext.prevId!);
                              return p;
                            });
                          }
                        }}
                        disabled={!detailDrawerPrevNext.prevId}
                        aria-label="Previous artifact"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Previous artifact</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                        onClick={() => {
                          if (detailDrawerPrevNext.nextId) {
                            setListState({ detailArtifactId: detailDrawerPrevNext.nextId });
                            setSearchParams((prev) => {
                              const p = new URLSearchParams(prev);
                              p.set("artifact", detailDrawerPrevNext.nextId!);
                              return p;
                            });
                          }
                        }}
                        disabled={!detailDrawerPrevNext.nextId}
                        aria-label="Next artifact"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Next artifact</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
            <h2 className="min-w-0 flex-1 text-lg font-semibold">Artifact details</h2>
            <div className="flex gap-1">
              {detailDrawerLoadingFromUrl && (
                <span className="text-sm text-muted-foreground">Loading…</span>
              )}
              {detailArtifact && !detailDrawerEditing && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}?artifact=${detailArtifact.id}`;
                          void navigator.clipboard.writeText(url);
                          showNotification("Link copied to clipboard", "success");
                        }}
                        aria-label="Copy link to artifact"
                      >
                        <LinkIcon className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Copy link</TooltipContent>
                  </Tooltip>
                  {detailArtifact.allowed_actions?.includes("update") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
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
                          aria-label="Edit artifact"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                  )}
                </>
              )}
              {!detailDrawerLoadingFromUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                      onClick={() => {
                        setListState({ detailArtifactId: null, detailDrawerEditing: false });
                        setSearchParams((prev) => {
                          const p = new URLSearchParams(prev);
                          p.delete("artifact");
                          return p;
                        });
                      }}
                      aria-label="Close"
                    >
                      <X className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Close (Escape)</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {detailDrawerLoadingFromUrl && (
            <div className="py-4">
              <Skeleton className="mb-2 h-6 w-[60%]" />
              <Skeleton className="mb-4 h-8 w-[90%]" />
              <Skeleton className="h-20 rounded-md" />
            </div>
          )}
          {detailArtifact && !detailDrawerLoadingFromUrl && (
            <>
              <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {detailArtifact.artifact_key ?? detailArtifact.id}
              </p>
              {detailDrawerEditing ? (
                <div className="mt-2">
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
                    <p className="text-muted-foreground">Loading form…</p>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setListState({ detailDrawerEditing: false })}
                      disabled={updateArtifactMutation.isPending}
                    >
                      Cancel
                    </Button>
                    {editFormSchema && (
                      <Button
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
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="mb-2 mt-1 text-lg font-semibold">
                    {detailArtifact.title}
                  </h3>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Type: {detailArtifact.artifact_type} · State: {detailArtifact.state}
                  </p>
                  {!detailDrawerEditing && (detailArtifact.created_at || detailArtifact.updated_at) && (
                    <p className="mb-2 text-sm text-muted-foreground">
                      {detailArtifact.created_at && <>Created: {formatDateTime(detailArtifact.created_at)}</>}
                      {detailArtifact.created_at && detailArtifact.updated_at && " · "}
                      {detailArtifact.updated_at && <>Updated: {formatDateTime(detailArtifact.updated_at)}</>}
                    </p>
                  )}
                  {!detailDrawerEditing && detailArtifact.assignee_id && (
                    <p className="mb-2 text-sm">
                      <strong>Assignee:</strong>{" "}
                      {members?.find((m) => m.user_id === detailArtifact.assignee_id)?.display_name ||
                        members?.find((m) => m.user_id === detailArtifact.assignee_id)?.email ||
                        detailArtifact.assignee_id}
                    </p>
                  )}
                  {!detailDrawerEditing &&
                    detailArtifact.allowed_actions?.includes("transition") &&
                    getValidTransitions(
                      manifest,
                      detailArtifact.artifact_type,
                      detailArtifact.state,
                    ).length > 0 && (
                    <div className="mb-4 mt-3">
                      <div className="flex flex-wrap gap-2">
                        {getValidTransitions(
                          manifest,
                          detailArtifact.artifact_type,
                          detailArtifact.state,
                        ).map((targetState) => (
                          <Button
                            key={targetState}
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleOpenTransitionDialog(detailArtifact, targetState);
                            }}
                          >
                            Move to {targetState}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Tabs value={detailDrawerTab} onValueChange={(v) => setDetailDrawerTab(v as typeof detailDrawerTab)} className="mb-2 min-h-[40px]">
                    <TabsList className="w-full">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
                      <TabsTrigger value="links">Links ({artifactLinks.length})</TabsTrigger>
                      <TabsTrigger value="attachments">Attachments ({attachments.length})</TabsTrigger>
                      <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
                    </TabsList>
                  <TabsContent value="details" className="py-2">
                      {detailArtifact.description && (
                        <p className="mb-4 text-sm">{detailArtifact.description}</p>
                      )}
                      {detailArtifact.state_reason && (
                        <p className="mb-2 text-sm">
                          <strong>State reason:</strong> {detailArtifact.state_reason}
                        </p>
                      )}
                      {detailArtifact.resolution && (
                        <p className="mb-4 text-sm">
                          <strong>Resolution:</strong> {detailArtifact.resolution}
                        </p>
                      )}
                      {(detailArtifact.cycle_node_id || detailArtifact.area_node_id) && (
                        <p className="mb-4 text-sm">
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
                        </p>
                      )}
                      {detailArtifact.custom_fields && Object.keys(detailArtifact.custom_fields).length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-sm font-medium text-muted-foreground">Custom fields</p>
                          {Object.entries(detailArtifact.custom_fields).map(([key, val]) => (
                            <p key={key} className="text-sm">
                              {key}: {String(val)}
                            </p>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  {detailDrawerTab === "tasks" && (
                    <TabsContent value="tasks" className="py-2">
                  {tasksLoading ? (
                    <Skeleton className="h-16 rounded-md" />
                  ) : (
                    <>
                      <ul className="space-y-1">
                        {tasks.map((task) => (
                          <li
                            key={task.id}
                            className="flex items-center justify-between gap-2 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{task.title}</p>
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant="outline" className="text-xs">{task.state}</Badge>
                                {task.assignee_id &&
                                  (members?.find((m) => m.user_id === task.assignee_id)?.display_name ||
                                    members?.find((m) => m.user_id === task.assignee_id)?.email ||
                                    task.assignee_id)}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
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
                                  <Pencil className="size-4" />
                                </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted text-destructive"
                                aria-label="Delete task"
                                onClick={() => {
                                  modalApi.openConfirm(
                                    {
                                      message: "Delete this task?",
                                      confirmLabel: "Delete",
                                      variant: "destructive",
                                      onConfirm: () => {
                                        deleteTaskMutation.mutate(task.id, {
                                          onError: (err: Error) => {
                                            const body = (err as unknown as { body?: ProblemDetail })?.body;
                                            showNotification(
                                              body?.detail ?? "Failed to delete task",
                                              "error",
                                            );
                                          },
                                        });
                                      },
                                    },
                                    { title: "Delete task" },
                                  );
                                }}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        className="mt-2"
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
                        <Plus className="size-4" />
                        Add task
                      </Button>
                    </>
                  )}
                    </TabsContent>
                  )}
                  {detailDrawerTab === "links" && (
                    <TabsContent value="links" className="py-2">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Links</p>
                  {linksLoading ? (
                    <Skeleton className="h-16 rounded-md" />
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {artifactLinks.map((link: ArtifactLink) => {
                          const otherId =
                            link.from_artifact_id === detailArtifact?.id
                              ? link.to_artifact_id
                              : link.from_artifact_id;
                          const isOutgoing = link.from_artifact_id === detailArtifact?.id;
                          const otherArtifact = artifacts?.find((a) => a.id === otherId);
                          const otherTitle = otherArtifact?.title ?? `Artifact ${otherId.slice(0, 8)}…`;
                          return (
                            <li key={link.id} className="flex items-center justify-between gap-2 py-1">
                              <div>
                                <Link
                                  to={`/${orgSlug}/${projectSlug}/artifacts?artifact=${otherId}`}
                                  className="font-medium text-foreground hover:underline"
                                  onClick={() => setListState({ detailArtifactId: otherId })}
                                >
                                  {otherTitle}
                                </Link>
                                <Badge variant="secondary" className="ml-1 text-xs">{isOutgoing ? "→" : "←"} {link.link_type}</Badge>
                              </div>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted text-destructive"
                                aria-label="Remove link"
                                onClick={() => {
                                  modalApi.openConfirm(
                                    {
                                      message: "Remove this link?",
                                      confirmLabel: "Remove",
                                      variant: "destructive",
                                      onConfirm: () => {
                                        deleteLinkMutation.mutate(link.id, {
                                          onError: (err: Error) => {
                                            const body = (err as unknown as { body?: ProblemDetail })?.body;
                                            showNotification(
                                              body?.detail ?? "Failed to remove link",
                                              "error",
                                            );
                                          },
                                        });
                                      },
                                    },
                                    { title: "Remove link" },
                                  );
                                }}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <Button
                        size="sm"
                        className="mt-2"
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
                    </TabsContent>
                  )}
                  {detailDrawerTab === "attachments" && (
                    <TabsContent value="attachments" className="py-2">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Attachments</p>
                  {attachmentsLoading ? (
                    <Skeleton className="h-16 rounded-md" />
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {attachments.map((att: AttachmentType) => (
                          <li key={att.id} className="flex items-center justify-between gap-2 py-1">
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{att.file_name}</p>
                                <p className="text-xs text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
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
                                <Download className="size-4" />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted text-destructive"
                                aria-label="Delete attachment"
                                onClick={() => {
                                  modalApi.openConfirm(
                                    {
                                      message: "Delete this attachment?",
                                      confirmLabel: "Delete",
                                      variant: "destructive",
                                      onConfirm: () => {
                                        deleteAttachmentMutation.mutate(att.id, {
                                          onError: (err: Error) => {
                                            const body = (err as unknown as { body?: ProblemDetail })?.body;
                                            showNotification(
                                              body?.detail ?? "Failed to delete attachment",
                                              "error",
                                            );
                                          },
                                        });
                                      },
                                    },
                                    { title: "Delete attachment" },
                                  );
                                }}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        className="mt-2"
                        asChild
                      >
                        <label className="cursor-pointer">
                          <Upload className="size-4" />
                          Upload file
                          <input
                            type="file"
                            className="hidden"
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
                        </label>
                      </Button>
                    </>
                  )}
                    </TabsContent>
                  )}
                  {detailDrawerTab === "comments" && (
                    <TabsContent value="comments" className="py-2">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Comments</p>
                  {commentsLoading ? (
                    <Skeleton className="h-16 rounded-md" />
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {comments.map((c) => (
                          <li key={c.id} className="flex flex-col gap-0.5 py-1">
                            <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.created_by
                                ? (members?.find((m) => m.user_id === c.created_by)?.display_name ||
                                    members?.find((m) => m.user_id === c.created_by)?.email ||
                                    c.created_by)
                                : "Unknown"}{" "}
                              · {formatDateTime(c.created_at)}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-col gap-2">
                        <FormProvider {...commentForm}>
                          <form
                            className="flex flex-col gap-2"
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
                          >
                            <RhfTextField<CommentFormValues>
                              name="body"
                              label=""
                              placeholder="Add a comment..."
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={!commentBody?.trim() || createCommentMutation.isPending}
                            >
                              Add comment
                            </Button>
                          </form>
                        </FormProvider>
                      </div>
                    </>
                  )}
                    </TabsContent>
                  )}
                  </Tabs>
                </>
              )}
            </>
          )}
        </div>
        </ArtifactDetailDrawer>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ArtifactTreeNode({
  node,
  manifest,
  customFieldColumns,
  renderMenuContent,
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
  renderMenuContent: (artifact: Artifact) => React.ReactNode;
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
      <div
        className="flex items-center gap-2 border-b py-2"
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => onSelect?.(node)}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onKeyDown={onSelect ? (e) => e.key === "Enter" && onSelect(node) : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            className="mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="inline-block w-8" />
        )}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {node.artifact_key && (
            <span className="min-w-[56px] font-mono text-sm text-muted-foreground">
              {node.artifact_key}
            </span>
          )}
          {getArtifactIcon(node.artifact_type)}
          <span className="text-sm capitalize text-muted-foreground">{node.artifact_type}</span>
          <span className="truncate font-medium">{node.title}</span>
          <Badge variant="outline" className="ml-1 text-xs">{node.state}</Badge>
          {node.state_reason && (
            <span className="ml-1 text-xs text-muted-foreground">{node.state_reason}</span>
          )}
          {node.resolution && (
            <span className="ml-1 text-xs text-muted-foreground">· {node.resolution}</span>
          )}
          {customFieldColumns.slice(0, 2).map(
            (c) =>
              node.custom_fields?.[c.key] != null && (
                <Badge key={c.key} className="ml-1 h-5 text-[0.7rem]">
                  {c.label}: {String(node.custom_fields![c.key])}
                </Badge>
              ),
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
              aria-label="Actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {renderMenuContent(node)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <ArtifactTreeNode
              key={child.id}
              node={child}
              manifest={manifest}
              customFieldColumns={customFieldColumns}
              renderMenuContent={renderMenuContent}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
              orgSlug={orgSlug}
              projectId={projectId}
            />
          ))}
        </div>
      )}
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
    <DropdownMenuItem onClick={onSelect}>
      Move to {targetState}
    </DropdownMenuItem>
  );
}
