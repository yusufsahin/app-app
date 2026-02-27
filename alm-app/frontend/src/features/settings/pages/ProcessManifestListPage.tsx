import { Link, useParams } from "react-router-dom";
import { Network, Edit, FolderX } from "lucide-react";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { StandardPageLayout } from "../../../shared/components/Layout/StandardPageLayout";
import { OrgSettingsBreadcrumbs } from "../../../shared/components/Layout";
import { SettingsPageWrapper } from "../components/SettingsPageWrapper";

/**
 * Organization settings → Process manifest: list projects and link to each project's manifest editor.
 */
export default function ProcessManifestListPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: projects = [], isLoading } = useOrgProjects(orgSlug);

  return (
    <SettingsPageWrapper>
      <StandardPageLayout
        breadcrumbs={<OrgSettingsBreadcrumbs currentPageLabel="Process manifest" />}
        title="Process manifest"
        description="Edit workflow, artifact types, and process template per project. Select a project to open its manifest."
      >
        {isLoading ? (
          <LoadingState label="Loading projects…" />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderX className="size-12" />}
            title="No projects"
            description="There are no projects in this organization yet. Create a project to manage process manifests."
            bordered
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  to={orgSlug ? `/${orgSlug}/${project.slug}/manifest` : "#"}
                  className="flex items-center gap-3 px-4 py-3 no-underline text-foreground transition-colors hover:bg-muted/50"
                >
                  <Network className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{project.name}</p>
                    {project.description && (
                      <p className="text-sm text-muted-foreground">{project.description}</p>
                    )}
                  </div>
                  <Edit className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StandardPageLayout>
    </SettingsPageWrapper>
  );
}
