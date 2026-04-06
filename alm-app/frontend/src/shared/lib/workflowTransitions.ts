/**
 * Valid workflow transitions from manifest bundle (shared kernel; no React).
 */

export type WorkflowTransition = { from: string; to: string };

export type ManifestBundleForTransitions = {
  workflows?: Array<{ id: string; transitions?: WorkflowTransition[] }>;
  artifact_types?: Array<{ id: string; workflow_id?: string }>;
} | null;

/** Derive valid target states from manifest workflow transitions. */
export function getValidTransitionsFromBundle(
  bundle: ManifestBundleForTransitions,
  artifactType: string,
  currentState: string,
): string[] {
  if (!bundle) return [];
  const workflows = bundle.workflows ?? [];
  const artifactTypes = bundle.artifact_types ?? [];
  const at = artifactTypes.find((a) => a.id === artifactType);
  if (!at?.workflow_id) return [];
  const wf = workflows.find((w) => w.id === at.workflow_id);
  if (!wf?.transitions) return [];
  return wf.transitions.filter((t) => t.from === currentState).map((t) => t.to);
}
