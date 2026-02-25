import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Project } from "../api/types";

export type { Project };

const LAST_VISITED_KEY = "alm_last_visited_project";

function getStoredLastVisited(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_VISITED_KEY);
  } catch {
    return null;
  }
}

function setStoredLastVisited(slug: string | null) {
  try {
    if (slug) localStorage.setItem(LAST_VISITED_KEY, slug);
    else localStorage.removeItem(LAST_VISITED_KEY);
  } catch {
    /* ignore */
  }
}

/** Projects list page UI state (Zustand standard). */
export interface ProjectListState {
  createModalOpen: boolean;
}

interface ProjectState {
  currentProject: Project | null;
  /** Last visited project slug (per org in practice; persisted for Dashboard default). */
  lastVisitedProjectSlug: string | null;
  listState: ProjectListState;
  setCurrentProject: (project: Project | null) => void;
  setLastVisitedProjectSlug: (slug: string | null) => void;
  clearCurrentProject: () => void;
  clearAll: () => void;
  setCreateModalOpen: (open: boolean) => void;
  resetListState: () => void;
}

const defaultListState: ProjectListState = {
  createModalOpen: false,
};

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set) => ({
      currentProject: null,
      lastVisitedProjectSlug: getStoredLastVisited(),
      listState: defaultListState,

      setCurrentProject: (project) => set({ currentProject: project }),

      setLastVisitedProjectSlug: (slug) => {
        setStoredLastVisited(slug);
        set({ lastVisitedProjectSlug: slug });
      },

      clearCurrentProject: () => set({ currentProject: null }),

      clearAll: () => {
        setStoredLastVisited(null);
        set({
          currentProject: null,
          lastVisitedProjectSlug: null,
          listState: defaultListState,
        });
      },

      setCreateModalOpen: (open) =>
        set((s) => ({ listState: { ...s.listState, createModalOpen: open } })),

      resetListState: () => set({ listState: defaultListState }),
    }),
    { name: "ProjectStore", enabled: import.meta.env.DEV },
  ),
);
