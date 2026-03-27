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

/**
 * Path to Quality hub, optionally with artifact drawer and tree filter.
 */
export function qualityPath(
  orgSlug: string,
  projectSlug: string,
  params?: {
    artifact?: string;
    tree?: string;
  },
): string {
  const base = `/${orgSlug}/${projectSlug}/quality`;
  if (!params || Object.keys(params).length === 0) return base;
  const search = new URLSearchParams();
  if (params.artifact) search.set("artifact", params.artifact);
  if (params.tree) search.set("tree", params.tree);
  const q = search.toString();
  return q ? `${base}?${q}` : base;
}

/** Path to Quality traceability table (artifact list for link context). */
export function qualityTraceabilityPath(
  orgSlug: string,
  projectSlug: string,
  params?: { page?: number; q?: string },
): string {
  const base = `/${orgSlug}/${projectSlug}/quality/traceability`;
  if (!params || (params.page == null || params.page <= 1) && !params.q?.trim()) {
    return base;
  }
  const search = new URLSearchParams();
  if (params.page != null && params.page > 1) search.set("page", String(params.page));
  const q = params.q?.trim();
  if (q) search.set("q", q);
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Catalog workspace (test cases under groups; manifest `tree_id: quality`).
 * Canonical segment is `quality/catalog`; `/quality/tests` redirects for old bookmarks.
 */
export function qualityCatalogPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/catalog`;
}

/** Catalog deep link: optional `under` folder + `artifact` test case (tree-detail workspace). */
export function qualityCatalogArtifactPath(
  orgSlug: string,
  projectSlug: string,
  artifactId: string,
  underFolderId?: string | null,
): string {
  const search = new URLSearchParams();
  const under = underFolderId?.trim();
  if (under) search.set("under", under);
  search.set("artifact", artifactId);
  return `${qualityCatalogPath(orgSlug, projectSlug)}?${search.toString()}`;
}

/**
 * Campaign workspace: collections + test suites (manifest `tree_id: testsuites`).
 * Canonical segment is `quality/campaign`; `/quality/suites` redirects here for old bookmarks.
 */
export function qualityCampaignPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/campaign`;
}

export function qualityRunsPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/runs`;
}

export function qualityCampaignsPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/campaigns`;
}
