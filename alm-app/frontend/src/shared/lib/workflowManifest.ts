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
}

export interface ManifestBundleShape {
  workflows?: ManifestBundleWorkflow[];
  artifact_types?: ManifestBundleArtifactType[];
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
  if (!wf?.states?.length) return [];
  const states = wf.states as Array<string | { id: string }>;
  return states.map((s) => (typeof s === "string" ? s : s.id));
}
