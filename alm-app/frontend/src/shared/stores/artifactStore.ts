import { create } from "zustand";
import { devtools } from "zustand/middleware";

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
  /** When set, batch request sends trigger instead of new_state (for "common action" in bulk dialog) */
  bulkTransitionTrigger: string;
  bulkTransitionStateReason: string;
  bulkTransitionResolution: string;
  /** When set, bulk dialog shows partial result (e.g. X succeeded, Y failed) and error list */
  bulkTransitionLastResult: {
    success_count: number;
    error_count: number;
    errors: string[];
    /** Per-artifact result: artifact_id -> 'ok' | 'validation_error' | 'policy_denied' | 'conflict_error' */
    results?: Record<string, string>;
  } | null;
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
  bulkTransitionTrigger: "",
  bulkTransitionStateReason: "",
  bulkTransitionResolution: "",
  bulkTransitionLastResult: null,
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
  listState: ArtifactListState;
  setCurrentArtifact: (artifact: Artifact | null) => void;
  clearCurrentArtifact: () => void;
  clearAll: () => void;
  setListState: (patch: Partial<ArtifactListState>) => void;
  resetListState: () => void;
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  toggleSelectedId: (id: string) => void;
  clearSelection: () => void;
}

export const useArtifactStore = create<ArtifactState>()(
  devtools(
    (set) => ({
      currentArtifact: null,
      listState: defaultListState,

      setCurrentArtifact: (artifact) => set({ currentArtifact: artifact }),

      clearCurrentArtifact: () => set({ currentArtifact: null }),

      clearAll: () =>
        set({ currentArtifact: null, listState: defaultListState }),

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
    }),
    { name: "ArtifactStore", enabled: import.meta.env.DEV },
  ),
);
