import { lazy } from "react";

export const MODALS = {
  ConfirmModal: {
    component: lazy(() => import("./modals/ConfirmModal").then((m) => ({ default: m.ConfirmModal }))),
    options: { maxWidth: "xs", destroyOnClose: true },
    title: "Confirm",
  },
  DeleteArtifactModal: {
    component: lazy(() => import("./modals/DeleteArtifactModal").then((m) => ({ default: m.DeleteArtifactModal }))),
    options: { maxWidth: "xs", destroyOnClose: true },
    title: "Delete artifact",
  },
  CreateArtifactModal: {
    component: lazy(() => import("./modals/CreateArtifactModal").then((m) => ({ default: m.CreateArtifactModal }))),
    options: { maxWidth: "lg", destroyOnClose: true },
    title: "New artifact",
  },
  AddTaskModal: {
    component: lazy(() => import("./modals/AddTaskModal").then((m) => ({ default: m.AddTaskModal }))),
    options: { maxWidth: "sm", destroyOnClose: true },
    title: "Add task",
  },
  EditTaskModal: {
    component: lazy(() => import("./modals/EditTaskModal").then((m) => ({ default: m.EditTaskModal }))),
    options: { maxWidth: "sm", destroyOnClose: true },
    title: "Edit task",
  },
  AddLinkModal: {
    component: lazy(() => import("./modals/AddLinkModal").then((m) => ({ default: m.AddLinkModal }))),
    options: { maxWidth: "sm", destroyOnClose: true },
    title: "Add link",
  },
  SaveQueryModal: {
    component: lazy(() => import("./modals/SaveQueryModal").then((m) => ({ default: m.SaveQueryModal }))),
    options: { maxWidth: "sm", destroyOnClose: true },
    title: "Save current filters",
  },
  ProjectMembersModal: {
    component: lazy(() => import("./modals/ProjectMembersModal").then((m) => ({ default: m.ProjectMembersModal }))),
    options: { maxWidth: "sm", destroyOnClose: true },
    title: "Project members",
  },
  BulkTransitionModal: {
    component: lazy(() => import("./modals/BulkTransitionModal").then((m) => ({ default: m.BulkTransitionModal }))),
    options: { maxWidth: "xs", destroyOnClose: true },
    title: "Transition artifacts",
  },
  BulkDeleteModal: {
    component: lazy(() => import("./modals/BulkDeleteModal").then((m) => ({ default: m.BulkDeleteModal }))),
    options: { maxWidth: "xs", destroyOnClose: true },
    title: "Delete artifacts",
  },
  TransitionArtifactModal: {
    component: lazy(() => import("./modals/TransitionArtifactModal").then((m) => ({ default: m.TransitionArtifactModal }))),
    options: { maxWidth: "sm", destroyOnClose: true },
    title: "Transition",
  },
  ConflictModal: {
    component: lazy(() => import("./modals/ConflictModal").then((m) => ({ default: m.ConflictModal }))),
    options: { maxWidth: "sm", destroyOnClose: true },
    title: "Conflict",
  },
} as const;

export type ModalType = keyof typeof MODALS;
