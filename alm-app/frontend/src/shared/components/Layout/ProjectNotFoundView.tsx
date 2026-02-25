import { Link } from "react-router-dom";
import { Box, Button, Container, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";

export interface ProjectNotFoundViewProps {
  orgSlug: string;
  /** When provided, shown in the message (e.g. "Project \"acme\" not found.") */
  projectSlug?: string | null;
}

/**
 * Shared "project not found" / "no access" view with "Back to projects" link.
 * Use when URL has projectSlug but the project doesn't exist or user has no access.
 */
export function ProjectNotFoundView({ orgSlug, projectSlug }: ProjectNotFoundViewProps) {
  const projectsPath = `/${orgSlug}`;
  const message = projectSlug
    ? `Project "${projectSlug}" not found or you don't have access.`
    : "Project not found.";

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {message}
        </Typography>
        <Button
          component={Link}
          to={projectsPath}
          variant="contained"
          startIcon={<ArrowBack />}
        >
          Back to projects
        </Button>
      </Box>
    </Container>
  );
}
