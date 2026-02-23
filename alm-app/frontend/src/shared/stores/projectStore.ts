import { create } from "zustand";

export interface Project {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string;
}

interface ProjectState {
  currentProject: Project | null;
  projectsByOrg: Record<string, Project[]>;
  setCurrentProject: (project: Project | null) => void;
  setProjects: (orgSlug: string, projects: Project[]) => void;
  addProject: (orgSlug: string, project: Project) => void;
  clearCurrentProject: () => void;
  clearProjects: (orgSlug?: string) => void;
  clearAll: () => void;
  getProjects: (orgSlug: string) => Project[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projectsByOrg: {},

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

  clearAll: () => set({ currentProject: null, projectsByOrg: {} }),

  getProjects: (orgSlug) => get().projectsByOrg[orgSlug] ?? [],
}));
