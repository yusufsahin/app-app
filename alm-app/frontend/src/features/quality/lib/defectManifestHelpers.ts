import type { ManifestResponse } from "../../../shared/api/manifestApi";
import type { Artifact } from "../../../shared/stores/artifactStore";

type ManifestBundle = ManifestResponse["manifest_bundle"];

/** Built-in templates use artifact type `defect` under `root-defect`. */
export function pickDefectArtifactType(_bundle: ManifestBundle | undefined): string {
  return "defect";
}

export function findRootDefectId(items: Artifact[] | undefined): string | null {
  const root = items?.find((a) => a.artifact_type === "root-defect");
  return root?.id ?? null;
}
