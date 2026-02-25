/**
 * App path builders for navigation (pure, testable).
 */

/**
 * Path to artifacts list, optionally with query params.
 */
export function artifactsPath(
  orgSlug: string,
  projectSlug: string,
  params?: {
    artifact?: string;
    state?: string;
    type?: string;
    cycleNodeFilter?: string;
    areaNodeFilter?: string;
  },
): string {
  const base = `/${orgSlug}/${projectSlug}/artifacts`;
  if (!params || Object.keys(params).length === 0) return base;
  const search = new URLSearchParams();
  if (params.artifact) search.set("artifact", params.artifact);
  if (params.state) search.set("state", params.state);
  if (params.type) search.set("type", params.type);
  if (params.cycleNodeFilter) search.set("cycle_node_id", params.cycleNodeFilter);
  if (params.areaNodeFilter) search.set("area_node_id", params.areaNodeFilter);
  const q = search.toString();
  return q ? `${base}?${q}` : base;
}

/**
 * Path to a single artifact detail (opens in list context).
 */
export function artifactDetailPath(orgSlug: string, projectSlug: string, artifactId: string): string {
  return artifactsPath(orgSlug, projectSlug, { artifact: artifactId });
}
