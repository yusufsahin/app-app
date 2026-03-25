import { Link } from "react-router-dom";
import { ClipboardCheck, GitBranch, FolderTree, ListChecks, PlayCircle, Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/components/ui";
import { useArtifacts } from "../../../shared/api/artifactApi";
import {
  qualityPath,
  qualityTraceabilityPath,
  qualityTestsPath,
  qualitySuitesPath,
  qualityRunsPath,
  qualityCampaignsPath,
} from "../../../shared/utils/appPaths";

export interface QualityHubHeaderProps {
  orgSlug: string;
  projectSlug: string;
  /** When set, hub shows a short “Recently updated” list on the Quality tree. */
  projectId?: string;
  /** Total artifacts when filtered to Quality tree (lightweight list query). */
  totalInQualityTree: number | undefined;
  /** Whether manifest defines `tree_id` "quality". */
  hasQualityTree: boolean;
  isLoadingTotal: boolean;
}

export function QualityHubHeader({
  orgSlug,
  projectSlug,
  projectId,
  totalInQualityTree,
  hasQualityTree,
  isLoadingTotal,
}: QualityHubHeaderProps) {
  const tracePath = qualityTraceabilityPath(orgSlug, projectSlug);
  const { data: recentList, isLoading: recentLoading } = useArtifacts(
    orgSlug,
    projectId,
    undefined,
    undefined,
    "updated_at",
    "desc",
    undefined,
    5,
    0,
    false,
    undefined,
    undefined,
    undefined,
    hasQualityTree && projectId ? "quality" : null,
    false,
  );
  const navClass =
    "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent sm:text-sm";

  return (
    <div className="space-y-4">
      {hasQualityTree ? (
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          <Link
            to={qualityTestsPath(orgSlug, projectSlug)}
            className={navClass}
            data-testid="quality-nav-tests"
          >
            <ListChecks className="size-3.5 shrink-0 opacity-70" />
            Tests
          </Link>
          <Link
            to={qualitySuitesPath(orgSlug, projectSlug)}
            className={navClass}
            data-testid="quality-nav-suites"
          >
            <Layers className="size-3.5 shrink-0 opacity-70" />
            Suites
          </Link>
          <Link
            to={qualityRunsPath(orgSlug, projectSlug)}
            className={navClass}
            data-testid="quality-nav-runs"
          >
            <PlayCircle className="size-3.5 shrink-0 opacity-70" />
            Runs
          </Link>
          <Link
            to={qualityCampaignsPath(orgSlug, projectSlug)}
            className={navClass}
            data-testid="quality-nav-campaigns"
          >
            <FolderTree className="size-3.5 shrink-0 opacity-70" />
            Campaigns
          </Link>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Quality</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Work items under the Quality tree in this project. Same data as Artifacts with a quality-focused entry
              and optional traceability links between artifacts.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to={tracePath}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <GitBranch className="size-4" />
            Traceability
          </Link>
        </div>
      </div>

      {hasQualityTree ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quality tree</CardTitle>
            <CardDescription>Artifacts under the manifest Quality root (excluding list pagination).</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTotal ? (
              <p className="text-sm text-muted-foreground">Loading count…</p>
            ) : (
              <p className="text-2xl font-semibold tabular-nums">
                {totalInQualityTree ?? 0}
                <span className="ml-2 text-sm font-normal text-muted-foreground">items</span>
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
      {hasQualityTree && projectId ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recently updated</CardTitle>
            <CardDescription>Latest changes in the Quality tree (up to five).</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (recentList?.items?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(recentList?.items ?? []).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <span className="min-w-0 truncate font-medium">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{a.artifact_type}</span>
                    <Link
                      to={qualityPath(orgSlug, projectSlug, { artifact: a.id, tree: "quality" })}
                      className="text-xs text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
      {!hasQualityTree ? (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quality tree not configured</CardTitle>
            <CardDescription>
              This project&apos;s manifest has no <code className="rounded bg-muted px-1 text-xs">tree_id</code>{" "}
              <code className="rounded bg-muted px-1 text-xs">quality</code>. Add it under{" "}
              <code className="rounded bg-muted px-1 text-xs">tree_roots</code> or use the default process template.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
