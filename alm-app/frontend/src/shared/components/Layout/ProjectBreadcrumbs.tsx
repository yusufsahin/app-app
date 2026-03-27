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

export interface BreadcrumbSegment {
  label: string;
  to?: string;
}

export interface ProjectBreadcrumbsProps {
  currentPageLabel: string;
  projectName?: string | null;
  /** Segments after Project and before the current page (e.g. Quality → Catalog → group). */
  trailBeforeCurrent?: BreadcrumbSegment[];
  /** When false, hides the ghost “Back to project” link (breadcrumb links remain). */
  showBackToProject?: boolean;
}

/**
 * Shared breadcrumbs + "Back to project" for project-scoped pages.
 */
export function ProjectBreadcrumbs({
  currentPageLabel,
  projectName,
  trailBeforeCurrent,
  showBackToProject = true,
}: ProjectBreadcrumbsProps) {
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
          {(trailBeforeCurrent ?? []).map((seg, idx) => (
            <span key={`trail-${idx}-${seg.label}`} className="contents">
              <BreadcrumbItem>
                {seg.to ? (
                  <BreadcrumbLink asChild>
                    <Link to={seg.to}>{seg.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span className="font-medium text-foreground">{seg.label}</span>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </span>
          ))}
          <BreadcrumbItem>
            <BreadcrumbPage>{currentPageLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {showBackToProject ? (
        <Button variant="ghost" size="sm" className="mt-2" asChild>
          <Link to={projectDetailPath}>
            <ArrowLeft className="mr-2 size-4" />
            Back to project
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
