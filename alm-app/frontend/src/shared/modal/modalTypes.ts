
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
  onCreate: () => void;
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
};

/** Edit task – parent provides schema; modal passes current values to onSubmit */
export type EditTaskModalProps = {
  taskFormSchema: import("@/shared/types/formSchema").FormSchemaDto | null;
  task: { id: string; title: string; description?: string | null; state?: string; assignee_id?: string | null; rank_order?: number | null };
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  onSubmit: (values: Record<string, unknown>) => void;
  isPending: boolean;
  userOptions: Array<{ id: string; label: string }>;
};

/** Add link */
export type AddLinkModalProps = {
  sourceArtifactId: string;
  artifactOptions: Array<{ value: string; label: string }>;
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
}

export type OpenModalOptions = {
  title?: string;
};
