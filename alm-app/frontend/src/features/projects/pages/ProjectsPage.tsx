import { useMemo, useEffect, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { Plus, FolderX, Search } from "lucide-react";
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
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { StandardPageLayout } from "../../../shared/components/Layout";
import { RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { hasPermission } from "../../../shared/utils/permissions";
import { useProjectStore } from "../../../shared/stores/projectStore";

type ProjectsFilterValues = {
  q: string;
  sort_value: string;
};

const sortOptions = [
  { value: "name-asc", label: "Name (A → Z)" },
  { value: "name-desc", label: "Name (Z → A)" },
  { value: "slug-asc", label: "Slug (A → Z)" },
  { value: "slug-desc", label: "Slug (Z → A)" },
];

export default function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTenantName = useTenantStore((s) => s.currentTenant?.name ?? "Organization");
  const permissions = useAuthStore((s) => s.permissions);
  const canCreateProject = hasPermission(permissions, "project:create");
  const setCreateModalOpen = useProjectStore((s) => s.setCreateModalOpen);

  const filter = searchParams.get("q") ?? "";
  const sortBy = searchParams.get("sort_by") ?? "name";
  const sortOrder = searchParams.get("sort_order") ?? "asc";
  const sortValue = `${sortBy}-${sortOrder}`;

  const form = useForm<ProjectsFilterValues>({
    defaultValues: { q: filter, sort_value: sortValue },
  });
  const { watch, reset, control } = form;
  const values = watch();
  const skipSyncRef = useRef(true);

  useEffect(() => {
    reset({ q: filter, sort_value: sortValue });
  }, [filter, sortValue, reset]);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    const [by, order] = (values.sort_value || "name-asc").split("-");
    const next = new URLSearchParams(searchParams);
    if (values.q) next.set("q", values.q);
    else next.delete("q");
    next.set("sort_by", by ?? "name");
    next.set("sort_order", order ?? "asc");
    setSearchParams(next, { replace: true });
  }, [values.q, values.sort_value]);

  const { data: projects = [], isLoading } = useOrgProjects(orgSlug);

  const filteredAndSortedProjects = useMemo(() => {
    let list = projects;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false),
      );
    }
    const key = sortBy === "slug" ? "slug" : "name";
    const asc = sortOrder === "asc";
    return [...list].sort((a, b) => {
      const va = (a[key] ?? "").toLowerCase();
      const vb = (b[key] ?? "").toLowerCase();
      const cmp = va.localeCompare(vb, undefined, { sensitivity: "base" });
      return asc ? cmp : -cmp;
    });
  }, [projects, filter, sortBy, sortOrder]);

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
          <BreadcrumbPage>Projects</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  const filterBar = (
    <FormProvider {...form}>
      <div className="flex flex-wrap items-center gap-4 pt-4">
        <RhfTextField<ProjectsFilterValues>
          name="q"
          placeholder="Filter projects"
          size="small"
          InputProps={{
            startAdornment: (
              <span className="pointer-events-none flex items-center pr-2 text-muted-foreground">
                <Search className="size-4" />
              </span>
            ),
          }}
          sx={{ maxWidth: 280 }}
        />
        <div className="min-w-[160px]">
          <RhfSelect<ProjectsFilterValues>
            name="sort_value"
            control={control}
            label="Sort by"
            options={sortOptions}
            selectProps={{ size: "sm" }}
          />
        </div>
      </div>
    </FormProvider>
  );

  return (
    <StandardPageLayout
      breadcrumbs={breadcrumbs}
      title="Projects"
      description={currentTenantName}
      actions={
        canCreateProject ? (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 size-4" />
            New project
          </Button>
        ) : undefined
      }
      filterBar={filterBar}
    >
      {isLoading ? (
        <LoadingState label="Loading projects…" />
      ) : filteredAndSortedProjects.length === 0 ? (
        <EmptyState
          icon={<FolderX className="size-12" />}
          title={filter ? "No matches" : "No projects yet"}
          description={
            filter
              ? "No projects match your filter. Try a different search."
              : "Create a project to get started."
          }
          actionLabel={!filter && canCreateProject ? "Create project" : undefined}
          onAction={!filter && canCreateProject ? () => setCreateModalOpen(true) : undefined}
          bordered
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {filteredAndSortedProjects.map((project) => (
            <Link
              key={project.id}
              to={`/${orgSlug}/${project.slug}`}
              className="block transition-shadow hover:shadow-md"
            >
              <Card
                data-testid="project-card"
                className="h-full overflow-hidden border border-border bg-card transition-colors hover:border-muted-foreground/30"
              >
                <CardContent className="p-4 text-left">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                      {(project.name ?? project.code).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{project.name}</h3>
                      <Badge variant="outline" className="mt-1">
                        {project.code}
                      </Badge>
                    </div>
                  </div>
                  {project.description && (
                    <p className="line-clamp-2 mb-3 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="default">Active</Badge>
                    <span className="text-xs text-muted-foreground">{project.slug}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </StandardPageLayout>
  );
}
