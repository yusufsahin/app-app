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
  Stack,
  Divider,
  Tooltip,
  Button,
  ButtonGroup,
  IconButton,
  Paper,
  LinearProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  History,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  BugReport as BugReportIcon,
  Folder as FolderIcon,
  TrendingUp as TrendingUpIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import {
  useOrgDashboardStats,
  useOrgProjects,
  useOrgDashboardActivity,
  type DashboardActivityItem,
} from "../../../shared/api/orgApi";
import { StandardPageLayout } from "../../../shared/components/Layout";
import { useProjectStore } from "../../../shared/stores/projectStore";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { motion } from "motion/react";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const velocityData = [
  { period: "Week 1", completed: 12, created: 15 },
  { period: "Week 2", completed: 18, created: 14 },
  { period: "Week 3", completed: 15, created: 20 },
  { period: "Week 4", completed: 22, created: 18 },
  { period: "Week 5", completed: 19, created: 16 },
  { period: "Week 6", completed: 24, created: 22 },
];

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

type StatCardColor = "primary" | "warning" | "success" | "error";

function StatCard({
  label,
  value,
  isLoading,
  to,
  color = "primary",
  icon,
  trend,
  trendUp,
  delay = 0,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  to?: string;
  color?: StatCardColor;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  delay?: number;
}) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      style={{ height: "100%" }}
    >
      <Card
        sx={{
          height: "100%",
          bgcolor: `${color}.main`,
          color: "white",
          transition: "box-shadow 0.2s, transform 0.2s",
          ...(to
            ? {
              "&:hover": {
                boxShadow: 6,
                transform: "translateY(-2px)",
              },
              cursor: "pointer",
            }
            : {}),
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="body2" sx={{ opacity: 0.9 }} gutterBottom>
                  {label}
                </Typography>
                {isLoading ? (
                  <CircularProgress size={32} sx={{ color: "white" }} />
                ) : (
                  <Typography variant="h3" fontWeight="bold">
                    {value}
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 2,
                  bgcolor: "rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
            </Stack>
            {trend && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {trendUp ? (
                  <ArrowUpIcon fontSize="small" />
                ) : (
                  <ArrowDownIcon fontSize="small" />
                )}
                <Typography variant="caption">{trend}</Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </motion.div>
  );

  return to ? (
    <MuiLink component={Link} to={to} underline="none" color="inherit" sx={{ display: "block", height: "100%" }}>
      {content}
    </MuiLink>
  ) : (
    content
  );
}

function getStateColor(state: string): "default" | "primary" | "secondary" | "success" | "error" | "warning" | "info" {
  const s = state.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("completed")) return "success";
  if (s.includes("progress") || s.includes("active")) return "info";
  if (s.includes("open") || s.includes("new")) return "primary";
  if (s.includes("blocked") || s.includes("error")) return "error";
  return "default";
}

export default function DashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const lastVisitedSlug = useProjectStore((s) => s.lastVisitedProjectSlug);
  const { data: stats, isLoading, error, refetch } = useOrgDashboardStats(orgSlug);
  const { data: projects = [], isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const { data: activity, isLoading: activityLoading } = useOrgDashboardActivity(orgSlug, 10);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");

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

  // Stats chart data derived from known values
  const statsChartData = stats
    ? [
        { name: "Projects", value: stats.projects, fill: COLORS[0] },
        { name: "Artifacts", value: stats.artifacts, fill: COLORS[1] },
        { name: "Tasks", value: stats.tasks, fill: COLORS[2] },
        { name: "Open Defects", value: stats.openDefects, fill: COLORS[3] },
      ]
    : [];

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
      actions={
        <Stack direction="row" spacing={2} alignItems="center">
          <ButtonGroup variant="outlined" size="small">
            <Button
              variant={timeRange === "week" ? "contained" : "outlined"}
              onClick={() => setTimeRange("week")}
            >
              Week
            </Button>
            <Button
              variant={timeRange === "month" ? "contained" : "outlined"}
              onClick={() => setTimeRange("month")}
            >
              Month
            </Button>
            <Button
              variant={timeRange === "year" ? "contained" : "outlined"}
              onClick={() => setTimeRange("year")}
            >
              Year
            </Button>
          </ButtonGroup>
          <Tooltip title="Refresh Data">
            <IconButton size="small" onClick={() => refetch()}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      }
      filterBar={filterBar}
    >
      {/* Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Projects"
            value={stats?.projects ?? 0}
            isLoading={isLoading}
            to={projectsPath}
            color="primary"
            icon={<FolderIcon sx={{ fontSize: 32 }} />}
            trend="+5% from last month"
            trendUp
            delay={0}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Artifacts"
            value={stats?.artifacts ?? 0}
            isLoading={isLoading}
            to={artifactsPath}
            color="warning"
            icon={<AssignmentIcon sx={{ fontSize: 32 }} />}
            trend="+12% from last month"
            trendUp
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Tasks"
            value={stats?.tasks ?? 0}
            isLoading={isLoading}
            to={tasksPath}
            color="success"
            icon={<CheckCircleIcon sx={{ fontSize: 32 }} />}
            trend="+8% from last month"
            trendUp
            delay={0.2}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Open Defects"
            value={stats?.openDefects ?? 0}
            isLoading={isLoading}
            to={openDefectsPath}
            color="error"
            icon={<BugReportIcon sx={{ fontSize: 32 }} />}
            trend="-15% from last month"
            trendUp={false}
            delay={0.3}
          />
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Velocity Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Team Velocity
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block" mb={2}>
              Completed vs Created artifacts over time
            </Typography>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={velocityData}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <RechartsTooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                  strokeWidth={2}
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="#2563eb"
                  fillOpacity={1}
                  fill="url(#colorCreated)"
                  strokeWidth={2}
                  name="Created"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Stats Distribution Pie */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 3, height: "100%" }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Work Distribution
            </Typography>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block" mb={2}>
              Overview of all work items
            </Typography>
            {isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 240 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                  >
                    {statsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Stats Bar Chart */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Work Items Overview
            </Typography>
            {isLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <RechartsTooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {statsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Quick Stats */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom mb={2}>
              Quick Stats
            </Typography>
            {!isLoading && stats && (
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <FolderIcon color="primary" />
                    <Typography variant="body2">Projects</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="bold">
                    {stats.projects}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AssignmentIcon color="warning" />
                    <Typography variant="body2">Total Artifacts</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="bold">
                    {stats.artifacts}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircleIcon color="success" />
                    <Typography variant="body2">Tasks</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="bold">
                    {stats.tasks}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BugReportIcon color="error" />
                    <Typography variant="body2">Open Defects</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="bold" color="error.main">
                    {stats.openDefects}
                  </Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TrendingUpIcon color="primary" />
                    <Typography variant="body2">Active Projects</Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight="bold">
                    {projects.length}
                  </Typography>
                </Stack>
              </Stack>
            )}
            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Projects and Activity */}
      <Grid container spacing={3}>
        {/* Active Projects */}
        {projects.length > 0 && (
          <Grid size={{ xs: 12, lg: 8 }}>
            <Paper sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight={600}>
                  Active Projects
                </Typography>
                <MuiLink
                  component={Link}
                  to={projectsPath}
                  underline="hover"
                  variant="body2"
                  color="primary"
                >
                  View all
                </MuiLink>
              </Stack>
              <Grid container spacing={2}>
                {projects.slice(0, 6).map((project) => (
                  <Grid size={{ xs: 12, md: 6 }} key={project.id}>
                    <Card
                      variant="outlined"
                      component={Link}
                      to={`/${orgSlug}/${project.slug}`}
                      sx={{
                        textDecoration: "none",
                        color: "inherit",
                        transition: "box-shadow 0.2s",
                        "&:hover": { boxShadow: 3 },
                        display: "block",
                      }}
                    >
                      <CardContent>
                        <Stack direction="row" spacing={2} mb={2}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1,
                              bgcolor: "primary.light",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "primary.main",
                              fontWeight: 700,
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            {project.name.charAt(0).toUpperCase()}
                          </Box>
                          <Box flex={1} minWidth={0}>
                            <Typography variant="subtitle2" fontWeight={600} noWrap>
                              {project.name}
                            </Typography>
                            <Chip label={project.code} size="small" sx={{ mt: 0.5 }} />
                          </Box>
                        </Stack>
                        {project.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              mb: 1.5,
                            }}
                          >
                            {project.description}
                          </Typography>
                        )}
                        <Box>
                          <Stack direction="row" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption" color="text.secondary">
                              Activity
                            </Typography>
                            <Typography variant="caption" fontWeight={600} color="success.main">
                              Active
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={75}
                            sx={{ height: 6, borderRadius: 1 }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Recent Activity */}
        <Grid size={{ xs: 12, lg: projects.length > 0 ? 4 : 12 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <History fontSize="small" color="primary" />
                <Typography
                  variant="overline"
                  color="primary"
                  fontWeight={600}
                >
                  Recent activity
                </Typography>
              </Stack>
              {activityLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : filteredActivity.length > 0 ? (
                <List dense disablePadding>
                  {filteredActivity.map((item, index) => (
                    <Box key={item.artifact_id}>
                      <ListItem
                        component={Link}
                        to={
                          orgSlug && item.project_slug
                            ? `/${orgSlug}/${item.project_slug}/artifacts`
                            : "#"
                        }
                        sx={{
                          textDecoration: "none",
                          color: "inherit",
                          borderRadius: 1,
                          "&:hover": {
                            bgcolor: "action.hover",
                          },
                          transition: "background-color 0.15s",
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={500}>
                              {item.title}
                            </Typography>
                          }
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
                              <Chip
                                size="small"
                                label={item.state}
                                color={getStateColor(item.state)}
                                variant="outlined"
                                sx={{ height: 20, fontSize: "0.7rem" }}
                              />
                              <Tooltip title="Artifact type">
                                <Chip
                                  size="small"
                                  label={item.artifact_type}
                                  variant="filled"
                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                />
                              </Tooltip>
                              <Typography component="span" variant="caption" color="text.secondary">
                                {formatRelativeTime(item.updated_at)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < filteredActivity.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              ) : (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <History sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {showOnlySelectedProject && effectiveSlug
                      ? "No recent activity in the selected project."
                      : "No recent artifact updates."}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          Failed to load dashboard stats
        </Typography>
      )}
    </StandardPageLayout>
  );
}
