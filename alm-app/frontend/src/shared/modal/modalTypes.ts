
/** Generic confirm (delete, overwrite, etc.) */
export type ConfirmModalProps = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
};

/** Delete single artifact */
export type DeleteArtifactModalProps = {
  artifact: { id: string; title: string; artifact_key?: string | null };
  onConfirm: () => void;
};

/** Create artifact – parent provides schema and form state */
export type CreateArtifactModalProps = {
  formSchema: import("@/shared/types/formSchema").FormSchemaDto | null;
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  onFormChange: (v: Record<string, unknown>) => void;
  onFormErrors: (e: Record<string, string>) => void;
  /** Called on Save; parent may pass no args and read state, or modal may call with current form values to avoid stale state. */
  onCreate: (currentValues?: Record<string, unknown>) => void;
  isPending: boolean;
  parentArtifacts: Array<{ id: string; title: string; artifact_type: string }>;
  userOptions: Array<{ id: string; label: string }>;
  artifactTypeParentMap: Record<string, string[]>;
  formSchemaError?: boolean;
  formSchema403?: boolean;
};

/** Add task – parent provides schema; modal passes current values to onSubmit */
export type AddTaskModalProps = {
  taskFormSchema: import("@/shared/types/formSchema").FormSchemaDto | null;
  initialValues: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  onSubmit: (values: Record<string, unknown>) => void;
  isPending: boolean;
  userOptions: Array<{ id: string; label: string }>;
  projectTagOptions?: Array<{ id: string; name: string }>;
};

/** Edit task – parent provides schema; modal passes current values to onSubmit */
export type EditTaskModalProps = {
  taskFormSchema: import("@/shared/types/formSchema").FormSchemaDto | null;
  task: {
    id: string;
    title: string;
    description?: string | null;
    state?: string;
    assignee_id?: string | null;
    rank_order?: number | null;
    tags?: Array<{ id: string; name: string }>;
  };
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  onSubmit: (values: Record<string, unknown>) => void;
  isPending: boolean;
  userOptions: Array<{ id: string; label: string }>;
  projectTagOptions?: Array<{ id: string; name: string }>;
};

/** Add link */
export type AddLinkModalProps = {
  sourceArtifactId: string;
  artifactOptions: Array<{ value: string; label: string }>;
  /** When set (non-empty), replaces built-in link type presets (from project manifest link_types). */
  linkTypeOptions?: Array<{ value: string; label: string }>;
  onCreateLink: (linkType: string, targetArtifactId: string) => void;
};

/** Save query */
export type SaveQueryModalProps = {
  initialName?: string;
  initialVisibility?: string;
  onSave: (name: string, visibility: string) => void;
};

/** Project members */
export type ProjectMembersModalProps = {
  orgSlug: string;
  projectId: string;
  projectName: string;
};

/** Bulk transition – parent owns form state and mutation */
export type BulkTransitionModalProps = {
  selectedCount: number;
  commonTriggers: Array<{ trigger: string; to_state: string; label?: string | null }>;
  currentTrigger: string;
  onSelectTrigger: (trigger: string) => void;
  stateOptions: Array<{ value: string; label: string }>;
  transitionSchema: import("@/shared/types/formSchema").FormSchemaDto | null;
  transitionValues: Record<string, unknown>;
  onTransitionFormChange: (v: Record<string, unknown>) => void;
  lastResult: {
    success_count: number;
    error_count: number;
    errors: string[];
    results?: Record<string, string>;
  } | null;
  errorsExpanded: boolean;
  onToggleErrors: () => void;
  /** Called with current form values when user clicks Transition. */
  onConfirm: (payload: {
    trigger: string;
    state: string;
    state_reason: string;
    resolution: string;
  }) => void;
  isPending: boolean;
  confirmDisabled: boolean;
  /** When selecting a state, show this many items cannot transition. */
  invalidCount?: number;
  /** Called when modal is closed (cancel/close) so parent can clear its state. */
  onCloseComplete?: () => void;
};

/** Bulk delete confirm */
export type BulkDeleteModalProps = {
  selectedIds: string[];
  onConfirm: () => void;
};

/** Single artifact transition – parent owns form state */
export type TransitionArtifactModalProps = {
  artifact: { id: string; artifact_key?: string | null; title: string };
  targetState: string;
  permittedTransitions: Array<{ trigger: string; to_state: string; label?: string | null }>;
  onSelectTargetState: (state: string) => void;
  schema: import("@/shared/types/formSchema").FormSchemaDto | null;
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  onConfirm: () => void;
  isPending: boolean;
  /** Called when modal is closed (cancel/close) so parent can clear state. */
  onCloseComplete?: () => void;
};

/** Conflict (overwrite) */
export type ConflictModalProps = {
  message: string;
  onOverwrite: () => void;
  onCancel: () => void;
};

/** Quality create/edit artifact modal */
export type QualityArtifactModalProps = {
  mode: "create" | "edit";
  artifactType: string;
  initialTitle?: string;
  initialDescription?: string;
  initialSteps?: import("@/features/quality/types").TestPlanEntry[];
  enableStepsEditor?: boolean;
  /** Load test cases for “Call to Test” picker; `projectId` is the API project UUID. */
  testCasePickerContext?: {
    orgSlug: string;
    projectId: string;
    excludeArtifactId?: string;
  };
  /** Open another test case from the steps editor (e.g. callee). */
  onNavigateToTestCase?: (testCaseId: string) => void;
  isPending: boolean;
  /** When enableStepsEditor, persisted as `custom_fields.test_params_json` (omit or null clears). */
  initialTestParams?: import("@/features/quality/lib/testParams").TestParamsDocument | null;
  onSubmit: (payload: {
    title: string;
    description: string;
    steps?: import("@/features/quality/types").TestPlanEntry[];
    testParams?: import("@/features/quality/lib/testParams").TestParamsDocument | null;
  }) => Promise<void> | void;
};

export interface ModalPropsMap {
  ConfirmModal: ConfirmModalProps;
  DeleteArtifactModal: DeleteArtifactModalProps;
  CreateArtifactModal: CreateArtifactModalProps;
  AddTaskModal: AddTaskModalProps;
  EditTaskModal: EditTaskModalProps;
  AddLinkModal: AddLinkModalProps;
  SaveQueryModal: SaveQueryModalProps;
  ProjectMembersModal: ProjectMembersModalProps;
  BulkTransitionModal: BulkTransitionModalProps;
  BulkDeleteModal: BulkDeleteModalProps;
  TransitionArtifactModal: TransitionArtifactModalProps;
  ConflictModal: ConflictModalProps;
  QualityArtifactModal: QualityArtifactModalProps;
}

export type OpenModalOptions = {
  title?: string;
};
