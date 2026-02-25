import { useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  Container,
  Typography,
  Button,
  InputAdornment,
  Card,
  CardContent,
  CardActionArea,
  Box,
  Tabs,
  Tab,
  Breadcrumbs,
  Link as MuiLink,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Add, FolderOff, Search } from "@mui/icons-material";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { hasPermission } from "../../../shared/utils/permissions";
import { useProjectStore } from "../../../shared/stores/projectStore";
import CreateProjectModal from "../components/CreateProjectModal";

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTenantName = useTenantStore((s) => s.currentTenant?.name ?? "Organization");
  const permissions = useAuthStore((s) => s.permissions);
  const canCreateProject = hasPermission(permissions, "project:create");

  const listTab = useProjectStore((s) => s.listState.listTab);
  const setListTab = useProjectStore((s) => s.setListTab);
  const createModalOpen = useProjectStore((s) => s.listState.createModalOpen);
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
        <Typography color="text.primary">Projects</Typography>
      </Breadcrumbs>
      <Typography component="h1" variant="h4" sx={{ mb: 3 }}>
        {currentTenantName}
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
        }}
      >
        <Tabs
          value={listTab}
          onChange={(_, v) => setListTab(v)}
          sx={{
            minHeight: 40,
            "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 600 },
          }}
        >
          <Tab label="Projects" />
          <Tab label="My work items" disabled />
          <Tab label="My pull requests" disabled />
        </Tabs>
        {canCreateProject && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateModalOpen(true)}
          >
            New project
          </Button>
        )}
      </Box>

      <FormProvider {...form}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 3 }}>
          <RhfTextField<ProjectsFilterValues>
            name="q"
            placeholder="Filter projects"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 280 }}
          />
          <Box sx={{ minWidth: 160 }}>
            <RhfSelect<ProjectsFilterValues>
              name="sort_value"
              control={control}
              label="Sort by"
              options={sortOptions}
              selectProps={{ size: "small" }}
            />
          </Box>
        </Box>
      </FormProvider>

      {isLoading ? (
        <LoadingState label="Loading projects…" />
      ) : filteredAndSortedProjects.length === 0 ? (
        <EmptyState
          icon={<FolderOff />}
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
        <Grid container spacing={2}>
          {filteredAndSortedProjects.map((project) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  transition: "box-shadow 0.2s",
                  "&:hover": { boxShadow: 2 },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(project.slug)}
                  sx={{ height: "100%", display: "block", textAlign: "left" }}
                >
                  <CardContent sx={{ p: 3, display: "flex", alignItems: "flex-start", gap: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 1,
                        bgcolor: "success.main",
                        color: "success.contrastText",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {(project.name ?? project.code).charAt(0).toUpperCase()}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
                        {project.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {project.description ?? project.code}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <CreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        orgSlug={orgSlug}
      />
    </Container>
  );
}
