import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Breadcrumbs,
  Link as MuiLink,
  List,
  ListItem,
  ListItemText,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { History } from "@mui/icons-material";
import {
  useOrgDashboardStats,
  useOrgProjects,
  useOrgDashboardActivity,
  type DashboardActivityItem,
} from "../../../shared/api/orgApi";
import { StandardPageLayout } from "../../../shared/components/Layout";
import { useProjectStore } from "../../../shared/stores/projectStore";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffM = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  if (diffM < 1) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString();
}

function StatCard({
  label,
  value,
  isLoading,
  to,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  to?: string;
}) {
  const content = (
    <Card
      sx={{
        height: "100%",
        transition: "box-shadow 0.2s",
        ...(to ? { "&:hover": { boxShadow: 2 } } : {}),
      }}
    >
      <CardContent>
        <Typography color="text.secondary" gutterBottom>
          {label}
        </Typography>
        {isLoading ? (
          <CircularProgress size={32} />
        ) : (
          <Typography variant="h3">{value}</Typography>
        )}
      </CardContent>
    </Card>
  );

  return to ? (
    <MuiLink component={Link} to={to} underline="none" color="inherit" sx={{ display: "block" }}>
      {content}
    </MuiLink>
  ) : (
    content
  );
}

export default function DashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const lastVisitedSlug = useProjectStore((s) => s.lastVisitedProjectSlug);
  const { data: stats, isLoading, error } = useOrgDashboardStats(orgSlug);
  const { data: projects = [], isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const { data: activity, isLoading: activityLoading } = useOrgDashboardActivity(orgSlug, 10);

  const firstProject = projects[0];
  const defaultSlug =
    (lastVisitedSlug && projects.some((p) => p.slug === lastVisitedSlug) ? lastVisitedSlug : null) ??
    firstProject?.slug ??
    null;
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showOnlySelectedProject, setShowOnlySelectedProject] = useState(false);
  const effectiveSlug = selectedSlug ?? defaultSlug;
  const selectedProject = effectiveSlug ? projects.find((p) => p.slug === effectiveSlug) : null;

  const activityList: DashboardActivityItem[] = (activity as DashboardActivityItem[] | undefined) ?? [];
  const filteredActivity =
    effectiveSlug && showOnlySelectedProject
      ? activityList.filter((item) => item.project_slug === effectiveSlug)
      : activityList;

  const projectsPath = orgSlug ? `/${orgSlug}` : "#";
  const artifactsPath =
    orgSlug && selectedProject ? `/${orgSlug}/${selectedProject.slug}/artifacts` : undefined;
  const tasksPath =
    orgSlug && selectedProject
      ? `/${orgSlug}/${selectedProject.slug}/artifacts?type=task`
      : undefined;
  const openDefectsPath =
    orgSlug && selectedProject
      ? `/${orgSlug}/${selectedProject.slug}/artifacts?type=defect&state=Open`
      : undefined;

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
      <Typography color="text.primary">Dashboard</Typography>
    </Breadcrumbs>
  );

  const filterBar = (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, pt: 2 }}>
      <FormControl
        size="small"
        sx={{ minWidth: 220 }}
        disabled={projectsLoading || projects.length === 0}
      >
        <InputLabel id="dashboard-project-label">Filter by project</InputLabel>
        <Select
          labelId="dashboard-project-label"
          label="Filter by project"
          value={effectiveSlug ?? ""}
          onChange={(e) => setSelectedSlug(e.target.value ? (e.target.value as string) : null)}
          displayEmpty
          renderValue={(v) =>
            projectsLoading ? "Loading…" : v ? projects.find((p) => p.slug === v)?.name ?? v : ""
          }
        >
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.slug}>
              {p.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {effectiveSlug && (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={showOnlySelectedProject}
              onChange={(_, checked) => setShowOnlySelectedProject(checked)}
            />
          }
          label="Show only selected project in activity"
        />
      )}
      {!projectsLoading && projects.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No projects yet.{" "}
          <MuiLink component={Link} to={projectsPath} underline="hover">
            Go to projects
          </MuiLink>
        </Typography>
      )}
    </Box>
  );

  return (
    <StandardPageLayout
      breadcrumbs={breadcrumbs}
      title="Dashboard"
      filterBar={filterBar}
    >
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Projects"
            value={stats?.projects ?? 0}
            isLoading={isLoading}
            to={projectsPath}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Artifacts"
            value={stats?.artifacts ?? 0}
            isLoading={isLoading}
            to={artifactsPath}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Tasks"
            value={stats?.tasks ?? 0}
            isLoading={isLoading}
            to={tasksPath}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Open Defects"
            value={stats?.openDefects ?? 0}
            isLoading={isLoading}
            to={openDefectsPath}
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography
            variant="overline"
            color="primary"
            fontWeight={600}
            sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
          >
            <History fontSize="small" />
            Recent activity
          </Typography>
          {activityLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={32} />
            </Box>
          ) : filteredActivity.length > 0 ? (
            <List dense disablePadding>
              {filteredActivity.map((item) => (
                <ListItem
                  key={item.artifact_id}
                  component={Link}
                  to={
                    orgSlug && item.project_slug
                      ? `/${orgSlug}/${item.project_slug}/artifacts`
                      : "#"
                  }
                  sx={{ textDecoration: "none", color: "inherit" }}
                >
                  <ListItemText
                    primary={item.title}
                    secondary={
                      <Box
                        component="span"
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          flexWrap: "wrap",
                          mt: 0.5,
                        }}
                      >
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
              {showOnlySelectedProject && effectiveSlug
                ? "No recent activity in the selected project."
                : "No recent artifact updates."}
            </Typography>
          )}
        </CardContent>
      </Card>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          Failed to load dashboard stats
        </Typography>
      )}
    </StandardPageLayout>
  );
}
