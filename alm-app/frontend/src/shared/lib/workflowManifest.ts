/**
 * Helpers for reading workflow state lists from manifest bundle (e.g. for Board columns).
 */

export interface ManifestBundleWorkflow {
  id: string;
  states?: unknown[];
}

export interface ManifestBundleArtifactType {
  id: string;
  name?: string;
  workflow_id?: string;
  /** System tree root rows (e.g. folder roots); hide from Board type picker by default. */
  is_system_root?: boolean;
}

/** Board type filter: exclude folder roots and explicit system root types. */
export function isBoardSelectableArtifactType(at: ManifestBundleArtifactType): boolean {
  return !at.id.startsWith("root-") && at.is_system_root !== true;
}

export interface ManifestBundleShape {
  workflows?: ManifestBundleWorkflow[];
  artifact_types?: ManifestBundleArtifactType[];
}

function stateIdsFromWorkflowStates(states: unknown[] | undefined): string[] {
  if (!states?.length) return [];
  const arr = states as Array<string | { id: string }>;
  return arr.map((s) => (typeof s === "string" ? s : s.id));
}

function stateIdAndLabelFromEntry(entry: unknown): { id: string; label: string } {
  if (typeof entry === "string") return { id: entry, label: entry };
  const o = entry as { id: string; name?: string };
  const id = o.id;
  const name = o.name?.trim();
  return { id, label: name ? name : id };
}

/**
 * Map workflow state id → display label from manifest workflows (first occurrence wins).
 * String states use the string as both id and label; object states use `name ?? id`.
 */
export function buildWorkflowStateDisplayMap(bundle: ManifestBundleShape | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const wf of bundle?.workflows ?? []) {
    for (const raw of wf.states ?? []) {
      const { id, label } = stateIdAndLabelFromEntry(raw);
      if (!m.has(id)) m.set(id, label);
    }
  }
  return m;
}

/**
 * Human-readable state label for a row: uses the workflow linked to `artifactTypeId`, then falls
 * back to the first global match in `buildWorkflowStateDisplayMap` (case-insensitive on id).
 */
export function getWorkflowStateLabelForArtifactType(
  bundle: ManifestBundleShape | null,
  artifactTypeId: string | null | undefined,
  stateId: string | null | undefined,
): string {
  const rawId = (stateId ?? "").trim();
  if (!rawId) return "";
  const workflows = bundle?.workflows ?? [];
  if (!workflows.length) return rawId;
  let wf = workflows[0];
  if (artifactTypeId && bundle?.artifact_types?.length) {
    const at = bundle.artifact_types.find((a) => a.id === artifactTypeId);
    if (at?.workflow_id) {
      const found = workflows.find((w) => w.id === at.workflow_id);
      if (found) wf = found;
    }
  }
  const target = normalizeWorkflowStateKey(rawId);
  for (const entry of wf?.states ?? []) {
    const { id, label } = stateIdAndLabelFromEntry(entry);
    if (normalizeWorkflowStateKey(id) === target) return label;
  }
  const m = buildWorkflowStateDisplayMap(bundle);
  for (const [id, label] of m) {
    if (normalizeWorkflowStateKey(id) === target) return label;
  }
  return rawId;
}

/** Normalized key for grouping board columns (trim + lowercase; empty → sentinel). */
const EMPTY_STATE_NORMALIZED = "\u0000";

export function normalizeWorkflowStateKey(state: string | null | undefined): string {
  const s = (state ?? "").trim();
  return s.length === 0 ? EMPTY_STATE_NORMALIZED : s.toLowerCase();
}

/**
 * De-duplicate state ids in order; later entries that match an earlier one case-insensitively
 * (or empty/whitespace-only) are dropped. Keeps the first spelling (manifest / merge order).
 */
export function dedupeStatesCaseInsensitive(ordered: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ordered) {
    const k = normalizeWorkflowStateKey(id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(id);
  }
  return out;
}

/**
 * Exact workflow state string for an artifact type that matches the column (case-insensitive),
 * or null if that type has no such state.
 */
export function resolveWorkflowStateForArtifactType(
  bundle: ManifestBundleShape | null,
  artifactTypeId: string,
  columnStateLabel: string,
): string | null {
  const states = getWorkflowStatesForType(bundle, artifactTypeId);
  const target = normalizeWorkflowStateKey(columnStateLabel);
  for (const s of states) {
    if (normalizeWorkflowStateKey(s) === target) return s;
  }
  return null;
}

/**
 * Returns workflow state ids for the given artifact type (or default workflow).
 * Order is from the API (backend guarantees def order or canonical order for flat manifests).
 */
export function getWorkflowStatesForType(
  bundle: ManifestBundleShape | null,
  artifactTypeId: string | null,
): string[] {
  const workflows = bundle?.workflows ?? [];
  if (!workflows.length) return [];
  let wf = workflows[0];
  if (artifactTypeId && bundle?.artifact_types?.length) {
    const at = bundle.artifact_types.find((a) => a.id === artifactTypeId);
    if (at?.workflow_id) {
      const found = workflows.find((w) => w.id === at.workflow_id);
      if (found) wf = found;
    }
  }
  return dedupeStatesCaseInsensitive(stateIdsFromWorkflowStates(wf?.states));
}

function mergeWorkflowStatesForArtifactTypeList(
  bundle: ManifestBundleShape | null,
  types: ManifestBundleArtifactType[],
): string[] {
  const workflows = bundle?.workflows ?? [];
  if (!workflows.length) return [];
  if (!types.length) {
    return dedupeStatesCaseInsensitive(stateIdsFromWorkflowStates(workflows[0]?.states));
  }
  const referencedIds = new Set<string>();
  for (const at of types) {
    const wid = at.workflow_id?.trim();
    if (wid) referencedIds.add(wid);
  }
  if (referencedIds.size === 0) {
    return dedupeStatesCaseInsensitive(stateIdsFromWorkflowStates(workflows[0]?.states));
  }
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const wf of workflows) {
    if (!referencedIds.has(wf.id)) continue;
    for (const id of stateIdsFromWorkflowStates(wf.states)) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  if (ordered.length === 0) {
    return dedupeStatesCaseInsensitive(stateIdsFromWorkflowStates(workflows[0]?.states));
  }
  return dedupeStatesCaseInsensitive(ordered);
}

/**
 * Union of workflow states for workflows referenced only by the given artifact type ids
 * (manifest order). Empty `typeIds` → first workflow only (same safe fallback as an empty type list).
 */
export function getMergedWorkflowStatesForArtifactTypes(
  bundle: ManifestBundleShape | null,
  typeIds: string[],
): string[] {
  if (!typeIds.length) {
    const workflows = bundle?.workflows ?? [];
    if (!workflows.length) return [];
    return dedupeStatesCaseInsensitive(stateIdsFromWorkflowStates(workflows[0]?.states));
  }
  const idSet = new Set(typeIds);
  const types = (bundle?.artifact_types ?? []).filter((at) => idSet.has(at.id));
  return mergeWorkflowStatesForArtifactTypeList(bundle, types);
}

/**
 * Union of workflow states for every workflow referenced by an artifact type, in workflow
 * definition order (workflows array order, then each workflow's state order). De-duplicates.
 * When there are no artifact types or none reference a workflow, falls back to the first workflow.
 */
export function getMergedWorkflowStatesForAllTypes(bundle: ManifestBundleShape | null): string[] {
  const workflows = bundle?.workflows ?? [];
  if (!workflows.length) return [];
  return mergeWorkflowStatesForArtifactTypeList(bundle, bundle?.artifact_types ?? []);
}
