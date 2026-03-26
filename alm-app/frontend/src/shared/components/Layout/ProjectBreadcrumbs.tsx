import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui";
import { Button } from "../ui";

export interface ProjectBreadcrumbsProps {
  currentPageLabel: string;
  projectName?: string | null;
}

/**
 * Shared breadcrumbs + "Back to project" for project-scoped pages.
 */
export function ProjectBreadcrumbs({ currentPageLabel, projectName }: ProjectBreadcrumbsProps) {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug?: string }>();
  const projectDetailPath = orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "#";
  const displayName = projectName ?? projectSlug ?? "Project";

  return (
    <div className="mb-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={orgSlug ? `/${orgSlug}` : "#"}>{orgSlug ?? "Org"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={projectDetailPath}>{displayName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentPageLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Button variant="ghost" size="sm" className="mt-2" asChild>
        <Link to={projectDetailPath}>
          <ArrowLeft className="mr-2 size-4" />
          Back to project
        </Link>
      </Button>
    </div>
  );
}
