import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useArtifactsPageProject } from "../../artifacts/pages/useArtifactsPageProject";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useArtifacts } from "../../../shared/api/artifactApi";
import { getDeclaredTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import { QualityFolderTreeNav } from "../components/QualityFolderTreeNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/components/ui";
import {
  qualityRunsPath,
  qualityCampaignPath,
  qualityCatalogPath,
  qualityTraceabilityPath,
  qualityDefectsPath,
} from "../../../shared/utils/appPaths";

/**
 * Quality landing page for test management.
 */
export default function QualityPage() {
  const { orgSlug, projectSlug, project } = useArtifactsPageProject();
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const treeRootOptions = useMemo(
    () => getDeclaredTreeRootsFromManifestBundle(manifest?.manifest_bundle),
    [manifest?.manifest_bundle],
  );
  const hasQualityTree = useMemo(
    () => treeRootOptions.some((t) => t.tree_id === "quality"),
    [treeRootOptions],
  );

  const { data: countResult, isLoading: countLoading } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "updated_at",
    "desc",
    undefined,
    1,
    0,
    false,
    undefined,
    undefined,
    undefined,
    hasQualityTree ? "quality" : null,
    false,
  );

  return (
    <div className="mx-auto flex max-w-6xl min-h-0 flex-col gap-4 px-4 pb-6 pt-6 lg:flex-row lg:items-start">
      {hasQualityTree ? (
        <aside className="w-full shrink-0 lg:w-64">
          <QualityFolderTreeNav
            orgSlug={orgSlug}
            projectId={project?.id}
            manifestBundle={manifest?.manifest_bundle}
          />
        </aside>
      ) : null}
      <div className="min-w-0 flex-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Quality Test Management</CardTitle>
            <CardDescription>
              Tree-first workspace: catalog (groups and test cases), campaign (suites), runs and traceability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {hasQualityTree ? (
              <p>
                {countLoading ? "Loading count..." : `${countResult?.total ?? 0} items`} in quality tree.
              </p>
            ) : (
              <p>Quality tree not configured in manifest.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {orgSlug && projectSlug ? (
            <>
              <Link className="rounded-lg border bg-card p-4 text-sm font-medium hover:bg-muted/40" to={qualityCatalogPath(orgSlug, projectSlug)}>Catalog</Link>
              <Link className="rounded-lg border bg-card p-4 text-sm font-medium hover:bg-muted/40" to={qualityCampaignPath(orgSlug, projectSlug)}>Campaign</Link>
              <Link className="rounded-lg border bg-card p-4 text-sm font-medium hover:bg-muted/40" to={qualityRunsPath(orgSlug, projectSlug)}>Runs</Link>
              <Link className="rounded-lg border bg-card p-4 text-sm font-medium hover:bg-muted/40" to={qualityDefectsPath(orgSlug, projectSlug)}>Defects</Link>
              <Link className="rounded-lg border bg-card p-4 text-sm font-medium hover:bg-muted/40" to={qualityTraceabilityPath(orgSlug, projectSlug)}>Traceability</Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
