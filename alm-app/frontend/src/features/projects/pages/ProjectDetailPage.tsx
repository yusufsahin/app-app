import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Breadcrumbs,
  Link as MuiLink,
} from "@mui/material";
import { ArrowBack, AccountTree, Folder, Settings, CalendarMonth, AutoAwesome, ViewColumn } from "@mui/icons-material";
import { RhfDescriptionField, RhfTextField } from "../../../shared/components/forms";
import { ProjectNotFoundView } from "../../../shared/components/Layout";
import {
  useOrgProjects,
  useUpdateOrgProject,
} from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

type SettingsFormValues = {
  name: string;
  description: string;
  status: string;
};

export default function ProjectDetailPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const navigate = useNavigate();
  const { data: projects } = useOrgProjects(orgSlug);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);

  const project = projects?.find((p) => p.slug === projectSlug);
  const updateProject = useUpdateOrgProject(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const form = useForm<SettingsFormValues>({
    defaultValues: { name: "", description: "", status: "" },
  });
  const { reset, handleSubmit, control } = form;

  useEffect(() => {
    if (project) setCurrentProject(project);
    return () => clearCurrentProject();
  }, [project, setCurrentProject, clearCurrentProject]);

  useEffect(() => {
    if (project) {
      reset({
        name: project.name ?? "",
        description: project.description ?? "",
        status: project.status ?? "",
      });
    }
  }, [project, reset]);

  const onSaveSettings = (data: SettingsFormValues) => {
    if (!project?.id) return;
    updateProject.mutate(
      {
        name: data.name.trim() || undefined,
        description: data.description,
        status: data.status.trim() || undefined,
      },
      {
        onSuccess: () => showNotification("Project updated successfully"),
      },
    );
  };

  if (!project && projectSlug && orgSlug) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }

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
              <FormProvider {...form}>
                <Box component="form" onSubmit={handleSubmit(onSaveSettings)} noValidate>
                  <RhfTextField<SettingsFormValues>
                    name="name"
                    label="Name"
                    fullWidth
                    size="small"
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ mb: 2 }}>
                    <RhfDescriptionField<SettingsFormValues>
                      name="description"
                      control={control}
                      mode="text"
                      label="Description"
                      allowModeSwitch
                      rows={4}
                    />
                  </Box>
                  <RhfTextField<SettingsFormValues>
                    name="status"
                    label="Status"
                    fullWidth
                    size="small"
                    placeholder="e.g. active, on-hold"
                    sx={{ mb: 2 }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={updateProject.isPending}
                  >
                    Save
                  </Button>
                </Box>
              </FormProvider>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Typography color="text.secondary">No project selected.</Typography>
      )}
    </Container>
  );
}
