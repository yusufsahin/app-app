/**
 * Helpers for reading workflow state lists from manifest bundle (e.g. for Board columns).
 * Kept in sync with frontend/src/shared/lib/workflowManifest.ts
 */

export interface ManifestBundleWorkflow {
  id: string;
  states?: unknown[];
  transitions?: Array<{ from: string; to: string }>;
}

export interface ManifestBundleArtifactType {
  id: string;
  name?: string;
  workflow_id?: string;
  is_system_root?: boolean;
}

export function isBoardSelectableArtifactType(at: ManifestBundleArtifactType): boolean {
  return !at.id.startsWith('root-') && at.is_system_root !== true;
}

export interface ManifestBundleShape {
  workflows?: ManifestBundleWorkflow[];
  artifact_types?: ManifestBundleArtifactType[];
}

function stateIdsFromWorkflowStates(states: unknown[] | undefined): string[] {
  if (!states?.length) return [];
  const arr = states as Array<string | { id: string }>;
  return arr.map((s) => (typeof s === 'string' ? s : s.id));
}

function stateIdAndLabelFromEntry(entry: unknown): { id: string; label: string } {
  if (typeof entry === 'string') return { id: entry, label: entry };
  const o = entry as { id: string; name?: string };
  const id = o.id;
  const name = o.name?.trim();
  return { id, label: name ? name : id };
}

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

export function getWorkflowStateLabelForArtifactType(
  bundle: ManifestBundleShape | null,
  artifactTypeId: string | null | undefined,
  stateId: string | null | undefined,
): string {
  const rawId = (stateId ?? '').trim();
  if (!rawId) return '';
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
  const map = buildWorkflowStateDisplayMap(bundle);
  for (const [id, label] of map) {
    if (normalizeWorkflowStateKey(id) === target) return label;
  }
  return rawId;
}

const EMPTY_STATE_NORMALIZED = '\u0000';

export function normalizeWorkflowStateKey(state: string | null | undefined): string {
  const s = (state ?? '').trim();
  return s.length === 0 ? EMPTY_STATE_NORMALIZED : s.toLowerCase();
}

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

export function getWorkflowForArtifactType(
  bundle: ManifestBundleShape | null,
  artifactTypeId: string | null,
): ManifestBundleWorkflow | undefined {
  const workflows = bundle?.workflows ?? [];
  if (!workflows.length) return undefined;
  let wf = workflows[0];
  if (artifactTypeId && bundle?.artifact_types?.length) {
    const at = bundle.artifact_types.find((a) => a.id === artifactTypeId);
    if (at?.workflow_id) {
      const found = workflows.find((w) => w.id === at.workflow_id);
      if (found) wf = found;
    }
  }
  return wf;
}

export function getWorkflowStatesForType(
  bundle: ManifestBundleShape | null,
  artifactTypeId: string | null,
): string[] {
  const wf = getWorkflowForArtifactType(bundle, artifactTypeId);
  return dedupeStatesCaseInsensitive(stateIdsFromWorkflowStates(wf?.states));
}

export function inferCategoryFromStateEntry(entry: unknown): string {
  if (typeof entry === 'string') return 'proposed';
  const o = entry as { category?: string };
  const c = o.category?.trim().toLowerCase();
  if (c === 'proposed' || c === 'in_progress' || c === 'completed') return c;
  return 'proposed';
}

export function categoryForStateInWorkflow(
  wf: ManifestBundleWorkflow | undefined,
  stateId: string,
): string | null {
  if (!wf?.states) return null;
  const target = normalizeWorkflowStateKey(stateId);
  for (const raw of wf.states) {
    const id = typeof raw === 'string' ? raw : (raw as { id: string }).id;
    if (normalizeWorkflowStateKey(id) === target) return inferCategoryFromStateEntry(raw);
  }
  return null;
}

export function firstStateIdInCategoryForWorkflow(
  wf: ManifestBundleWorkflow | undefined,
  categoryKey: string,
): string | null {
  if (!wf?.states) return null;
  const ck = categoryKey.trim().toLowerCase();
  for (const raw of wf.states) {
    const id = typeof raw === 'string' ? raw : (raw as { id: string }).id;
    if (inferCategoryFromStateEntry(raw).toLowerCase() === ck) return id;
  }
  return null;
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

export function getMergedWorkflowStatesForAllTypes(bundle: ManifestBundleShape | null): string[] {
  const workflows = bundle?.workflows ?? [];
  if (!workflows.length) return [];
  return mergeWorkflowStatesForArtifactTypeList(bundle, bundle?.artifact_types ?? []);
}
