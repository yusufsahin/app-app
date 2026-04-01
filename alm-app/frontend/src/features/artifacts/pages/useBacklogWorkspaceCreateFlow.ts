import { useMemo, useRef, useState } from "react";
import type { CreateArtifactRequest } from "../../../shared/api/artifactApi";
import type { ProblemDetail } from "../../../shared/api/types";
import type { FormSchemaDto } from "../../../shared/types/formSchema";
import { modalApi, useModalStore } from "../../../shared/modal";
import { buildArtifactCreatePayload } from "../lib/buildArtifactCreatePayload";
import type { BacklogWorkspaceVariant } from "./BacklogWorkspacePage";

interface MemberOption {
  user_id: string;
  display_name?: string;
  email?: string;
}

interface ParentArtifactOption {
  id: string;
  title: string;
  artifact_type: string;
  parent_id?: string | null;
}

interface CreateMutationLike {
  mutateAsync: (payload: CreateArtifactRequest) => Promise<unknown>;
  isPending: boolean;
}

interface UseBacklogWorkspaceCreateFlowArgs {
  formSchema: FormSchemaDto | undefined;
  formSchemaError: boolean;
  formSchema403: boolean;
  members: MemberOption[] | null | undefined;
  parentPickerArtifacts: ParentArtifactOption[] | undefined;
  artifactTypeParentMap: Record<string, string[] | undefined>;
  systemRootTypes: Set<string>;
  defaultArtifactTypeId: string;
  variant: BacklogWorkspaceVariant;
  underFolderIdFromUrl: string | null;
  createMutation: CreateMutationLike;
  setCreateOpen: (isOpen: boolean) => void;
  showNotification: (message: string, type?: "success" | "error" | "warning" | "info") => void;
}

export function useBacklogWorkspaceCreateFlow({
  formSchema,
  formSchemaError,
  formSchema403,
  members,
  parentPickerArtifacts,
  artifactTypeParentMap,
  systemRootTypes,
  defaultArtifactTypeId,
  variant,
  underFolderIdFromUrl,
  createMutation,
  setCreateOpen,
  showNotification,
}: UseBacklogWorkspaceCreateFlowArgs) {
  const [createFormValues, setCreateFormValues] = useState<Record<string, unknown>>({});
  const [createFormErrors, setCreateFormErrors] = useState<Record<string, string>>({});
  const createFormValuesRef = useRef<Record<string, unknown>>({});
  const createArtifactTypeIdRef = useRef<string>("");

  const initialFormValues = useMemo(() => {
    const vals: Record<string, unknown> = {};
    for (const f of formSchema?.fields ?? []) {
      vals[f.key] = f.default_value ?? (f.key === "parent_id" ? null : "");
    }
    return vals;
  }, [formSchema?.fields]);

  const handleCreate = async (currentValues?: Record<string, unknown>) => {
    const currentCreateValues = currentValues ?? createFormValuesRef.current;
    const result = buildArtifactCreatePayload(currentCreateValues, {
      fallbackArtifactType: createArtifactTypeIdRef.current || undefined,
    });
    if (!result.ok) {
      setCreateFormErrors(result.errors);
      if (useModalStore.getState().modalType === "CreateArtifactModal") {
        useModalStore.getState().updateModalProps({ formErrors: result.errors });
      }
      showNotification(result.firstMessage, "error");
      return;
    }

    try {
      await createMutation.mutateAsync(result.payload);
      modalApi.closeModal();
      setCreateOpen(false);
      createFormValuesRef.current = {};
      setCreateFormValues({});
      setCreateFormErrors({});
      createArtifactTypeIdRef.current = "";
      showNotification("Artifact created successfully");
    } catch (err) {
      const problem = err as ProblemDetail;
      const message = problem?.detail ?? (err instanceof Error ? err.message : "Failed to create artifact");
      showNotification(message, "error");
    }
  };

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
    });
  };

  const handleCreateOpen = (artifactTypeId: string) => {
    const typeId = artifactTypeId || defaultArtifactTypeId;
    createArtifactTypeIdRef.current = typeId || "";
    if (!typeId) {
      openCreateArtifactModal(initialFormValues);
      return;
    }

    const parentTypes = artifactTypeParentMap[typeId];
    let defaultParentId: string | null = null;
    if (parentTypes?.length && parentPickerArtifacts?.length) {
      const onlyRoots = parentTypes.every((p) => systemRootTypes.has(p));
      if (onlyRoots) {
        for (const p of parentTypes) {
          const rootArt = parentPickerArtifacts.find((a) => a.artifact_type === p);
          if (rootArt) {
            defaultParentId = rootArt.id;
            break;
          }
        }
      } else if (parentTypes.includes("quality-folder")) {
        const rootQual = parentPickerArtifacts.find((a) => a.artifact_type === "root-quality");
        const firstFolder = parentPickerArtifacts.find(
          (a) => a.artifact_type === "quality-folder" && (rootQual ? a.parent_id === rootQual.id : true),
        );
        if (firstFolder) defaultParentId = firstFolder.id;
        else if (rootQual && parentTypes.includes("root-quality")) defaultParentId = rootQual.id;
      }
    }

    if (
      variant === "quality" &&
      underFolderIdFromUrl &&
      parentTypes?.includes("quality-folder") &&
      parentPickerArtifacts?.length
    ) {
      const pick = parentPickerArtifacts.find((a) => a.id === underFolderIdFromUrl);
      if (pick && (pick.artifact_type === "quality-folder" || pick.artifact_type === "root-quality")) {
        defaultParentId = pick.id;
      }
    }

    openCreateArtifactModal({
      ...initialFormValues,
      artifact_type: typeId,
      parent_id: defaultParentId ?? (initialFormValues.parent_id as string | null) ?? null,
    });
  };

  return {
    initialFormValues,
    createFormValues,
    setCreateFormValues,
    createFormErrors,
    setCreateFormErrors,
    openCreateArtifactModal,
    handleCreate,
    handleCreateOpen,
  };
}
