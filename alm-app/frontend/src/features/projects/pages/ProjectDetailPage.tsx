import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Breadcrumbs,
  Link as MuiLink,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Settings, History } from "@mui/icons-material";
import { RhfDescriptionField, RhfTextField } from "../../../shared/components/forms";
import { ProjectNotFoundView } from "../../../shared/components/Layout";
import { StandardPageLayout } from "../../../shared/components/Layout";
import {
  useOrgProjects,
  useUpdateOrgProject,
  useOrgDashboardStats,
  useOrgDashboardActivity,
  type DashboardActivityItem,
} from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";

type SettingsFormValues = {
  name: string;
  description: string;
  status: string;
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffM = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  if (diffM < 1) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString();
}

export default function ProjectDetailPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const { data: projects } = useOrgProjects(orgSlug);
  const { data: stats, isLoading: statsLoading } = useOrgDashboardStats(orgSlug);
  const { data: activity, isLoading: activityLoading } = useOrgDashboardActivity(orgSlug, 8);
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

  const activityList: DashboardActivityItem[] = (activity as DashboardActivityItem[] | undefined) ?? [];
  const projectActivity = activityList.filter((item) => item.project_slug === projectSlug);

  const breadcrumbs = (
    <Breadcrumbs>
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
  );

  return (
    <StandardPageLayout
      breadcrumbs={breadcrumbs}
      title={
        project ? (
          <Box>
            <Typography variant="overline" color="primary" fontWeight={600} component="p">
              {project.code}
            </Typography>
            <Typography component="h1" variant="h4" fontWeight={600}>
              {project.name}
            </Typography>
          </Box>
        ) : undefined
      }
      description={project?.description ?? undefined}
    >
      {project ? (
        <Box>
          {/* Stats row */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Total artifacts
                  </Typography>
                  {statsLoading ? (
                    <CircularProgress size={24} />
                  ) : (
                    <Typography variant="h4" fontWeight={700}>
                      {stats?.artifacts ?? 0}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Open tasks
                  </Typography>
                  {statsLoading ? (
                    <CircularProgress size={24} />
                  ) : (
                    <Typography variant="h4" fontWeight={700}>
                      {stats?.tasks ?? 0}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" variant="body2" gutterBottom>
                    Open defects
                  </Typography>
                  {statsLoading ? (
                    <CircularProgress size={24} />
                  ) : (
                    <Typography variant="h4" fontWeight={700}>
                      {stats?.openDefects ?? 0}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Activity + Settings two-column layout */}
          <Grid container spacing={3}>
            {/* Recent activity */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography
                    variant="overline"
                    color="primary"
                    fontWeight={600}
                    sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                  >
                    <History fontSize="small" />
                    Recent activity
                  </Typography>
                  {activityLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : projectActivity.length > 0 ? (
                    <List dense disablePadding>
                      {projectActivity.map((item) => (
                        <ListItem
                          key={item.artifact_id}
                          component={Link}
                          to={orgSlug && item.project_slug ? `/${orgSlug}/${item.project_slug}/artifacts` : "#"}
                          sx={{ textDecoration: "none", color: "inherit", px: 0 }}
                        >
                          <ListItemText
                            primary={item.title}
                            secondary={
                              <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
                                <Chip size="small" label={item.state} variant="outlined" />
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {item.artifact_type}
                                </Typography>
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {formatRelativeTime(item.updated_at)}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No recent activity in this project.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Project settings */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Card variant="outlined">
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
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Typography color="text.secondary">No project selected.</Typography>
      )}
    </StandardPageLayout>
  );
}
