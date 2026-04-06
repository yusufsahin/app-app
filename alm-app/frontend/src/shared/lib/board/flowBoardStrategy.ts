import type { ManifestBundleArtifactType, ManifestBundleShape } from "../workflowManifest";
import {
  buildFlowBoardColumnModel,
  buildFlowColumnDropAllowedMap,
  canDropOnFlowColumn,
  getDefaultBoardSurface,
  groupArtifactsByFlowColumns,
  resolveFlowBoardDropTargetState,
} from "./flowBoardModel";
import type { BoardSurfaceConfig, FlowBoardArtifact, FlowBoardColumnModel, FlowBoardStrategy } from "./types";

export const flowBoardStrategy: FlowBoardStrategy = {
  kind: "flow",
  getDefaultSurface: getDefaultBoardSurface,
  buildColumnModel: (
    bundle: ManifestBundleShape | null,
    typeFilterTrimmed: string,
    boardSelectableTypes: ManifestBundleArtifactType[],
    artifacts: FlowBoardArtifact[],
    boardSurface: BoardSurfaceConfig | null,
  ): FlowBoardColumnModel =>
    buildFlowBoardColumnModel(bundle, typeFilterTrimmed, boardSelectableTypes, artifacts, boardSurface),
  groupArtifacts: groupArtifactsByFlowColumns,
  canDropOnColumn: canDropOnFlowColumn,
  resolveDropTargetState: resolveFlowBoardDropTargetState,
  buildDropAllowedMap: buildFlowColumnDropAllowedMap,
};
