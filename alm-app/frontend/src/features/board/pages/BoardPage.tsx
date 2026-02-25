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
} from "@mui/material";
import { ViewColumn } from "@mui/icons-material";
import { useMemo, useCallback } from "react";
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
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <ProjectBreadcrumbs currentPageLabel="Board" projectName={project?.name} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <ViewColumn fontSize="small" />
        <Typography variant="h6">Kanban Board</Typography>
        <Button
          component={Link}
          to={artifactsPath(orgSlug, projectSlug, {
            type: typeFilter || undefined,
            cycleNodeFilter: cycleFilter || undefined,
            areaNodeFilter: areaFilter || undefined,
          })}
          size="small"
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
      </Box>

      {manifestLoading || artifactsLoading ? (
        <Skeleton variant="rectangular" height={400} />
      ) : states.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">
            No workflow states in manifest. Define workflows with states in Process manifest to use the board.
          </Typography>
          <Button component={Link} to={`/${orgSlug}/${projectSlug}/manifest`} sx={{ mt: 2 }}>
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
            minHeight: 360,
          }}
        >
          {states.map((state) => (
            <Paper
              key={state}
              variant="outlined"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, state)}
              sx={{
                minWidth: 280,
                maxWidth: 280,
                flexShrink: 0,
                p: 1.5,
                bgcolor: "action.hover",
                "&:hover": { bgcolor: "action.selected" },
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, px: 0.5 }}>
                {state}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {(byState.get(state) ?? []).map((a) => (
                  <Card
                    key={a.id}
                    variant="outlined"
                    draggable
                    onDragStart={(e) => handleDragStart(e, a.id, a.state)}
                    sx={{
                      cursor: "grab",
                      "&:active": { cursor: "grabbing" },
                      textAlign: "left",
                    }}
                  >
                    <CardContent sx={{ py: 1, px: 1.5, "&:last-child": { pb: 1 } }}>
                      <MuiLink
                        component={Link}
                        to={artifactDetailPath(orgSlug, projectSlug, a.id)}
                        underline="hover"
                        color="inherit"
                        fontWeight={600}
                        sx={{ fontSize: "0.875rem" }}
                      >
                        {a.artifact_key ?? a.id.slice(0, 8)}
                      </MuiLink>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                        {a.title || "—"}
                      </Typography>
                      {a.artifact_type && (
                        <Chip label={a.artifact_type} size="small" sx={{ mt: 0.5 }} />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Container>
  );
}
