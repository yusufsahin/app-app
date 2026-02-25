import { Link, useParams } from "react-router-dom";
import { Box, Breadcrumbs, Button, Link as MuiLink, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";

export interface ProjectBreadcrumbsProps {
  /** Current page label (e.g. "Manifest", "Board") */
  currentPageLabel: string;
  /** Project display name (falls back to projectSlug if not provided) */
  projectName?: string | null;
}

/**
 * Shared breadcrumbs + "Back to project" for project-scoped pages.
 * Uses orgSlug and projectSlug from route params.
 */
export function ProjectBreadcrumbs({ currentPageLabel, projectName }: ProjectBreadcrumbsProps) {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug?: string }>();
  const projectDetailPath = orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "#";
  const displayName = projectName ?? projectSlug ?? "Project";

  return (
    <Box sx={{ mb: 2 }}>
      <Breadcrumbs sx={{ mb: 1.5 }}>
        <MuiLink component={Link} to={orgSlug ? `/${orgSlug}` : "#"} underline="hover" color="inherit">
          {orgSlug ?? "Org"}
        </MuiLink>
        <MuiLink component={Link} to={projectDetailPath} underline="hover" color="inherit">
          {displayName}
        </MuiLink>
        <Typography color="text.primary">{currentPageLabel}</Typography>
      </Breadcrumbs>
      <Button
        component={Link}
        to={projectDetailPath}
        startIcon={<ArrowBack />}
        sx={{ mb: 2 }}
      >
        Back to project
      </Button>
    </Box>
  );
}
