import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  TextField,
  Card,
  CardContent,
  Breadcrumbs,
  Link as MuiLink,
} from "@mui/material";
import { ArrowBack, AccountTree, Folder, Settings, CalendarMonth, AutoAwesome, ViewColumn } from "@mui/icons-material";
import {
  useOrgProjects,
  useUpdateOrgProject,
} from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

export default function ProjectDetailPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const navigate = useNavigate();
  const { data: projects } = useOrgProjects(orgSlug);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);

  const project = projects?.find((p) => p.slug === projectSlug);
  const updateProject = useUpdateOrgProject(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");

  useEffect(() => {
    if (project) setCurrentProject(project);
    return () => clearCurrentProject();
  }, [project, setCurrentProject, clearCurrentProject]);

  useEffect(() => {
    if (project) {
      setSettingsName(project.name ?? "");
      setSettingsDescription(project.description ?? "");
      setSettingsStatus(project.status ?? "");
    }
  }, [project]);

  const handleSaveSettings = () => {
    if (!project?.id) return;
    updateProject.mutate(
      {
        name: settingsName.trim() || undefined,
        description: settingsDescription,
        status: settingsStatus.trim() || undefined,
      },
      {
        onSuccess: () => showNotification("Project updated successfully"),
      },
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink
          component={Link}
          to={orgSlug ? `/${orgSlug}` : "#"}
          underline="hover"
          color="inherit"
        >
          {orgSlug ?? "Org"}
        </MuiLink>
        <Typography color="text.primary">
          {project?.name ?? projectSlug ?? "Project"}
        </Typography>
      </Breadcrumbs>
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
            startIcon={<CalendarMonth />}
            onClick={() => navigate(`planning`)}
            sx={{ mr: 1 }}
          >
            Planning
          </Button>
          <Button
            variant="outlined"
            startIcon={<Folder />}
            onClick={() => navigate(`artifacts`)}
            sx={{ mr: 1 }}
          >
            Artifacts
          </Button>
          <Button
            variant="outlined"
            startIcon={<ViewColumn />}
            onClick={() => navigate(`board`)}
            sx={{ mr: 1 }}
          >
            Board
          </Button>
          <Button
            variant="outlined"
            startIcon={<AutoAwesome />}
            onClick={() => navigate(`automation`)}
            sx={{ mr: 1 }}
          >
            Automation
          </Button>

          <Card variant="outlined" sx={{ mt: 3, maxWidth: 560 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Settings fontSize="small" />
                Settings
              </Typography>
              <TextField
                label="Name"
                fullWidth
                size="small"
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Description"
                fullWidth
                size="small"
                multiline
                minRows={2}
                value={settingsDescription}
                onChange={(e) => setSettingsDescription(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Status"
                fullWidth
                size="small"
                placeholder="e.g. active, on-hold"
                value={settingsStatus}
                onChange={(e) => setSettingsStatus(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={handleSaveSettings}
                disabled={updateProject.isPending}
              >
                Save
              </Button>
            </CardContent>
          </Card>
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
