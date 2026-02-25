/**
 * Pure helpers for ProjectSwitcher: pinned projects (localStorage) and project path segment.
 * Extracted for unit testing.
 */

export const MAX_PINNED = 8;

export function getPinnedKey(orgSlug: string): string {
  return `alm_pinned_projects_${orgSlug}`;
}

export function getPinnedSlugs(orgSlug: string | undefined): string[] {
  if (!orgSlug || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getPinnedKey(orgSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_PINNED)
      : [];
  } catch {
    return [];
  }
}

export function setPinnedSlugs(orgSlug: string | undefined, slugs: string[]): void {
  if (!orgSlug || typeof window === "undefined") return;
  try {
    localStorage.setItem(getPinnedKey(orgSlug), JSON.stringify(slugs.slice(0, MAX_PINNED)));
  } catch {
    /* ignore */
  }
}

/** Project-scoped path segments (must match router). */
export const PROJECT_SEGMENTS = ["manifest", "planning", "artifacts", "board", "automation"] as const;

export function getProjectSegment(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const segment = parts[2] ?? null;
  if (
    parts.length >= 3 &&
    segment &&
    PROJECT_SEGMENTS.includes(segment as (typeof PROJECT_SEGMENTS)[number])
  ) {
    return segment;
  }
  return null;
}
