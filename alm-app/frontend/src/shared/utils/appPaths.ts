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
 */
export function qualityCatalogPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/catalog`;
}

/** Requirement tree coverage analysis (verifies + last execution). */
export function requirementsCoveragePath(
  orgSlug: string,
  projectSlug: string,
  params?: {
    under?: string;
    scopeRun?: string;
    scopeSuite?: string;
    scopeCampaign?: string;
    refresh?: boolean;
  },
): string {
  const base = `/${orgSlug}/${projectSlug}/requirements/coverage`;
  if (!params || Object.keys(params).length === 0) return base;
  const search = new URLSearchParams();
  if (params.under) search.set("under", params.under);
  if (params.scopeRun) search.set("scopeRun", params.scopeRun);
  if (params.scopeSuite) search.set("scopeSuite", params.scopeSuite);
  if (params.scopeCampaign) search.set("scopeCampaign", params.scopeCampaign);
  if (params.refresh) search.set("refresh", "1");
  const q = search.toString();
  return q ? `${base}?${q}` : base;
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
 */
export function qualityCampaignPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/campaign`;
}

export function qualityRunsPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/runs`;
}

/** Quality → Defects triage list (defect tree subtree; same artifact model as Artifacts). */
export function qualityDefectsPath(
  orgSlug: string,
  projectSlug: string,
  params?: { page?: number; q?: string; state?: string; under?: string },
): string {
  const base = `/${orgSlug}/${projectSlug}/quality/defects`;
  const underTrim = params?.under?.trim();
  if (
    !params ||
    ((params.page == null || params.page <= 1) &&
      !params.q?.trim() &&
      !params.state?.trim() &&
      !underTrim)
  ) {
    return base;
  }
  const search = new URLSearchParams();
  if (params.page != null && params.page > 1) search.set("page", String(params.page));
  const q = params.q?.trim();
  if (q) search.set("q", q);
  const st = params.state?.trim();
  if (st) search.set("state", st);
  if (underTrim) search.set("under", underTrim);
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export function qualityCampaignsPath(orgSlug: string, projectSlug: string): string {
  return `/${orgSlug}/${projectSlug}/quality/campaigns`;
}
