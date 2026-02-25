import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  CardActionArea,
  Box,
  Tabs,
  Tab,
  Breadcrumbs,
  Link as MuiLink,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Add, Search } from "@mui/icons-material";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { hasPermission } from "../../../shared/utils/permissions";
import { useProjectStore } from "../../../shared/stores/projectStore";
import CreateProjectModal from "../components/CreateProjectModal";

export default function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const currentTenantName = useTenantStore((s) => s.currentTenant?.name ?? "Organization");
  const permissions = useAuthStore((s) => s.permissions);
  const canCreateProject = hasPermission(permissions, "project:create");

  const listTab = useProjectStore((s) => s.listState.listTab);
  const setListTab = useProjectStore((s) => s.setListTab);
  const createModalOpen = useProjectStore((s) => s.listState.createModalOpen);
  const setCreateModalOpen = useProjectStore((s) => s.setCreateModalOpen);

  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("q") ?? "";
  const sortBy = searchParams.get("sort_by") ?? "name";
  const sortOrder = searchParams.get("sort_order") ?? "asc";

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
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
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

      <TextField
        placeholder="Filter projects"
        size="small"
        value={filter}
        onChange={(e) => {
          const q = e.target.value;
          const next = new URLSearchParams(searchParams);
          if (q) next.set("q", q);
          else next.delete("q");
          setSearchParams(next, { replace: true });
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2, maxWidth: 280 }}
      />
      <FormControl size="small" sx={{ minWidth: 160, mb: 3, display: "block" }}>
        <InputLabel id="projects-sort-label">Sort by</InputLabel>
        <Select
          labelId="projects-sort-label"
          label="Sort by"
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [by, order] = (e.target.value as string).split("-") as [string, string];
            const next = new URLSearchParams(searchParams);
            next.set("sort_by", by);
            next.set("sort_order", order);
            setSearchParams(next, { replace: true });
          }}
        >
          <MenuItem value="name-asc">Name (A → Z)</MenuItem>
          <MenuItem value="name-desc">Name (Z → A)</MenuItem>
          <MenuItem value="slug-asc">Slug (A → Z)</MenuItem>
          <MenuItem value="slug-desc">Slug (Z → A)</MenuItem>
        </Select>
      </FormControl>

      {isLoading ? (
        <Typography color="text.secondary">Loading projects...</Typography>
      ) : filteredAndSortedProjects.length === 0 ? (
        <Typography color="text.secondary">
          {filter ? "No projects match your filter." : "No projects yet. Create one to get started."}
        </Typography>
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
