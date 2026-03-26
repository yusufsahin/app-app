/**
 * Tree filter slugs from manifest bundle (tree_roots) with ALM defaults.
 */
export type ManifestTreeRoot = {
  tree_id: string;
  root_artifact_type: string;
  label: string;
};

const DEFAULT_TREE_ROOTS: ManifestTreeRoot[] = [
  { tree_id: "requirement", root_artifact_type: "root-requirement", label: "Requirements" },
  { tree_id: "quality", root_artifact_type: "root-quality", label: "Quality" },
  { tree_id: "defect", root_artifact_type: "root-defect", label: "Defects" },
];

type RawRoot = {
  tree_id?: string;
  id?: string;
  root_artifact_type?: string;
  root_type?: string;
  label?: string;
  name?: string;
};

export function getTreeRootsFromManifestBundle(
  bundle: { tree_roots?: RawRoot[] } | null | undefined,
): ManifestTreeRoot[] {
  const raw = bundle?.tree_roots;
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_TREE_ROOTS;
  }
  const out: ManifestTreeRoot[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const tree_id = String(e.tree_id ?? e.id ?? "").trim();
    const root_artifact_type = String(e.root_artifact_type ?? e.root_type ?? "").trim();
    if (!tree_id || !root_artifact_type) continue;
    const labelRaw = String(e.label ?? e.name ?? "").trim();
    out.push({
      tree_id,
      root_artifact_type,
      label: labelRaw || tree_id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }
  return out.length > 0 ? out : DEFAULT_TREE_ROOTS;
}

/**
 * Declared-only tree roots from manifest bundle (no defaults).
 * Use this when the UI must know whether a tree is explicitly configured.
 */
export function getDeclaredTreeRootsFromManifestBundle(
  bundle: { tree_roots?: RawRoot[] } | null | undefined,
): ManifestTreeRoot[] {
  const raw = bundle?.tree_roots;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: ManifestTreeRoot[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const tree_id = String(e.tree_id ?? e.id ?? "").trim();
    const root_artifact_type = String(e.root_artifact_type ?? e.root_type ?? "").trim();
    if (!tree_id || !root_artifact_type) continue;
    const labelRaw = String(e.label ?? e.name ?? "").trim();
    out.push({
      tree_id,
      root_artifact_type,
      label: labelRaw || tree_id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }
  return out;
}
