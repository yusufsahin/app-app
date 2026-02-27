import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui";

export interface ProjectNotFoundViewProps {
  orgSlug: string;
  projectSlug?: string | null;
}

/**
 * Shared "project not found" / "no access" view with "Back to projects" link.
 */
export function ProjectNotFoundView({ orgSlug, projectSlug }: ProjectNotFoundViewProps) {
  const projectsPath = `/${orgSlug}`;
  const message = projectSlug
    ? `Project "${projectSlug}" not found or you don't have access.`
    : "Project not found.";

  return (
    <div className="mx-auto max-w-sm py-8 text-center">
      <p className="mb-4 text-muted-foreground">{message}</p>
      <Button asChild>
        <Link to={projectsPath}>
          <ArrowLeft className="mr-2 size-4" />
          Back to projects
        </Link>
      </Button>
    </div>
  );
}
