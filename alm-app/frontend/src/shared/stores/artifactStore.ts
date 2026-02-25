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
  artifact_key?: string | null;
  state_reason?: string | null;
  resolution?: string | null;
  rank_order?: number | null;
  cycle_node_id?: string | null;
  area_node_id?: string | null;
  area_path_snapshot?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Permission-aware UI: actions the current user can perform (e.g. read, update, delete, transition). */
  allowed_actions?: string[];
}

/** Artifact list sort/filter/pagination (Zustand standard). */
export type ArtifactSortBy =
  | "artifact_key"
  | "title"
  | "state"
  | "artifact_type"
  | "created_at"
  | "updated_at";
export type ArtifactSortOrder = "asc" | "desc";
export type ArtifactViewMode = "table" | "tree" | "board";

export interface ArtifactListState {
  sortBy: ArtifactSortBy;
  sortOrder: ArtifactSortOrder;
  stateFilter: string;
  typeFilter: string;
  cycleNodeFilter: string;
  areaNodeFilter: string;
  searchInput: string;
  searchQuery: string;
  page: number;
  pageSize: number;
  viewMode: ArtifactViewMode;
  showDeleted: boolean;
  selectedIds: string[];
  detailArtifactId: string | null;
  createOpen: boolean;
  transitionArtifactId: string | null;
  transitionTargetState: string | null;
  transitionStateReason: string;
  transitionResolution: string;
  bulkTransitionOpen: boolean;
  bulkTransitionState: string;
  bulkTransitionStateReason: string;
  bulkTransitionResolution: string;
  bulkDeleteConfirmOpen: boolean;
  deleteConfirmArtifactId: string | null;
  membersDialogOpen: boolean;
  addMemberUserId: string;
  addMemberRole: string;
  detailDrawerEditing: boolean;
  editTitle: string;
  editDescription: string;
  editAssigneeId: string;
  editTitleError: string;
}

const defaultListState: ArtifactListState = {
  sortBy: "created_at",
  sortOrder: "desc",
  stateFilter: "",
  typeFilter: "",
  cycleNodeFilter: "",
  areaNodeFilter: "",
  searchInput: "",
  searchQuery: "",
  page: 0,
  pageSize: 20,
  viewMode: "table",
  showDeleted: false,
  selectedIds: [],
  detailArtifactId: null,
  createOpen: false,
  transitionArtifactId: null,
  transitionTargetState: null,
  transitionStateReason: "",
  transitionResolution: "",
  bulkTransitionOpen: false,
  bulkTransitionState: "",
  bulkTransitionStateReason: "",
  bulkTransitionResolution: "",
  bulkDeleteConfirmOpen: false,
  deleteConfirmArtifactId: null,
  membersDialogOpen: false,
  addMemberUserId: "",
  addMemberRole: "PROJECT_VIEWER",
  detailDrawerEditing: false,
  editTitle: "",
  editDescription: "",
  editAssigneeId: "",
  editTitleError: "",
};

interface ArtifactState {
  currentArtifact: Artifact | null;
  artifactsByProject: Record<string, Artifact[]>;
  listState: ArtifactListState;
  setCurrentArtifact: (artifact: Artifact | null) => void;
  setArtifacts: (projectId: string, artifacts: Artifact[]) => void;
  addArtifact: (projectId: string, artifact: Artifact) => void;
  updateArtifact: (projectId: string, artifactId: string, artifact: Artifact) => void;
  clearCurrentArtifact: () => void;
  clearArtifacts: (projectId?: string) => void;
  clearAll: () => void;
  getArtifacts: (projectId: string) => Artifact[];
  getArtifact: (projectId: string, artifactId: string) => Artifact | undefined;
  setListState: (patch: Partial<ArtifactListState>) => void;
  resetListState: () => void;
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  toggleSelectedId: (id: string) => void;
  clearSelection: () => void;
}

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  currentArtifact: null,
  artifactsByProject: {},
  listState: defaultListState,

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
    set({ currentArtifact: null, artifactsByProject: {}, listState: defaultListState }),

  getArtifacts: (projectId) => get().artifactsByProject[projectId] ?? [],

  getArtifact: (projectId, artifactId) =>
    get()
      .artifactsByProject[projectId]?.find((a) => a.id === artifactId),

  setListState: (patch) =>
    set((s) => ({ listState: { ...s.listState, ...patch } })),

  resetListState: () => set({ listState: defaultListState }),

  setSelectedIds: (ids) =>
    set((s) => ({
      listState: {
        ...s.listState,
        selectedIds: typeof ids === "function" ? ids(s.listState.selectedIds) : ids,
      },
    })),

  toggleSelectedId: (id) =>
    set((s) => {
      const prev = s.listState.selectedIds;
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return { listState: { ...s.listState, selectedIds: next } };
    }),

  clearSelection: () =>
    set((s) => ({ listState: { ...s.listState, selectedIds: [] } })),
}));
