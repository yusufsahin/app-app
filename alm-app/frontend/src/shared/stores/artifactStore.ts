import { create } from "zustand";

export interface Artifact {
  id: string;
  project_id: string;
  artifact_type: string;
  title: string;
  description: string;
  state: string;
  assignee_id: string | null;
  parent_id: string | null;
  custom_fields?: Record<string, unknown>;
}

interface ArtifactState {
  currentArtifact: Artifact | null;
  artifactsByProject: Record<string, Artifact[]>;
  setCurrentArtifact: (artifact: Artifact | null) => void;
  setArtifacts: (projectId: string, artifacts: Artifact[]) => void;
  addArtifact: (projectId: string, artifact: Artifact) => void;
  updateArtifact: (projectId: string, artifactId: string, artifact: Artifact) => void;
  clearCurrentArtifact: () => void;
  clearArtifacts: (projectId?: string) => void;
  clearAll: () => void;
  getArtifacts: (projectId: string) => Artifact[];
  getArtifact: (projectId: string, artifactId: string) => Artifact | undefined;
}

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  currentArtifact: null,
  artifactsByProject: {},

  setCurrentArtifact: (artifact) => set({ currentArtifact: artifact }),

  setArtifacts: (projectId, artifacts) =>
    set((s) => ({
      artifactsByProject: { ...s.artifactsByProject, [projectId]: artifacts },
    })),

  addArtifact: (projectId, artifact) =>
    set((s) => ({
      artifactsByProject: {
        ...s.artifactsByProject,
        [projectId]: [...(s.artifactsByProject[projectId] ?? []), artifact],
      },
    })),

  updateArtifact: (projectId, artifactId, artifact) =>
    set((s) => {
      const list = s.artifactsByProject[projectId] ?? [];
      const idx = list.findIndex((a) => a.id === artifactId);
      if (idx < 0) return s;
      const next = [...list];
      next[idx] = artifact;
      return {
        artifactsByProject: { ...s.artifactsByProject, [projectId]: next },
      };
    }),

  clearCurrentArtifact: () => set({ currentArtifact: null }),

  clearArtifacts: (projectId) =>
    set((s) => {
      if (projectId) {
        const { [projectId]: _, ...rest } = s.artifactsByProject;
        return { artifactsByProject: rest };
      }
      return { artifactsByProject: {} };
    }),

  clearAll: () =>
    set({ currentArtifact: null, artifactsByProject: {} }),

  getArtifacts: (projectId) => get().artifactsByProject[projectId] ?? [],

  getArtifact: (projectId, artifactId) =>
    get()
      .artifactsByProject[projectId]?.find((a) => a.id === artifactId),
}));
