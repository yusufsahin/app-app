import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { Settings, History, ClipboardList, CheckCircle, Bug } from "lucide-react";
import { Loader2 } from "lucide-react";
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
} from "../../../shared/components/ui";
import { ProjectNotFoundView, StandardPageLayout } from "../../../shared/components/Layout";
import { RhfDescriptionField, RhfTextField } from "../../../shared/components/forms";
import {
  useOrgProjects,
  useUpdateOrgProject,
  useOrgDashboardStats,
  useOrgDashboardActivity,
  type DashboardActivityItem,
} from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { motion } from "motion/react";

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

const statCardColors = {
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  error: "bg-red-500",
} as const;

export default function ProjectDetailPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const { data: stats, isLoading: statsLoading } = useOrgDashboardStats(orgSlug);
  const { data: activity, isLoading: activityLoading } = useOrgDashboardActivity(orgSlug, 8);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const clearCurrentProject = useProjectStore((s) => s.clearCurrentProject);

  const project =
    projects?.find((p) => p.slug === projectSlug) ??
    (currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined);
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

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }
  if (projectSlug && orgSlug && projectsLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">Loading project…</div>
    );
  }

  const activityList: DashboardActivityItem[] = (activity as DashboardActivityItem[] | undefined) ?? [];
  const projectActivity = activityList.filter((item) => item.project_slug === projectSlug);

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
          <BreadcrumbPage>{project?.name ?? projectSlug ?? "Project"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <StandardPageLayout
      breadcrumbs={breadcrumbs}
      title={
        project ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{project.code}</p>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
          </div>
        ) : undefined
      }
      description={project?.description ?? undefined}
    >
      {project ? (
        <div>
          {/* Stats row */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                label: "Total Artifacts",
                value: stats?.artifacts ?? 0,
                color: "warning" as const,
                icon: <ClipboardList className="size-7" />,
                delay: 0,
              },
              {
                label: "Open Tasks",
                value: stats?.tasks ?? 0,
                color: "success" as const,
                icon: <CheckCircle className="size-7" />,
                delay: 0.1,
              },
              {
                label: "Open Defects",
                value: stats?.openDefects ?? 0,
                color: "error" as const,
                icon: <Bug className="size-7" />,
                delay: 0.2,
              },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: item.delay }}
              >
                <Card className={`${statCardColors[item.color]} text-white`}>
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="mb-1 text-sm opacity-90">{item.label}</p>
                        {statsLoading ? (
                          <Loader2 className="size-7 animate-spin text-white" />
                        ) : (
                          <p className="text-3xl font-bold">{item.value}</p>
                        )}
                      </div>
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                        {item.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Activity + Settings */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-7">
            <div className="md:col-span-4">
              <Card className="h-full border border-border">
                <CardContent>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    <History className="size-4" />
                    Recent activity
                  </p>
                  {activityLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    </div>
                  ) : projectActivity.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {projectActivity.map((item) => (
                        <li key={item.artifact_id}>
                          <Link
                            to={
                              orgSlug && item.project_slug
                                ? `/${orgSlug}/${item.project_slug}/artifacts`
                                : "#"
                            }
                            className="block px-0 py-3 no-underline text-foreground hover:opacity-80"
                          >
                            <span className="font-medium">{item.title}</span>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {item.state}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{item.artifact_type}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(item.updated_at)}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity in this project.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-3">
              <Card className="border border-border">
                <CardContent>
                  <p className="mb-4 flex items-center gap-2 font-semibold">
                    <Settings className="size-4" />
                    Settings
                  </p>
                  <FormProvider {...form}>
                    <form onSubmit={handleSubmit(onSaveSettings)} noValidate className="space-y-4">
                      <RhfTextField<SettingsFormValues>
                        name="name"
                        label="Name"
                        fullWidth
                        size="small"
                        sx={{ mb: 2 }}
                      />
                      <div>
                        <RhfDescriptionField<SettingsFormValues>
                          name="description"
                          control={control}
                          mode="text"
                          label="Description"
                          allowModeSwitch
                          rows={4}
                        />
                      </div>
                      <RhfTextField<SettingsFormValues>
                        name="status"
                        label="Status"
                        fullWidth
                        size="small"
                        placeholder="e.g. active, on-hold"
                        sx={{ mb: 2 }}
                      />
                      <Button type="submit" disabled={updateProject.isPending}>
                        Save
                      </Button>
                    </form>
                  </FormProvider>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No project selected.</p>
      )}
    </StandardPageLayout>
  );
}
