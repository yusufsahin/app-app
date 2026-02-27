import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  History,
  ClipboardList,
  CheckCircle,
  Bug,
  FolderOpen,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  Separator,
} from "../../../shared/components/ui";
import { Label } from "../../../shared/components/ui";
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

const statCardBg: Record<string, string> = {
  primary: "bg-primary",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  error: "bg-red-500",
};

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
  color?: string;
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
      className="h-full"
    >
      <Card
        className={`h-full text-white transition shadow hover:shadow-lg ${statCardBg[color] ?? "bg-primary"} ${to ? "cursor-pointer hover:-translate-y-0.5" : ""}`}
      >
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm opacity-90">{label}</p>
                {isLoading ? (
                  <div className="mt-1 size-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <p className="text-3xl font-bold">{value}</p>
                )}
              </div>
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/20">
                {icon}
              </div>
            </div>
            {trend && (
              <div className="flex items-center gap-1">
                {trendUp ? (
                  <span className="size-4">↑</span>
                ) : (
                  <span className="size-4">↓</span>
                )}
                <span className="text-xs">{trend}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return to ? (
    <Link to={to} className="block h-full text-inherit no-underline">
      {content}
    </Link>
  ) : (
    content
  );
}

function getStateVariant(
  state: string,
): "default" | "secondary" | "destructive" | "outline" {
  const s = state.toLowerCase();
  if (s.includes("done") || s.includes("closed") || s.includes("completed")) return "default";
  if (s.includes("blocked") || s.includes("error")) return "destructive";
  return "outline";
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

  const statsChartData = stats
    ? [
        { name: "Projects", value: stats.projects, fill: COLORS[0] },
        { name: "Artifacts", value: stats.artifacts, fill: COLORS[1] },
        { name: "Tasks", value: stats.tasks, fill: COLORS[2] },
        { name: "Open Defects", value: stats.openDefects, fill: COLORS[3] },
      ]
    : [];

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={orgSlug ? `/${orgSlug}` : "#"}>{orgSlug ?? "Org"}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Dashboard</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  const filterBar = (
    <div className="flex flex-wrap items-center gap-4 pt-4">
      <div className="min-w-[220px]">
        <Label className="sr-only">Filter by project</Label>
        <Select
          value={effectiveSlug ?? "__all__"}
          onValueChange={(v) => setSelectedSlug(v === "__all__" ? null : v)}
          disabled={projectsLoading || projects.length === 0}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder={projectsLoading ? "Loading…" : "All projects"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.slug}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {effectiveSlug && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showOnlySelectedProject}
            onChange={(e) => setShowOnlySelectedProject(e.target.checked)}
            className="size-4 rounded border-input"
          />
          <span>Show only selected project in activity</span>
        </label>
      )}
      {!projectsLoading && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No projects yet.{" "}
          <Link to={projectsPath} className="text-primary underline hover:no-underline">
            Go to projects
          </Link>
        </p>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <StandardPageLayout
        breadcrumbs={breadcrumbs}
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:border-l">
              {(["week", "month", "year"] as const).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                  className="rounded-none first:rounded-l-md last:rounded-r-md"
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh Data</TooltipContent>
            </Tooltip>
          </div>
        }
        filterBar={filterBar}
      >
        {/* Stat Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Projects"
            value={stats?.projects ?? 0}
            isLoading={isLoading}
            to={projectsPath}
            color="primary"
            icon={<FolderOpen className="size-8" />}
            trend="+5% from last month"
            trendUp
            delay={0}
          />
          <StatCard
            label="Artifacts"
            value={stats?.artifacts ?? 0}
            isLoading={isLoading}
            to={artifactsPath}
            color="warning"
            icon={<ClipboardList className="size-8" />}
            trend="+12% from last month"
            trendUp
            delay={0.1}
          />
          <StatCard
            label="Tasks"
            value={stats?.tasks ?? 0}
            isLoading={isLoading}
            to={tasksPath}
            color="success"
            icon={<CheckCircle className="size-8" />}
            trend="+8% from last month"
            trendUp
            delay={0.2}
          />
          <StatCard
            label="Open Defects"
            value={stats?.openDefects ?? 0}
            isLoading={isLoading}
            to={openDefectsPath}
            color="error"
            icon={<Bug className="size-8" />}
            trend="-15% from last month"
            trendUp={false}
            delay={0.3}
          />
        </div>

        {/* Charts */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-lg border border-border bg-card p-4 lg:col-span-8">
            <h3 className="text-lg font-semibold">Team Velocity</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Completed vs Created artifacts over time
            </p>
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
          </div>

          <div className="rounded-lg border border-border bg-card p-4 lg:col-span-4">
            <h3 className="text-lg font-semibold">Work Distribution</h3>
            <p className="mb-4 text-xs text-muted-foreground">Overview of all work items</p>
            {isLoading ? (
              <div className="flex h-60 items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
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
                    label={({ name, value }) => (value > 0 ? `${name}: ${value}` : "")}
                  >
                    {statsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-lg font-semibold">Work Items Overview</h3>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
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
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 text-lg font-semibold">Quick Stats</h3>
            {!isLoading && stats && (
              <div className="space-y-2">
                {[
                  { label: "Projects", value: stats.projects, icon: <FolderOpen className="size-4 text-primary" /> },
                  { label: "Total Artifacts", value: stats.artifacts, icon: <ClipboardList className="size-4 text-amber-500" /> },
                  { label: "Tasks", value: stats.tasks, icon: <CheckCircle className="size-4 text-emerald-500" /> },
                  { label: "Open Defects", value: stats.openDefects, icon: <Bug className="size-4 text-red-500" /> },
                  { label: "Active Projects", value: projects.length, icon: <TrendingUp className="size-4 text-primary" /> },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {row.icon}
                        <span className="text-sm">{row.label}</span>
                      </div>
                      <span className="font-semibold">{row.value}</span>
                    </div>
                    <Separator className="mt-2" />
                  </div>
                ))}
              </div>
            )}
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Projects and Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {projects.length > 0 && (
            <div className="lg:col-span-8">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Active Projects</h3>
                  <Link to={projectsPath} className="text-sm text-primary underline hover:no-underline">
                    View all
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {projects.slice(0, 6).map((project) => (
                    <Link
                      key={project.id}
                      to={`/${orgSlug}/${project.slug}`}
                      className="block rounded-lg border border-border bg-card p-4 transition shadow hover:shadow-md no-underline text-foreground"
                    >
                      <div className="mb-2 flex gap-2">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{project.name}</p>
                          <Badge variant="secondary" className="mt-1">
                            {project.code}
                          </Badge>
                        </div>
                      </div>
                      {project.description && (
                        <p className="line-clamp-2 mb-2 text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Activity</span>
                        <span className="font-semibold text-emerald-600">Active</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full w-3/4 rounded-full bg-emerald-500" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className={projects.length > 0 ? "lg:col-span-4" : "lg:col-span-12"}>
            <Card className="h-full border border-border">
              <CardContent>
                <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <History className="size-4" />
                  Recent activity
                </p>
                {activityLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : filteredActivity.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {filteredActivity.map((item) => (
                      <li key={item.artifact_id}>
                        <Link
                          to={
                            orgSlug && item.project_slug
                              ? `/${orgSlug}/${item.project_slug}/artifacts`
                              : "#"
                          }
                          className="block rounded-md py-2 no-underline text-foreground transition-colors hover:bg-muted/50"
                        >
                          <span className="font-medium">{item.title}</span>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant={getStateVariant(item.state)} className="text-xs">
                              {item.state}
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-xs">
                                  {item.artifact_type}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Artifact type</TooltipContent>
                            </Tooltip>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(item.updated_at)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="py-8 text-center">
                    <History className="mx-auto mb-2 size-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      {showOnlySelectedProject && effectiveSlug
                        ? "No recent activity in the selected project."
                        : "No recent artifact updates."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-destructive">Failed to load dashboard stats</p>
        )}
      </StandardPageLayout>
    </TooltipProvider>
  );
}
