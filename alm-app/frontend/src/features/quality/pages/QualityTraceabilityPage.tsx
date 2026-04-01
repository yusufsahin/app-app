import { useMemo, useState, useEffect, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { useBacklogWorkspaceProject } from "../../artifacts/pages/useBacklogWorkspaceProject";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useArtifacts } from "../../../shared/api/artifactApi";
import { getDeclaredTreeRootsFromManifestBundle } from "../../../shared/lib/manifestTreeRoots";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "../../../shared/components/ui";
import { LoadingState } from "../../../shared/components/LoadingState";
import { qualityPath } from "../../../shared/utils/appPaths";
import { QualityFolderTreeNav } from "../components/QualityFolderTreeNav";

function isUuid(value: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Browse Quality-tree artifacts and open each to view or edit links in the details panel.
 * Project-wide link listing is not available in the API; links are per artifact.
 */
export default function QualityTraceabilityPage() {
  const { orgSlug, projectSlug, project, projectsLoading } = useBacklogWorkspaceProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const treeRootOptions = useMemo(
    () => getDeclaredTreeRootsFromManifestBundle(manifest?.manifest_bundle),
    [manifest?.manifest_bundle],
  );
  const hasQualityTree = useMemo(
    () => treeRootOptions.some((t) => t.tree_id === "quality"),
    [treeRootOptions],
  );
  const selectedUnder = isUuid(searchParams.get("under")) ? searchParams.get("under") : null;
  const qFromUrl = searchParams.get("q")?.trim() ?? "";
  const [searchDraft, setSearchDraft] = useState(qFromUrl);

  useEffect(() => {
    setSearchDraft(qFromUrl);
  }, [qFromUrl]);

  const { data: listResult, isLoading } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "updated_at",
    "desc",
    qFromUrl || undefined,
    250,
    0,
    false,
    undefined,
    undefined,
    undefined,
    hasQualityTree ? "quality" : null,
    false,
    selectedUnder,
  );

  const items = listResult?.items ?? [];
  const qualityBase =
    orgSlug && projectSlug ? qualityPath(orgSlug, projectSlug) : "#";

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchDraft.trim();
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (q) n.set("q", q);
        else n.delete("q");
        return n;
      },
      { replace: true },
    );
  };

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return (
      <div className="mx-auto max-w-5xl py-6">
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl min-h-0 flex-col gap-4 px-4 pb-6 pt-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:w-64">
        <QualityFolderTreeNav
          orgSlug={orgSlug}
          projectId={project?.id}
          manifestBundle={manifest?.manifest_bundle}
        />
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <ProjectBreadcrumbs currentPageLabel="Traceability" projectName={project?.name} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={qualityBase}>Back to Quality</Link>
          </Button>
        </div>

        <Card>
        <CardHeader>
          <CardTitle>Quality traceability</CardTitle>
          <CardDescription>
            Backlog items in the Quality tree (paginated by last updated). Open an item to view and manage outgoing links
            in the side panel. Link types are defined in the project manifest (
            <code className="rounded bg-muted px-1 text-xs">link_types</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasQualityTree ? (
            <form onSubmit={onSearchSubmit} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="quality-trace-q" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Search title / key
                </label>
                <Input
                  id="quality-trace-q"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Search…"
                  className="max-w-md"
                />
              </div>
              <Button type="submit" size="sm">
                Search
              </Button>
              {qFromUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchDraft("");
                    setSearchParams((prev) => {
                      const n = new URLSearchParams(prev);
                      n.delete("q");
                      return n;
                    }, { replace: true });
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </form>
          ) : null}

          {!hasQualityTree ? (
            <p className="text-sm text-muted-foreground">
              This project has no Quality tree in the manifest. Configure{" "}
              <code className="rounded bg-muted px-1 text-xs">tree_roots</code> with{" "}
              <code className="rounded bg-muted px-1 text-xs">tree_id: quality</code>.
            </p>
          ) : isLoading ? (
            <LoadingState label="Loading artifacts…" minHeight={120} />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No artifacts in the Quality tree match this view.</p>
          ) : (
            <>
              <div className="space-y-2">
                {items.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.artifact_key ?? "—"} • {a.artifact_type}
                      </p>
                    </div>
                    <Link
                      to={
                        orgSlug && projectSlug
                          ? qualityPath(orgSlug, projectSlug, {
                              artifact: a.id,
                              tree: "quality",
                            })
                          : "#"
                      }
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Details
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
}
