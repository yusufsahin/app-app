import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Project } from "../api/types";

export type { Project };

/** Projects list page UI state (Zustand standard). */
export interface ProjectListState {
  listTab: number;
  createModalOpen: boolean;
}

interface ProjectState {
  currentProject: Project | null;
  listState: ProjectListState;
  setCurrentProject: (project: Project | null) => void;
  clearCurrentProject: () => void;
  clearAll: () => void;
  setListTab: (tab: number) => void;
  setCreateModalOpen: (open: boolean) => void;
  resetListState: () => void;
}

const defaultListState: ProjectListState = {
  listTab: 0,
  createModalOpen: false,
};

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set) => ({
      currentProject: null,
      listState: defaultListState,

      setCurrentProject: (project) => set({ currentProject: project }),

      clearCurrentProject: () => set({ currentProject: null }),

      clearAll: () => set({ currentProject: null, listState: defaultListState }),

      setListTab: (tab) =>
        set((s) => ({ listState: { ...s.listState, listTab: tab } })),

      setCreateModalOpen: (open) =>
        set((s) => ({ listState: { ...s.listState, createModalOpen: open } })),

      resetListState: () => set({ listState: defaultListState }),
    }),
    { name: "ProjectStore", enabled: import.meta.env.DEV },
  ),
);
