import type { ManifestBundleArtifactType, ManifestBundleShape } from "../workflowManifest";
import type { ManifestBundleForTransitions } from "../workflowTransitions";

/** Minimal artifact shape for flow board grouping and drag-drop. */
export interface FlowBoardArtifact {
  id: string;
  artifact_type: string;
  state: string;
  rank_order?: number | null;
  created_at?: string | null;
  allowed_actions?: string[];
  artifact_key?: string | null;
  title?: string | null;
  assignee_id?: string | null;
  updated_at?: string | null;
}

/** Default surface config under `board.surfaces.default` in manifest. */
export interface BoardSurfaceConfig {
  column_source?: "workflow_states" | "state_category";
  hide_state_ids?: string[];
  column_order_override?: string[];
  /** Keys of artifact fields to show on cards (reserved for UI; validated on save). */
  card_fields?: string[];
  group_by?: string;
}

export interface ManifestBoardRoot {
  surfaces?: { default?: BoardSurfaceConfig };
}

export type ManifestBundleWithBoard = ManifestBundleShape & { board?: ManifestBoardRoot };

export interface FlowBoardColumnDef {
  key: string;
  dropKind: "state" | "category";
  displayLabel?: string;
}

export interface FlowBoardColumnModel {
  columns: FlowBoardColumnDef[];
  normToCanonical: Map<string, string>;
  /** Normalized state ids hidden from workflow-driven columns (category mode uses extras). */
  hiddenStateNorms?: Set<string>;
}

export type BoardKind = "flow";

/** Strategy object for the flow (Kanban) board kind; other kinds can mirror this shape later. */
export interface FlowBoardStrategy {
  kind: BoardKind;
  getDefaultSurface: (bundle: ManifestBundleWithBoard | null | undefined) => BoardSurfaceConfig | null;
  buildColumnModel: (
    bundle: ManifestBundleShape | null,
    typeFilterTrimmed: string,
    boardSelectableTypes: ManifestBundleArtifactType[],
    artifacts: FlowBoardArtifact[],
    boardSurface: BoardSurfaceConfig | null,
  ) => FlowBoardColumnModel;
  groupArtifacts: (
    bundle: ManifestBundleShape | null,
    model: FlowBoardColumnModel,
    artifacts: FlowBoardArtifact[],
  ) => Map<string, FlowBoardArtifact[]>;
  canDropOnColumn: (
    bundle: ManifestBundleShape | null,
    transitionBundle: ManifestBundleForTransitions,
    artifact: FlowBoardArtifact,
    targetColumnKey: string,
    model: FlowBoardColumnModel,
  ) => boolean;
  resolveDropTargetState: (
    bundle: ManifestBundleShape | null,
    artifactType: string,
    column: FlowBoardColumnDef,
  ) => string | null;
  buildDropAllowedMap: (
    model: FlowBoardColumnModel | null,
    bundle: ManifestBundleShape | null,
    transitionBundle: ManifestBundleForTransitions,
    draggingArtifactId: string | null,
    artifacts: FlowBoardArtifact[],
  ) => Map<string, boolean> | null;
}
