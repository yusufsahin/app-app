import { useParams, Link } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Skeleton,
  Link as MuiLink,
  Card,
  CardContent,
  Chip,
  Stack,
  Avatar,
  Tooltip,
} from "@mui/material";
import { ViewColumn } from "@mui/icons-material";
import { useMemo, useCallback } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useForm, FormProvider } from "react-hook-form";
import { RhfSelect } from "../../../shared/components/forms";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import { useCycleNodes, useAreaNodes, cycleNodeDisplayLabel, areaNodeDisplayLabel } from "../../../shared/api/planningApi";
import { useArtifacts, useTransitionArtifactById } from "../../../shared/api/artifactApi";
import type { Artifact } from "../../../shared/stores/artifactStore";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { artifactDetailPath, artifactsPath } from "../../../shared/utils/appPaths";
import { getWorkflowStatesForType, type ManifestBundleShape } from "../../../shared/lib/workflowManifest";

type WorkflowState = string;

const COLUMN_COLORS = [
  "#f59e0b",
  "#8b5cf6",
  "#2563eb",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#84cc16",
];

const TYPE_COLORS: Record<string, "default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"> = {
  epic: "secondary",
  requirement: "primary",
  defect: "error",
  task: "default",
  story: "info",
  bug: "error",
};

function getTypeColor(type: string): "default" | "primary" | "secondary" | "success" | "error" | "warning" | "info" {
  return TYPE_COLORS[type.toLowerCase()] ?? "default";
}

export default function BoardPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);
  const { data: manifest, isLoading: manifestLoading } = useProjectManifest(orgSlug, project?.id);
  const { data: cycleNodesFlat = [] } = useCycleNodes(orgSlug, project?.id, true);
  const { data: areaNodesFlat = [] } = useAreaNodes(orgSlug, project?.id, true);

  type BoardFilterValues = { typeFilter: string; cycleFilter: string; areaFilter: string };
  const filterForm = useForm<BoardFilterValues>({
    defaultValues: { typeFilter: "", cycleFilter: "", areaFilter: "" },
  });
  const { watch, control } = filterForm;
  const typeFilter = watch("typeFilter");
  const cycleFilter = watch("cycleFilter");
  const areaFilter = watch("areaFilter");

  const { data: artifactsData, isLoading: artifactsLoading } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "updated_at",
    "asc",
    undefined,
    200,
    0,
    false,
    cycleFilter || undefined,
    areaFilter || undefined,
  );
  const transitionMutation = useTransitionArtifactById(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const bundle = manifest?.manifest_bundle as ManifestBundleShape | undefined;
  const artifactTypes = useMemo(() => bundle?.artifact_types ?? [], [bundle]);
  const states = useMemo(
    () => getWorkflowStatesForType(bundle ?? null, typeFilter || null),
    [bundle, typeFilter],
  );
  const allArtifacts = useMemo(() => artifactsData?.items ?? [], [artifactsData?.items]);
  const artifacts = useMemo(() => {
    if (!typeFilter) return allArtifacts;
    return allArtifacts.filter((a) => a.artifact_type === typeFilter);
  }, [allArtifacts, typeFilter]);
  const byState = useMemo(() => {
    const map = new Map<WorkflowState, Artifact[]>();
    for (const s of states) map.set(s, []);
    for (const a of artifacts) {
      const list = map.get(a.state);
      if (list) list.push(a);
      else map.set(a.state, [a]);
    }
    return map;
  }, [states, artifacts]);

  const handleDragStart = useCallback((e: React.DragEvent, artifactId: string, currentState: string) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ artifactId, currentState }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetState: WorkflowState) => {
      e.preventDefault();
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (!raw) return;
        const { artifactId, currentState } = JSON.parse(raw) as { artifactId: string; currentState: string };
        if (targetState === currentState) return;
        transitionMutation.mutate(
          { artifactId, new_state: targetState },
          {
            onSuccess: () => showNotification("State updated", "success"),
            onError: (err: Error) =>
              showNotification((err as { detail?: string })?.detail ?? err.message ?? "Transition failed", "error"),
          },
        );
      } catch {
        /* ignore */
      }
    },
    [transitionMutation, showNotification],
  );

  if (!orgSlug || !projectSlug) {
    return (
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <Typography color="text.secondary">Missing org or project.</Typography>
      </Container>
    );
  }

  if (projects !== undefined && !project) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        <ProjectBreadcrumbs currentPageLabel="Board" projectName={project?.name} />

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        <ViewColumn fontSize="small" color="primary" aria-hidden />
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
          Board
        </Typography>
        <Button
          component={Link}
          to={artifactsPath(orgSlug, projectSlug, {
            type: typeFilter || undefined,
            cycleNodeFilter: cycleFilter || undefined,
            areaNodeFilter: areaFilter || undefined,
          })}
          size="small"
          variant="outlined"
          sx={{ ml: 1 }}
        >
          View in Artifacts
        </Button>
        <FormProvider {...filterForm}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            {artifactTypes.length > 0 && (
              <Box sx={{ minWidth: 180 }}>
                <RhfSelect<BoardFilterValues>
                  name="typeFilter"
                  control={control}
                  label="Artifact type"
                  placeholder="All"
                  options={[{ value: "", label: "All" }, ...artifactTypes.map((at) => ({ value: at.id, label: at.name ?? at.id }))]}
                  selectProps={{ size: "small" }}
                />
              </Box>
            )}
            {cycleNodesFlat.length > 0 && (
              <Box sx={{ minWidth: 180 }}>
                <RhfSelect<BoardFilterValues>
                  name="cycleFilter"
                  control={control}
                  label="Cycle"
                  placeholder="All"
                  options={[{ value: "", label: "All" }, ...cycleNodesFlat.map((c) => ({ value: c.id, label: cycleNodeDisplayLabel(c) }))]}
                  selectProps={{ size: "small" }}
                />
              </Box>
            )}
            {areaNodesFlat.length > 0 && (
              <Box sx={{ minWidth: 180 }}>
                <RhfSelect<BoardFilterValues>
                  name="areaFilter"
                  control={control}
                  label="Area"
                  placeholder="All"
                  options={[{ value: "", label: "All" }, ...areaNodesFlat.map((a) => ({ value: a.id, label: areaNodeDisplayLabel(a) }))]}
                  selectProps={{ size: "small" }}
                />
              </Box>
            )}
          </Box>
        </FormProvider>
      </Stack>

      {manifestLoading || artifactsLoading ? (
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      ) : states.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">
            No workflow states in manifest. Define workflows with states in Process manifest to use the board.
          </Typography>
          <Button component={Link} to={`/${orgSlug}/${projectSlug}/manifest`} sx={{ mt: 2 }} variant="contained">
            Open Manifest
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            pb: 2,
            minHeight: 400,
          }}
        >
          {states.map((state, colIndex) => {
            const colColor = COLUMN_COLORS[colIndex % COLUMN_COLORS.length];
            const colArtifacts = byState.get(state) ?? [];
            return (
              <Paper
                key={state}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, state)}
                sx={{
                  minWidth: 300,
                  maxWidth: 300,
                  flexShrink: 0,
                  p: 2,
                  bgcolor: "grey.50",
                  borderRadius: 2,
                  minHeight: 500,
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "background-color 0.2s",
                  "&:hover": { bgcolor: "grey.100" },
                }}
              >
                {/* Column Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        bgcolor: colColor,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: "text.primary" }}>
                      {state}
                    </Typography>
                  </Stack>
                  <Chip
                    label={colArtifacts.length}
                    size="small"
                    sx={{
                      bgcolor: colColor,
                      color: "white",
                      fontWeight: 700,
                      height: 22,
                      fontSize: "0.75rem",
                    }}
                  />
                </Stack>

                {/* Cards */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {colArtifacts.map((a) => (
                    <Card
                      key={a.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, a.id, a.state)}
                      sx={{
                        cursor: "grab",
                        "&:active": { cursor: "grabbing" },
                        boxShadow: 1,
                        transition: "box-shadow 0.2s, transform 0.15s",
                        "&:hover": {
                          boxShadow: 4,
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                        {/* Key + Type Row */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography variant="caption" color="primary.main" fontWeight={700}>
                              {a.artifact_key ?? a.id.slice(0, 8)}
                            </Typography>
                            {a.artifact_type && (
                              <Chip
                                label={a.artifact_type}
                                size="small"
                                color={getTypeColor(a.artifact_type)}
                                sx={{ height: 18, fontSize: "0.65rem" }}
                              />
                            )}
                          </Stack>
                        </Stack>

                        {/* Title */}
                        <MuiLink
                          component={Link}
                          to={artifactDetailPath(orgSlug, projectSlug, a.id)}
                          underline="hover"
                          color="text.primary"
                          sx={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            mb: 1,
                          }}
                        >
                          {a.title || "—"}
                        </MuiLink>

                        {/* Footer */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                          {a.assignee_id ? (
                            <Tooltip title="Assignee">
                              <Avatar
                                sx={{
                                  width: 24,
                                  height: 24,
                                  fontSize: "0.7rem",
                                  bgcolor: "primary.main",
                                }}
                              >
                                {a.assignee_id.charAt(0).toUpperCase()}
                              </Avatar>
                            </Tooltip>
                          ) : (
                            <Box />
                          )}
                          {a.updated_at && (
                            <Typography variant="caption" color="text.disabled" fontSize="0.65rem">
                              {new Date(a.updated_at).toLocaleDateString()}
                            </Typography>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}

                  {colArtifacts.length === 0 && (
                    <Box
                      sx={{
                        py: 4,
                        textAlign: "center",
                        border: "2px dashed",
                        borderColor: "divider",
                        borderRadius: 2,
                        color: "text.disabled",
                      }}
                    >
                      <Typography variant="caption">Drop here</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
      </Container>
    </DndProvider>
  );
}
