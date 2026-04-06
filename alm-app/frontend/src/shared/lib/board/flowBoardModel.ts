import { getValidTransitionsFromBundle, type ManifestBundleForTransitions } from "../workflowTransitions";
import {
  categoryForStateInWorkflow,
  firstStateIdInCategoryForWorkflow,
  getMergedWorkflowStatesForAllTypes,
  getMergedWorkflowStatesForArtifactTypes,
  getWorkflowForArtifactType,
  getWorkflowStatesForType,
  inferCategoryFromStateEntry,
  normalizeWorkflowStateKey,
  resolveWorkflowStateForArtifactType,
  type ManifestBundleArtifactType,
  type ManifestBundleShape,
  type ManifestBundleWorkflow,
} from "../workflowManifest";
import type {
  BoardSurfaceConfig,
  FlowBoardArtifact,
  FlowBoardColumnDef,
  FlowBoardColumnModel,
  ManifestBundleWithBoard,
} from "./types";

const CATEGORY_ORDER = ["proposed", "in_progress", "completed"] as const;

function sortCategoriesStable(cats: string[]): string[] {
  const byLower = new Map(cats.map((c) => [c.toLowerCase(), c]));
  const head: string[] = [];
  for (const low of CATEGORY_ORDER) {
    const v = byLower.get(low);
    if (v) head.push(v);
  }
  const headLower = new Set(head.map((c) => c.toLowerCase()));
  const tail = cats.filter((c) => !headLower.has(c.toLowerCase()));
  return [...head, ...tail];
}

function hideNormSet(surface: BoardSurfaceConfig | null): Set<string> {
  return new Set((surface?.hide_state_ids ?? []).map((id) => normalizeWorkflowStateKey(id)));
}

function applyHideAndOrderToStateColumns(baseStates: string[], surface: BoardSurfaceConfig | null): string[] {
  const hide = hideNormSet(surface);
  const s = baseStates.filter((id) => !hide.has(normalizeWorkflowStateKey(id)));
  const ov = surface?.column_order_override;
  if (ov && ov.length > 0) {
    const seen = new Set<string>();
    const out: string[] = [];
    const normToOriginal = new Map(s.map((x) => [normalizeWorkflowStateKey(x), x] as const));
    for (const raw of ov) {
      const k = normalizeWorkflowStateKey(raw);
      if (seen.has(k)) continue;
      const orig = normToOriginal.get(k);
      if (orig !== undefined) {
        seen.add(k);
        out.push(orig);
      }
    }
    for (const x of s) {
      const k = normalizeWorkflowStateKey(x);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(x);
      }
    }
    return out;
  }
  return s;
}

function computeBaseWorkflowStates(
  bundle: ManifestBundleShape | null,
  typeFilterTrimmed: string,
  boardSelectableTypes: ManifestBundleArtifactType[],
): string[] {
  const tf = typeFilterTrimmed;
  if (tf) return getWorkflowStatesForType(bundle, tf);
  if (boardSelectableTypes.length > 0) {
    return getMergedWorkflowStatesForArtifactTypes(
      bundle,
      boardSelectableTypes.map((t) => t.id),
    );
  }
  return getMergedWorkflowStatesForAllTypes(bundle);
}

function categoriesFromWorkflowVisible(wf: ManifestBundleWorkflow | undefined, hideNorm: Set<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of wf?.states ?? []) {
    const id = typeof raw === "string" ? raw : (raw as { id: string }).id;
    if (hideNorm.has(normalizeWorkflowStateKey(id))) continue;
    const cat = inferCategoryFromStateEntry(raw);
    if (!seen.has(cat)) {
      seen.add(cat);
      out.push(cat);
    }
  }
  return out;
}

function collectOrderedCategories(
  bundle: ManifestBundleShape | null,
  typeFilterTrimmed: string,
  boardSelectableTypes: ManifestBundleArtifactType[],
  hideNorm: Set<string>,
): string[] {
  const workflows = bundle?.workflows ?? [];
  if (!workflows.length) return [];

  if (typeFilterTrimmed) {
    const wf = getWorkflowForArtifactType(bundle, typeFilterTrimmed);
    return wf ? sortCategoriesStable(categoriesFromWorkflowVisible(wf, hideNorm)) : [];
  }

  const types =
    boardSelectableTypes.length > 0 ? boardSelectableTypes : (bundle?.artifact_types ?? []);

  const referencedIds = new Set<string>();
  for (const at of types) {
    const wid = at.workflow_id?.trim();
    if (wid) referencedIds.add(wid);
  }
  if (referencedIds.size === 0) {
    return sortCategoriesStable(categoriesFromWorkflowVisible(workflows[0], hideNorm));
  }

  const seenCat = new Set<string>();
  const ordered: string[] = [];
  for (const wf of workflows) {
    if (!referencedIds.has(wf.id)) continue;
    for (const cat of categoriesFromWorkflowVisible(wf, hideNorm)) {
      if (!seenCat.has(cat)) {
        seenCat.add(cat);
        ordered.push(cat);
      }
    }
  }
  if (ordered.length === 0) {
    return sortCategoriesStable(categoriesFromWorkflowVisible(workflows[0], hideNorm));
  }
  return sortCategoriesStable(ordered);
}

function applyCategoryOrder(cats: string[], override: string[] | undefined): string[] {
  if (!override?.length) return cats;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of override) {
    const k = raw.trim().toLowerCase();
    if (seen.has(k)) continue;
    const match = cats.find((c) => c.toLowerCase() === k);
    if (match !== undefined) {
      seen.add(k);
      out.push(match);
    }
  }
  for (const c of cats) {
    if (!seen.has(c.toLowerCase())) out.push(c);
  }
  return out;
}

function categoryDisplayLabel(cat: string): string {
  const c = cat.toLowerCase();
  if (c === "in_progress") return "In progress";
  if (c === "proposed") return "Proposed";
  if (c === "completed") return "Completed";
  return cat;
}

function buildStateColumnModel(
  bundle: ManifestBundleShape | null,
  typeFilterTrimmed: string,
  boardSelectableTypes: ManifestBundleArtifactType[],
  artifacts: FlowBoardArtifact[],
  surface: BoardSurfaceConfig | null,
): FlowBoardColumnModel {
  const baseStates = applyHideAndOrderToStateColumns(
    computeBaseWorkflowStates(bundle, typeFilterTrimmed, boardSelectableTypes),
    surface,
  );
  const m = new Map<string, string>();
  for (const s of baseStates) m.set(normalizeWorkflowStateKey(s), s);
  const extras: string[] = [];
  const uniqArtifactStates = [...new Set(artifacts.map((a) => a.state))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
  for (const s of uniqArtifactStates) {
    const k = normalizeWorkflowStateKey(s);
    if (!m.has(k)) {
      m.set(k, s);
      extras.push(s);
    }
  }
  const columnKeys = [...baseStates, ...extras];
  const columns: FlowBoardColumnDef[] = columnKeys.map((key) => ({ key, dropKind: "state" as const }));
  return { columns, normToCanonical: m };
}

function buildCategoryColumnModel(
  bundle: ManifestBundleShape | null,
  typeFilterTrimmed: string,
  boardSelectableTypes: ManifestBundleArtifactType[],
  artifacts: FlowBoardArtifact[],
  surface: BoardSurfaceConfig | null,
): FlowBoardColumnModel {
  const hideNorm = hideNormSet(surface);
  let cats = collectOrderedCategories(bundle, typeFilterTrimmed, boardSelectableTypes, hideNorm);
  cats = applyCategoryOrder(cats, surface?.column_order_override);

  const columns: FlowBoardColumnDef[] = cats.map((key) => ({
    key,
    dropKind: "category" as const,
    displayLabel: categoryDisplayLabel(key),
  }));
  const normToCanonical = new Map<string, string>();
  for (const c of cats) normToCanonical.set(normalizeWorkflowStateKey(c), c);

  const keySet = new Set(columns.map((c) => c.key));

  const extras: string[] = [];
  const addExtra = (stateId: string) => {
    const k = normalizeWorkflowStateKey(stateId);
    if ([...keySet].some((x) => normalizeWorkflowStateKey(x) === k)) return;
    keySet.add(stateId);
    extras.push(stateId);
    normToCanonical.set(k, stateId);
  };

  for (const a of artifacts) {
    const wf = getWorkflowForArtifactType(bundle, a.artifact_type);
    const sn = normalizeWorkflowStateKey(a.state);
    if (hideNorm.has(sn)) {
      addExtra(a.state);
      continue;
    }
    const cat = categoryForStateInWorkflow(wf, a.state);
    if (cat && keySet.has(cat)) continue;
    addExtra(a.state);
  }

  extras.sort((x, y) => String(x).localeCompare(String(y)));
  for (const s of extras) {
    columns.push({ key: s, dropKind: "state" });
  }

  return { columns, normToCanonical, hiddenStateNorms: hideNorm };
}

/** Read optional `board.surfaces.default` from manifest bundle. */
export function getDefaultBoardSurface(bundle: ManifestBundleWithBoard | null | undefined): BoardSurfaceConfig | null {
  const s = bundle?.board?.surfaces?.default;
  if (!s || typeof s !== "object") return null;
  return s;
}

export function buildFlowBoardColumnModel(
  bundle: ManifestBundleShape | null,
  typeFilterTrimmed: string,
  boardSelectableTypes: ManifestBundleArtifactType[],
  artifacts: FlowBoardArtifact[],
  boardSurface: BoardSurfaceConfig | null,
): FlowBoardColumnModel {
  const source = boardSurface?.column_source ?? "workflow_states";
  if (source === "state_category") {
    return buildCategoryColumnModel(
      bundle,
      typeFilterTrimmed,
      boardSelectableTypes,
      artifacts,
      boardSurface,
    );
  }
  return buildStateColumnModel(bundle, typeFilterTrimmed, boardSelectableTypes, artifacts, boardSurface);
}

export function resolveFlowBoardDropTargetState(
  bundle: ManifestBundleShape | null,
  artifactType: string,
  column: FlowBoardColumnDef,
): string | null {
  if (column.dropKind === "category") {
    const wf = getWorkflowForArtifactType(bundle, artifactType);
    return firstStateIdInCategoryForWorkflow(wf, column.key);
  }
  return resolveWorkflowStateForArtifactType(bundle, artifactType, column.key);
}

export function canDropOnFlowColumn(
  bundle: ManifestBundleShape | null,
  transitionBundle: ManifestBundleForTransitions,
  artifact: FlowBoardArtifact,
  targetColumnKey: string,
  model: FlowBoardColumnModel,
): boolean {
  if (!artifact.allowed_actions?.includes("transition")) return false;
  const def = model.columns.find((c) => c.key === targetColumnKey);
  if (!def) return false;
  const newState = resolveFlowBoardDropTargetState(bundle, artifact.artifact_type, def);
  if (newState == null) return false;
  if (normalizeWorkflowStateKey(newState) === normalizeWorkflowStateKey(artifact.state)) return false;
  const valid = getValidTransitionsFromBundle(transitionBundle, artifact.artifact_type, artifact.state);
  return valid.includes(newState);
}

function resolveArtifactColumnKey(
  bundle: ManifestBundleShape | null,
  model: FlowBoardColumnModel,
  artifact: FlowBoardArtifact,
): string {
  const keys = new Set(model.columns.map((c) => c.key));
  const hasCategory = model.columns.some((c) => c.dropKind === "category");
  const hideNorm = model.hiddenStateNorms ?? new Set();
  const sn = normalizeWorkflowStateKey(artifact.state);

  if (hasCategory) {
    const wf = getWorkflowForArtifactType(bundle, artifact.artifact_type);
    if (hideNorm.has(sn)) {
      const canon = model.normToCanonical.get(sn) ?? artifact.state;
      if (keys.has(canon)) return canon;
      if (keys.has(artifact.state)) return artifact.state;
      return canon;
    }
    const cat = categoryForStateInWorkflow(wf, artifact.state);
    if (cat && keys.has(cat)) return cat;
  }

  const canon = model.normToCanonical.get(sn) ?? artifact.state;
  if (keys.has(canon)) return canon;
  if (keys.has(artifact.state)) return artifact.state;
  return canon;
}

function sortArtifactList(list: FlowBoardArtifact[]): FlowBoardArtifact[] {
  return [...list].sort((x, y) => {
    const rx = x.rank_order ?? 0;
    const ry = y.rank_order ?? 0;
    if (rx !== ry) return rx - ry;
    const cx = x.created_at ?? "";
    const cy = y.created_at ?? "";
    return cx.localeCompare(cy);
  });
}

export function groupArtifactsByFlowColumns(
  bundle: ManifestBundleShape | null,
  model: FlowBoardColumnModel,
  artifacts: FlowBoardArtifact[],
): Map<string, FlowBoardArtifact[]> {
  const map = new Map<string, FlowBoardArtifact[]>();
  for (const c of model.columns) map.set(c.key, []);
  for (const a of artifacts) {
    const colKey = resolveArtifactColumnKey(bundle, model, a);
    const list = map.get(colKey);
    if (list) list.push(a);
    else {
      const fallback = map.get(a.state);
      if (fallback) fallback.push(a);
      else map.set(a.state, [a]);
    }
  }
  for (const c of model.columns) {
    map.set(c.key, sortArtifactList(map.get(c.key) ?? []));
  }
  return map;
}

export function buildFlowColumnDropAllowedMap(
  model: FlowBoardColumnModel | null,
  bundle: ManifestBundleShape | null,
  transitionBundle: ManifestBundleForTransitions,
  draggingArtifactId: string | null,
  artifacts: FlowBoardArtifact[],
): Map<string, boolean> | null {
  if (!draggingArtifactId || !model) return null;
  const art = artifacts.find((a) => a.id === draggingArtifactId);
  if (!art) return null;
  const m = new Map<string, boolean>();
  for (const c of model.columns) {
    m.set(c.key, canDropOnFlowColumn(bundle, transitionBundle, art, c.key, model));
  }
  return m;
}

export function flowColumnHeadline(
  column: FlowBoardColumnDef,
  stateDisplayMap: Map<string, string>,
): { headline: string; tooltip: string } {
  const key = column.key;
  const hasStateId = key.trim().length > 0;
  if (column.displayLabel) {
    return { headline: column.displayLabel, tooltip: `Column: ${key}` };
  }
  if (!hasStateId) return { headline: "(No state)", tooltip: "Empty state id" };
  return {
    headline: stateDisplayMap.get(key) ?? key,
    tooltip: `State id: ${key}`,
  };
}
