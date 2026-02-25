import { create } from "zustand";

export interface Project {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string;
}

/** Projects list page UI state (Zustand standard). */
export interface ProjectListState {
  listTab: number;
  createModalOpen: boolean;
}

interface ProjectState {
  currentProject: Project | null;
  projectsByOrg: Record<string, Project[]>;
  listState: ProjectListState;
  setCurrentProject: (project: Project | null) => void;
  setProjects: (orgSlug: string, projects: Project[]) => void;
  addProject: (orgSlug: string, project: Project) => void;
  clearCurrentProject: () => void;
  clearProjects: (orgSlug?: string) => void;
  clearAll: () => void;
  getProjects: (orgSlug: string) => Project[];
  setListTab: (tab: number) => void;
  setCreateModalOpen: (open: boolean) => void;
  resetListState: () => void;
}

const defaultListState: ProjectListState = {
  listTab: 0,
  createModalOpen: false,
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projectsByOrg: {},
  listState: defaultListState,

  setCurrentProject: (project) => set({ currentProject: project }),

  setProjects: (orgSlug, projects) =>
    set((s) => ({
      projectsByOrg: { ...s.projectsByOrg, [orgSlug]: projects },
    })),

  addProject: (orgSlug, project) =>
    set((s) => ({
      projectsByOrg: {
        ...s.projectsByOrg,
        [orgSlug]: [...(s.projectsByOrg[orgSlug] ?? []), project],
      },
    })),

  clearCurrentProject: () => set({ currentProject: null }),

  clearProjects: (orgSlug) =>
    set((s) => {
      if (orgSlug) {
        const { [orgSlug]: _, ...rest } = s.projectsByOrg;
        return { projectsByOrg: rest };
      }
      return { projectsByOrg: {} };
    }),

  clearAll: () => set({ currentProject: null, projectsByOrg: {}, listState: defaultListState }),

  getProjects: (orgSlug) => get().projectsByOrg[orgSlug] ?? [],

  setListTab: (tab) =>
    set((s) => ({ listState: { ...s.listState, listTab: tab } })),

  setCreateModalOpen: (open) =>
    set((s) => ({ listState: { ...s.listState, createModalOpen: open } })),

  resetListState: () => set({ listState: defaultListState }),
}));
