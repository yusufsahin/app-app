import { useModalStore } from "./useModalStore";
import type {
  ConfirmModalProps,
  DeleteArtifactModalProps,
  CreateArtifactModalProps,
  AddTaskModalProps,
  EditTaskModalProps,
  AddLinkModalProps,
  SaveQueryModalProps,
  ProjectMembersModalProps,
  BulkTransitionModalProps,
  BulkDeleteModalProps,
  TransitionArtifactModalProps,
  ConflictModalProps,
  OpenModalOptions,
} from "./modalTypes";

export const modalApi = {
  openConfirm: (props: ConfirmModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("ConfirmModal", props, options),

  openDeleteArtifact: (props: DeleteArtifactModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("DeleteArtifactModal", props, options),

  openCreateArtifact: (props: CreateArtifactModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("CreateArtifactModal", props, options),

  openAddTask: (props: AddTaskModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("AddTaskModal", props, options),

  openEditTask: (props: EditTaskModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("EditTaskModal", props, {
      ...options,
      title: options?.title ?? `Edit: ${props.task.title}`,
    }),

  openAddLink: (props: AddLinkModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("AddLinkModal", props, options),

  openSaveQuery: (props: SaveQueryModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("SaveQueryModal", props, options),

  openProjectMembers: (props: ProjectMembersModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("ProjectMembersModal", props, {
      ...options,
      title: options?.title ?? `Members: ${props.projectName}`,
    }),

  openBulkTransition: (props: BulkTransitionModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("BulkTransitionModal", props, options),

  openBulkDelete: (props: BulkDeleteModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("BulkDeleteModal", props, options),

  openTransitionArtifact: (props: TransitionArtifactModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("TransitionArtifactModal", props, options),

  openConflict: (props: ConflictModalProps, options?: OpenModalOptions) =>
    useModalStore.getState().openModal("ConflictModal", props, options),

  closeModal: () => useModalStore.getState().closeModal(),
};
