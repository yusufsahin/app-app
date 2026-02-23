import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Typography, Button, Box } from "@mui/material";
import { ArrowBack, AccountTree, Folder } from "@mui/icons-material";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";

export default function ProjectDetailPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const navigate = useNavigate();
  const { data: projects } = useOrgProjects(orgSlug);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);

  const project = projects?.find((p) => p.slug === projectSlug);

  useEffect(() => {
    if (project) setCurrentProject(project);
    return () => clearCurrentProject();
  }, [project, setCurrentProject, clearCurrentProject]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(orgSlug ? ".." : "/")}
        sx={{ mb: 3 }}
      >
        Back to projects
      </Button>

      {project ? (
        <Box>
          <Typography variant="overline" color="primary" fontWeight={600}>
            {project.code}
          </Typography>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {project.name}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {project.description ?? project.slug}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AccountTree />}
            onClick={() => navigate(`manifest`)}
            sx={{ mr: 1 }}
          >
            Process manifest
          </Button>
          <Button
            variant="outlined"
            startIcon={<Folder />}
            onClick={() => navigate(`artifacts`)}
          >
            Artifacts
          </Button>
        </Box>
      ) : projectSlug ? (
        <Typography color="text.secondary">
          Project &quot;{projectSlug}&quot; not found.
        </Typography>
      ) : (
        <Typography color="text.secondary">No project selected.</Typography>
      )}
    </Container>
  );
}
