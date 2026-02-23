import { useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Add, Search } from "@mui/icons-material";
import { useTenantStore } from "../../../shared/stores/tenantStore";
import { useAuthStore } from "../../../shared/stores/authStore";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { hasPermission } from "../../../shared/utils/permissions";
import CreateProjectModal from "../components/CreateProjectModal";

export default function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const currentTenantName = useTenantStore((s) => s.currentTenant?.name ?? "Organization");
  const permissions = useAuthStore((s) => s.permissions);
  const canCreateProject = hasPermission(permissions, "project:create");

  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("q") ?? "";
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tab, setTab] = useState(0);

  const { data: projects = [], isLoading } = useOrgProjects(orgSlug);

  const filteredProjects = useMemo(() => {
    if (!filter.trim()) return projects;
    const q = filter.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    );
  }, [projects, filter]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
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
          value={tab}
          onChange={(_, v) => setTab(v)}
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
        sx={{ mb: 3, maxWidth: 280 }}
      />

      {isLoading ? (
        <Typography color="text.secondary">Loading projects...</Typography>
      ) : filteredProjects.length === 0 ? (
        <Typography color="text.secondary">
          {filter ? "No projects match your filter." : "No projects yet. Create one to get started."}
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {filteredProjects.map((project) => (
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
