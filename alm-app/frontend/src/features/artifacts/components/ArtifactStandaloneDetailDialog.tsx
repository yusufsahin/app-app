import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../shared/components/ui";
import { apiClient } from "../../../shared/api/client";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useFormSchema } from "../../../shared/api/formSchemaApi";
import type { ProblemDetail } from "../../../shared/api/types";
import type { FormFieldSchema, FormSchemaDto } from "../../../shared/types/formSchema";
import {
  buildArtifactListParams,
  useArtifact,
  usePermittedTransitions,
  useTransitionArtifact,
  type Artifact,
  type TransitionArtifactRequest,
} from "../../../shared/api/artifactApi";
import { useProjectTags } from "../../../shared/api/projectTagApi";
import {
  useTasksByArtifact,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderArtifactTasks,
  type Task,
  type CreateTaskRequest,
  activityForTaskCreate,
  optionalHoursForCreate,
  hoursForTaskPatch,
  activityForTaskPatch,
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
import { useEntityHistory } from "../../../shared/api/auditApi";
import { useCommentsByArtifact } from "../../../shared/api/commentApi";
import { useScmLinksByArtifact } from "../../../shared/api/scmLinkApi";
import { useOrgMembers, useProjectTeams } from "../../../shared/api/orgApi";
import { modalApi, useModalStore } from "../../../shared/modal";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useRealtimeStore } from "../../../shared/stores/realtimeStore";
import { formatDateTime, getValidTransitions } from "../utils";
import { artifactDetailPath } from "../../../shared/utils/appPaths";
import { BacklogArtifactDetailContent } from "./BacklogArtifactDetailContent";
import { ArtifactDetailPanelBody } from "./ArtifactDetailPanelBody";
import { useBacklogWorkspaceDetailState } from "../pages/useBacklogWorkspaceDetailState";

export interface ArtifactStandaloneDetailDialogProps {
  open: boolean;
  onClose: () => void;
  artifactId: string | null;
  orgSlug: string | undefined;
  projectSlug: string | undefined;
  projectId: string | undefined;
  /** Opens global edit artifact modal (caller supplies schema / picker context). */
  onOpenEditArtifact: (artifact: Artifact) => void;
  canCommentArtifact: boolean;
}

export function ArtifactStandaloneDetailDialog({
  open,
  onClose,
  artifactId,
  orgSlug,
  projectSlug,
  projectId,
  onOpenEditArtifact,
  canCommentArtifact,
}: ArtifactStandaloneDetailDialogProps) {
  const { t } = useTranslation("quality");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showNotification = useNotificationStore((s) => s.showNotification);
  const effectiveId = open && artifactId ? artifactId : null;

  const { data: manifest } = useProjectManifest(orgSlug, projectId);
  const bundle = manifest?.manifest_bundle;
  const { data: members } = useOrgMembers(orgSlug);
  const { data: projectTeams } = useProjectTeams(orgSlug, projectId);
  const { data: projectTags = [] } = useProjectTags(orgSlug, projectId);
  const { data: cadencesFlat = [] } = useCadences(orgSlug, projectId);
  const { data: areaNodesFlat = [] } = useAreaNodes(orgSlug, projectId);
  const cycleCadences = cadencesFlat;

  const {
    data: artifactFromApi,
    isFetching: artifactFetching,
  } = useArtifact(orgSlug, projectId, effectiveId ?? undefined);
  const detailLoading = !!effectiveId && artifactFetching && !artifactFromApi;
  const detailArtifact = artifactFromApi ?? null;

  const {
    detailDrawerTab,
    setDetailDrawerTab,
    auditTarget,
    setAuditTarget,
  } = useBacklogWorkspaceDetailState({
    detailArtifactId: effectiveId,
  });

  const [impactDepth, setImpactDepth] = useState(2);
  const [impactRelationshipTypes, setImpactRelationshipTypes] = useState<string[]>(["impacts", "blocks"]);
  const [transitionTargetState, setTransitionTargetState] = useState<string | null>(null);
  const [transitionStateReason, setTransitionStateReason] = useState("");
  const [transitionResolution, setTransitionResolution] = useState("");

  const { data: taskCreateFormSchema } = useFormSchema(orgSlug, projectId, "task", "create");
  const { data: taskEditFormSchema } = useFormSchema(orgSlug, projectId, "task", "edit");

  const defaultProjectTeamId = useMemo(() => {
    const d = projectTeams?.find((x) => x.is_default);
    return d?.id ?? "";
  }, [projectTeams]);
  const soleProjectTeamId = useMemo(
    () => (projectTeams && projectTeams.length === 1 ? (projectTeams[0]?.id ?? null) : null),
    [projectTeams],
  );
  const taskFormHideKeys = useMemo(() => {
    const keys: string[] = [];
    if ((projectTeams?.length ?? 0) <= 1) keys.push("team_id");
    return keys;
  }, [projectTeams?.length]);

  const taskCreateInitialValues = useMemo(() => {
    const vals: Record<string, unknown> = {};
    for (const f of taskCreateFormSchema?.fields ?? []) {
      if (f.key === "assignee_id") vals[f.key] = "";
      else if (f.type === "tag_list") vals[f.key] = [];
      else if (f.type === "number") vals[f.key] = "";
      else if (f.key === "team_id" && (projectTeams?.length ?? 0) > 1) vals[f.key] = defaultProjectTeamId;
      else vals[f.key] = f.default_value ?? "";
    }
    return vals;
  }, [taskCreateFormSchema?.fields, projectTeams?.length, defaultProjectTeamId]);

  const { data: tasks = [], isLoading: tasksLoading } = useTasksByArtifact(
    orgSlug,
    projectId,
    detailArtifact?.id,
  );
  const createTaskMutation = useCreateTask(orgSlug, projectId);
  const updateTaskMutation = useUpdateTask(orgSlug, projectId);
  const deleteTaskMutation = useDeleteTask(orgSlug, projectId);
  const reorderTasksMutation = useReorderArtifactTasks(orgSlug, projectId);

  const { data: comments = [] } = useCommentsByArtifact(orgSlug, projectId, detailArtifact?.id);
  const { data: scmLinks = [] } = useScmLinksByArtifact(orgSlug, projectId, detailArtifact?.id);
  const { data: artifactLinks = [], isLoading: linksLoading } = useArtifactRelationships(
    orgSlug,
    projectId,
    detailArtifact?.id,
  );
  const createLinkMutation = useCreateArtifactRelationship(orgSlug, projectId, detailArtifact?.id);
  const deleteLinkMutation = useDeleteArtifactRelationship(orgSlug, projectId, detailArtifact?.id);
  const { data: relationshipTypeOptionsData = [] } = useRelationshipTypeOptions(
    orgSlug,
    projectId,
    detailArtifact?.id,
  );
  const { data: attachments = [], isLoading: attachmentsLoading } = useAttachments(
    orgSlug,
    projectId,
    detailArtifact?.id,
  );
  const uploadAttachmentMutation = useUploadAttachment(orgSlug, projectId, detailArtifact?.id);
  const deleteAttachmentMutation = useDeleteAttachment(orgSlug, projectId, detailArtifact?.id);

  const linkPickerParams = useMemo(
    () => buildArtifactListParams({ limit: 500, offset: 0, includeSystemRoots: true }),
    [],
  );
  const { data: pickerArtifactsData } = useQuery({
    queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts", "standaloneLinkPicker", linkPickerParams],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: Artifact[]; total: number }>(
        `/orgs/${orgSlug}/projects/${projectId}/artifacts`,
        { params: Object.keys(linkPickerParams).length ? linkPickerParams : undefined },
      );
      return data;
    },
    enabled: !!detailArtifact?.id && !!orgSlug && !!projectId && open,
  });
  const pickerArtifacts = pickerArtifactsData?.items ?? [];

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
  } = useArtifactImpactAnalysis(orgSlug, projectId, detailArtifact?.id, {
    direction: "both",
    depth: impactDepth,
    relationshipTypes: impactRelationshipTypes,
    includeHierarchy: true,
  });

  const transitionMutation = useTransitionArtifact(orgSlug, projectId, detailArtifact?.id);
  const { data: permittedTransitions } = usePermittedTransitions(orgSlug, projectId, detailArtifact?.id);

  const bundleTyped = bundle as {
    artifact_types?: Array<{ id: string; workflow_id?: string }>;
    workflows?: Array<{
      id: string;
      state_reason_options?: Array<{ id: string; label: string }>;
      resolution_options?: Array<{ id: string; label: string }>;
      resolution_target_states?: string[];
    }>;
  } | undefined;

  const transitionOptions = useMemo(() => {
    if (!detailArtifact || !bundleTyped?.workflows || !bundleTyped?.artifact_types) {
      return { stateReasonOptions: [], resolutionOptions: [], resolutionTargetStates: undefined as string[] | undefined };
    }
    const artifactType = bundleTyped.artifact_types.find((at) => at.id === detailArtifact.artifact_type);
    const workflowId = artifactType?.workflow_id ?? bundleTyped.workflows[0]?.id;
    const workflow = bundleTyped.workflows.find((w) => w.id === workflowId);
    return {
      stateReasonOptions: workflow?.state_reason_options ?? [],
      resolutionOptions: workflow?.resolution_options ?? [],
      resolutionTargetStates: workflow?.resolution_target_states,
    };
  }, [detailArtifact, bundleTyped?.workflows, bundleTyped?.artifact_types]);

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

  const handleCloseTransitionDialog = useCallback(() => {
    setTransitionTargetState(null);
    setTransitionStateReason("");
    setTransitionResolution("");
  }, []);

  const handleConfirmTransition = async () => {
    if (!detailArtifact || !transitionTargetState) return;
    const permitted = permittedTransitions?.items?.find((i) => i.to_state === transitionTargetState);
    const payload: TransitionArtifactRequest = {
      ...(permitted ? { trigger: permitted.trigger } : { new_state: transitionTargetState }),
      state_reason: transitionStateReason.trim() || undefined,
      resolution: transitionResolution.trim() || undefined,
      expected_updated_at: detailArtifact.updated_at ?? undefined,
    };
    try {
      await transitionMutation.mutateAsync(payload);
      modalApi.closeModal();
      handleCloseTransitionDialog();
      showNotification("State updated successfully");
      void queryClient.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"] });
    } catch (err) {
      const problem = err as ProblemDetail & { status?: number };
      if (problem?.status === 409) {
        modalApi.openConflict({
          message: problem?.detail ?? "This artifact was updated by someone else.",
          onOverwrite: () => {
            const p2: TransitionArtifactRequest = {
              ...(permitted ? { trigger: permitted.trigger } : { new_state: transitionTargetState }),
              state_reason: transitionStateReason.trim() || undefined,
              resolution: transitionResolution.trim() || undefined,
              expected_updated_at: undefined,
            };
            transitionMutation.mutate(p2, {
              onSuccess: () => {
                modalApi.closeModal();
                handleCloseTransitionDialog();
                showNotification("State updated successfully", "success");
                void queryClient.invalidateQueries({
                  queryKey: ["orgs", orgSlug, "projects", projectId, "artifacts"],
                });
              },
              onError: (e: Error) => {
                const b = e as unknown as ProblemDetail;
                showNotification(b?.detail ?? "Transition failed", "error");
              },
            });
          },
          onCancel: handleCloseTransitionDialog,
        });
      } else {
        showNotification(problem?.detail ?? "Transition failed. Please try again.", "error");
      }
    }
  };

  useEffect(() => {
    if (!detailArtifact || !transitionTargetState) return;
    const { modalType } = useModalStore.getState();
    if (modalType === "TransitionArtifactModal") return;
    const items = permittedTransitions?.items ?? [];
    modalApi.openTransitionArtifact(
      {
        artifact: {
          id: detailArtifact.id,
          artifact_key: detailArtifact.artifact_key ?? null,
          title: detailArtifact.title,
        },
        targetState: transitionTargetState,
        permittedTransitions: items,
        onSelectTargetState: (state) => setTransitionTargetState(state),
        schema: transitionFormSchema,
        values: transitionFormValues,
        onChange: (v) => {
          setTransitionStateReason((v.state_reason as string) ?? "");
          setTransitionResolution((v.resolution as string) ?? "");
        },
        onConfirm: handleConfirmTransition,
        isPending: transitionMutation.isPending,
        onCloseComplete: handleCloseTransitionDialog,
      },
      { title: `Transition to ${transitionTargetState}` },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open modal when target/artifact changes
  }, [detailArtifact?.id, transitionTargetState]);

  useEffect(() => {
    if (!detailArtifact || !transitionTargetState) return;
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
    detailArtifact,
    detailArtifact?.id,
    transitionTargetState,
    transitionFormSchema,
    transitionFormValues,
    permittedTransitions?.items,
    transitionMutation.isPending,
  ]);

  const handleOpenTransitionDialog = useCallback((_artifact: Artifact, targetState: string) => {
    setTransitionStateReason("");
    setTransitionResolution("");
    setTransitionTargetState(targetState);
  }, []);

  const handleImpactToggleRelationshipType = useCallback((relationshipType: string, checked: boolean) => {
    setImpactRelationshipTypes((prev) => {
      if (checked) {
        return prev.includes(relationshipType) ? prev : [...prev, relationshipType];
      }
      return prev.filter((item) => item !== relationshipType);
    });
  }, []);

  const selectedAuditEntity = useMemo(() => {
    if (!detailArtifact) return null;
    if (auditTarget === "artifact") {
      return { entityType: "Artifact" as const, entityId: detailArtifact.id };
    }
    if (auditTarget.startsWith("task:")) {
      const taskId = auditTarget.slice("task:".length);
      if (taskId) return { entityType: "Task" as const, entityId: taskId };
    }
    return { entityType: "Artifact" as const, entityId: detailArtifact.id };
  }, [auditTarget, detailArtifact]);

  const {
    data: entityHistory,
    isLoading: entityHistoryLoading,
    isError: entityHistoryError,
  } = useEntityHistory(selectedAuditEntity?.entityType, selectedAuditEntity?.entityId, 20, 0);

  const recentlyUpdatedArtifactIds = useRealtimeStore((s) => s.recentlyUpdatedArtifactIds);
  const presenceByArtifactId = useRealtimeStore((s) => s.presenceByArtifactId);

  const payloadFromTaskFormValues = useCallback(
    (v: Record<string, unknown>): CreateTaskRequest => {
      const teamId = soleProjectTeamId ?? ((v.team_id as string) || null);
      const oe = optionalHoursForCreate(v.original_estimate_hours);
      const rw = optionalHoursForCreate(v.remaining_work_hours);
      const act = activityForTaskCreate(v.activity);
      return {
        title: (v.title as string)?.trim() ?? "",
        description: (v.description as string) || undefined,
        state: (v.state as string) || "todo",
        assignee_id: (v.assignee_id as string) || null,
        team_id: teamId || null,
        ...(oe !== undefined ? { original_estimate_hours: oe } : {}),
        ...(rw !== undefined ? { remaining_work_hours: rw } : {}),
        ...(act !== undefined ? { activity: act } : {}),
        tag_ids: Array.isArray(v.tag_ids) ? (v.tag_ids as string[]) : undefined,
      };
    },
    [soleProjectTeamId],
  );

  const openAddTaskForArtifact = useCallback(
    (aid: string) => {
      modalApi.openAddTask({
        taskFormSchema: taskCreateFormSchema ?? null,
        initialValues: taskCreateInitialValues,
        onChange: () => {},
        onSubmit: (values) => {
          const title = (values.title as string)?.trim();
          if (!title) return;
          createTaskMutation.mutate(
            { artifactId: aid, ...payloadFromTaskFormValues(values) },
            {
              onSuccess: () => {
                modalApi.closeModal();
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
    (_artifact: Artifact, task: Task) => {
      const editValues = {
        title: task.title,
        description: task.description ?? "",
        state: task.state,
        assignee_id: task.assignee_id ?? "",
        team_id: task.team_id ?? "",
        original_estimate_hours:
          task.original_estimate_hours != null ? task.original_estimate_hours : "",
        remaining_work_hours: task.remaining_work_hours != null ? task.remaining_work_hours : "",
        activity: task.activity ?? "",
        tag_ids: task.tags?.map((x) => x.id) ?? [],
      };
      modalApi.openEditTask(
        {
          taskFormSchema: taskEditFormSchema ?? null,
          task,
          values: editValues,
          onChange: () => {},
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
                original_estimate_hours: hoursForTaskPatch(values.original_estimate_hours),
                remaining_work_hours: hoursForTaskPatch(values.remaining_work_hours),
                activity: activityForTaskPatch(values.activity),
                tag_ids: tagIds,
              },
              {
                onSuccess: () => {
                  modalApi.closeModal();
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
        },
        { title: `Edit: ${task.title}` },
      );
    },
    [
      members,
      projectTags,
      showNotification,
      soleProjectTeamId,
      taskEditFormSchema,
      taskFormHideKeys,
      updateTaskMutation,
    ],
  );

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
                onSuccess: () => showNotification("Task deleted", "success"),
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

  const handleReorderArtifactTasks = useCallback(
    (artId: string, orderedTaskIds: string[]) => {
      reorderTasksMutation.mutate(
        { artifactId: artId, orderedTaskIds },
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

  const openLinkedArtifact = useCallback(
    (id: string) => {
      if (!orgSlug || !projectSlug) return;
      onClose();
      navigate(artifactDetailPath(orgSlug, projectSlug, id));
    },
    [navigate, onClose, orgSlug, projectSlug],
  );

  const handleOpenEdit = useCallback(() => {
    if (detailArtifact) onOpenEditArtifact(detailArtifact);
  }, [detailArtifact, onOpenEditArtifact]);

  const content = (
    <BacklogArtifactDetailContent
      detailArtifact={detailArtifact}
      detailLoading={detailLoading}
      detailTab={detailDrawerTab}
      setDetailTab={setDetailDrawerTab}
      auditTarget={auditTarget}
      setAuditTarget={setAuditTarget}
      canCommentArtifact={canCommentArtifact}
      canEditArtifact={!!detailArtifact?.allowed_actions?.includes("update")}
      hasPrev={false}
      hasNext={false}
      onPrev={() => {}}
      onNext={() => {}}
      onCopyLink={() => {
        if (!detailArtifact || !orgSlug || !projectSlug) return;
        const url = `${window.location.origin}${artifactDetailPath(orgSlug, projectSlug, detailArtifact.id)}`;
        void navigator.clipboard.writeText(url);
        showNotification("Link copied to clipboard", "success");
      }}
      onEdit={handleOpenEdit}
      onClose={onClose}
      orgSlug={orgSlug}
      projectId={projectId}
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
      highlightedDetailTaskId={null}
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
      scmLinksCount={scmLinks.length}
      onOpenLinkedArtifact={openLinkedArtifact}
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
          if (!orgSlug || !projectId || !detailArtifact) return;
          const blob = await downloadAttachmentBlob(orgSlug, projectId, detailArtifact.id, attachment.id);
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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] w-[min(100vw-2rem,920px)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]"
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only shrink-0 px-4 pt-4 text-left">
          <DialogTitle>Artifact details</DialogTitle>
          <DialogDescription>
            Inspect work item details, tasks, links, attachments, comments, and audit history.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-2 pb-4">
          <ArtifactDetailPanelBody>{content}</ArtifactDetailPanelBody>
        </div>
      </DialogContent>
    </Dialog>
  );
}
