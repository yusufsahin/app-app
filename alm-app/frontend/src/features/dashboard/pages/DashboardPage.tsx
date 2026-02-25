import { useParams, Link } from "react-router-dom";
import {
  Box,
  Container,
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
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { History } from "@mui/icons-material";
import {
  useOrgDashboardStats,
  useOrgProjects,
  useOrgDashboardActivity,
  type DashboardActivityItem,
} from "../../../shared/api/orgApi";

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
  to,
  label,
  value,
  isLoading,
}: {
  to: string;
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <MuiLink component={Link} to={to} underline="none" color="inherit" sx={{ display: "block" }}>
      <Card sx={{ height: "100%", transition: "box-shadow 0.2s", "&:hover": { boxShadow: 2 } }}>
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
    </MuiLink>
  );
}

function StatCardPlain({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <Card>
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
}

export default function DashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: stats, isLoading, error } = useOrgDashboardStats(orgSlug);
  const { data: projects } = useOrgProjects(orgSlug);
  const { data: activity, isLoading: activityLoading } = useOrgDashboardActivity(orgSlug, 10);
  const firstProject = projects?.[0];
  const projectsPath = orgSlug ? `/${orgSlug}` : "#";
  const artifactsPath =
    orgSlug && firstProject ? `/${orgSlug}/${firstProject.slug}/artifacts` : projectsPath;
  const tasksPath =
    orgSlug && firstProject
      ? `/${orgSlug}/${firstProject.slug}/artifacts?type=task`
      : projectsPath;
  const openDefectsPath =
    orgSlug && firstProject
      ? `/${orgSlug}/${firstProject.slug}/artifacts?type=defect&state=Open`
      : projectsPath;

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
        <Typography color="text.primary">Dashboard</Typography>
      </Breadcrumbs>
      <Typography variant="h4" gutterBottom fontWeight={700}>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MuiLink component={Link} to={projectsPath} underline="none" color="inherit" sx={{ display: "block" }}>
            <Card sx={{ height: "100%", transition: "box-shadow 0.2s", "&:hover": { boxShadow: 2 } }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Projects
                </Typography>
                {isLoading ? (
                  <CircularProgress size={32} />
                ) : (
                  <Typography variant="h3">{stats?.projects ?? 0}</Typography>
                )}
              </CardContent>
            </Card>
          </MuiLink>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          {firstProject ? (
            <StatCard
              to={artifactsPath}
              label="Artifacts"
              value={stats?.artifacts ?? 0}
              isLoading={isLoading}
            />
          ) : (
            <StatCardPlain label="Artifacts" value={stats?.artifacts ?? 0} isLoading={isLoading} />
          )}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          {firstProject ? (
            <StatCard
              to={tasksPath}
              label="Tasks"
              value={stats?.tasks ?? 0}
              isLoading={isLoading}
            />
          ) : (
            <StatCardPlain label="Tasks" value={stats?.tasks ?? 0} isLoading={isLoading} />
          )}
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          {firstProject ? (
            <StatCard
              to={openDefectsPath}
              label="Open Defects"
              value={stats?.openDefects ?? 0}
              isLoading={isLoading}
            />
          ) : (
            <StatCardPlain
              label="Open Defects"
              value={stats?.openDefects ?? 0}
              isLoading={isLoading}
            />
          )}
        </Grid>
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="overline" color="primary" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <History fontSize="small" />
            Recent activity
          </Typography>
          {activityLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={32} />
            </Box>
          ) : activity && activity.length > 0 ? (
            <List dense disablePadding>
              {(activity as DashboardActivityItem[]).map((item) => (
                <ListItem
                  key={item.artifact_id}
                  component={Link}
                  to={orgSlug && item.project_slug ? `/${orgSlug}/${item.project_slug}/artifacts` : "#"}
                  sx={{ textDecoration: "none", color: "inherit" }}
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
              No recent artifact updates.
            </Typography>
          )}
        </CardContent>
      </Card>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          Failed to load dashboard stats
        </Typography>
      )}
    </Container>
  );
}
