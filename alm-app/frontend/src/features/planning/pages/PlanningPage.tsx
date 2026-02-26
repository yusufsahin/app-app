import { useParams, Link } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Skeleton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Collapse,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link as MuiLink,
} from "@mui/material";
import {
  AccountTree,
  ExpandLess,
  ExpandMore,
  Add,
  Folder,
  Edit,
  Delete,
  ViewList,
} from "@mui/icons-material";
import { useState, useEffect, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { RhfSelect, RhfTextField } from "../../../shared/components/forms";
import { useOrgProjects } from "../../../shared/api/orgApi";
import {
  useCycleNodes,
  useAreaNodes,
  useCreateCycleNode,
  useCreateAreaNode,
  useUpdateCycleNode,
  useUpdateAreaNode,
  useDeleteCycleNode,
  useDeleteAreaNode,
  cycleNodeDisplayLabel,
  type CycleNode,
  type AreaNode,
} from "../../../shared/api/planningApi";
import { useArtifacts, useUpdateArtifact } from "../../../shared/api/artifactApi";
import { artifactDetailPath } from "../../../shared/utils/appPaths";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import { useArtifactStore } from "../../../shared/stores/artifactStore";

function CycleTreeItem({
  node,
  level,
  onRename,
  onDelete,
  onAddChild,
}: {
  node: CycleNode;
  level: number;
  onRename: (n: CycleNode) => void;
  onDelete: (n: CycleNode) => void;
  onAddChild: (n: CycleNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  return (
    <>
      <ListItem
        sx={{ pl: 2 + level * 2 }}
        secondaryAction={
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton size="small" aria-label="Add child" onClick={() => onAddChild(node)}>
              <Add fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Rename" onClick={() => onRename(node)}>
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Delete" onClick={() => onDelete(node)}>
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        }
      >
        <ListItemIcon sx={{ minWidth: 36 }} onClick={() => setOpen((o) => !o)}>
          {hasChildren ? (
            open ? (
              <ExpandLess fontSize="small" />
            ) : (
              <ExpandMore fontSize="small" />
            )
          ) : (
            <Box sx={{ width: 24 }} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={node.name}
          secondary={node.path ? `${node.path} · ${node.state}` : node.state}
        />
      </ListItem>
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children!.map((child) => (
              <CycleTreeItem
                key={child.id}
                node={child}
                level={level + 1}
                onRename={onRename}
                onDelete={onDelete}
                onAddChild={onAddChild}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

function AreaTreeItem({
  node,
  level,
  onRename,
  onDelete,
  onAddChild,
}: {
  node: AreaNode;
  level: number;
  onRename: (n: AreaNode) => void;
  onDelete: (n: AreaNode) => void;
  onAddChild: (n: AreaNode) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children?.length > 0;
  return (
    <>
      <ListItem
        sx={{ pl: 2 + level * 2 }}
        secondaryAction={
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton size="small" aria-label="Add child" onClick={() => onAddChild(node)}>
              <Add fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Rename" onClick={() => onRename(node)}>
              <Edit fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Delete" onClick={() => onDelete(node)}>
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        }
      >
        <ListItemIcon sx={{ minWidth: 36 }} onClick={() => setOpen((o) => !o)}>
          {hasChildren ? (
            open ? (
              <ExpandLess fontSize="small" />
            ) : (
              <ExpandMore fontSize="small" />
            )
          ) : (
            <Box sx={{ width: 24 }} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={node.name}
          secondary={node.path}
        />
        {!node.is_active && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            (inactive)
          </Typography>
        )}
      </ListItem>
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children!.map((child) => (
              <AreaTreeItem
                key={child.id}
                node={child}
                level={level + 1}
                onRename={onRename}
                onDelete={onDelete}
                onAddChild={onAddChild}
              />
            ))}
          </List>
        </Collapse>
      )}
    </>
  );
}

function BacklogArtifactRow({
  artifact,
  orgSlug,
  projectId,
  projectSlug,
  cycleNodesFlat,
  showNotification,
}: {
  artifact: { id: string; artifact_key?: string | null; title?: string; state?: string; cycle_node_id?: string | null };
  orgSlug: string | undefined;
  projectId: string | undefined;
  projectSlug: string | undefined;
  cycleNodesFlat: Array<{ id: string; name: string; path?: string }>;
  showNotification: (message: string, severity: "success" | "error" | "info") => void;
}) {
  const updateArtifact = useUpdateArtifact(orgSlug, projectId, artifact.id);
  const currentCycleId = artifact.cycle_node_id ?? "";

  type RowCycleValues = { cycleId: string };
  const rowForm = useForm<RowCycleValues>({ defaultValues: { cycleId: currentCycleId } });
  const justResetRef = useRef(false);
  useEffect(() => {
    rowForm.reset({ cycleId: currentCycleId });
    justResetRef.current = true;
  }, [currentCycleId]);

  const watchedCycleId = rowForm.watch("cycleId");
  useEffect(() => {
    if (justResetRef.current) {
      justResetRef.current = false;
      return;
    }
    if (watchedCycleId !== currentCycleId) {
      updateArtifact.mutate(
        { cycle_node_id: watchedCycleId || null },
        {
          onSuccess: () => showNotification("Artifact assigned to cycle", "success"),
          onError: (err: Error) =>
            showNotification((err as { detail?: string })?.detail ?? err.message ?? "Failed to update artifact", "error"),
        },
      );
    }
  }, [watchedCycleId]);

  return (
    <ListItem
      disablePadding
      sx={{ py: 0.5, display: "flex", alignItems: "center", gap: 1 }}
      secondaryAction={
        <Box onClick={(e) => e.stopPropagation()}>
          <FormProvider {...rowForm}>
            <RhfSelect<RowCycleValues>
              name="cycleId"
              control={rowForm.control}
              label=""
              options={[
                { value: "", label: "Unassigned" },
                ...cycleNodesFlat.map((c) => ({ value: c.id, label: c.name })),
              ]}
              selectProps={{
                size: "small",
                sx: { minWidth: 160, height: 32, fontSize: "0.875rem" },
                disabled: updateArtifact.isPending,
              }}
            />
          </FormProvider>
        </Box>
      }
    >
      <ListItemText
        primary={
          <MuiLink
            component={Link}
            to={orgSlug && projectSlug ? artifactDetailPath(orgSlug, projectSlug, artifact.id) : "#"}
            underline="hover"
            color="inherit"
          >
            {artifact.artifact_key ?? artifact.id} — {artifact.title || "(no title)"}
          </MuiLink>
        }
        secondary={artifact.state}
      />
    </ListItem>
  );
}

export default function PlanningPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);

  const [activeTab, setActiveTab] = useState<"cycles" | "areas" | "backlog">("cycles");
  const backlogForm = useForm<{ cycleId: string }>({ defaultValues: { cycleId: "" } });
  const selectedBacklogCycleId = backlogForm.watch("cycleId");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addMode, setAddMode] = useState<"cycles" | "areas">("cycles");
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameNode, setRenameNode] = useState<CycleNode | AreaNode | null>(null);

  const addForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const renameForm = useForm<{ name: string }>({ defaultValues: { name: "" } });
  const { reset: resetAddForm, handleSubmit: handleAddSubmit } = addForm;
  const { reset: resetRenameForm, handleSubmit: handleRenameSubmit } = renameForm;
  useEffect(() => {
    if (renameNode) resetRenameForm({ name: renameNode.name });
  }, [renameNode, resetRenameForm]);

  const { data: cycleNodes = [], isLoading: cyclesLoading } = useCycleNodes(
    orgSlug,
    project?.id,
    false,
  );
  const { data: cycleNodesFlat = [] } = useCycleNodes(orgSlug, project?.id, true);
  const { data: areaNodes = [], isLoading: areasLoading } = useAreaNodes(
    orgSlug,
    project?.id,
    false,
  );
  const createCycle = useCreateCycleNode(orgSlug, project?.id);
  const createArea = useCreateAreaNode(orgSlug, project?.id);
  const updateCycle = useUpdateCycleNode(orgSlug, project?.id);
  const updateArea = useUpdateAreaNode(orgSlug, project?.id);
  const deleteCycle = useDeleteCycleNode(orgSlug, project?.id);
  const deleteArea = useDeleteAreaNode(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);
  const setListState = useArtifactStore((s) => s.setListState);
  const { data: backlogData } = useArtifacts(
    orgSlug,
    project?.id,
    undefined,
    undefined,
    "updated_at",
    "desc",
    undefined,
    25,
    0,
    false,
    activeTab === "backlog" && selectedBacklogCycleId ? selectedBacklogCycleId : undefined,
    undefined,
  );
  const backlogArtifacts = backlogData?.items ?? [];
  const backlogTotal = backlogData?.total ?? 0;

  const handleAddCycle = () => {
    setAddMode("cycles");
    setAddParentId(null);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };
  const handleAddChildCycle = (parent: CycleNode) => {
    setAddMode("cycles");
    setAddParentId(parent.id);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };
  const onSubmitAdd = (data: { name: string }) => {
    const name = data.name.trim();
    if (!name) return;
    if (addMode === "cycles") {
      createCycle.mutate(
        { name, parent_id: addParentId || undefined },
        {
          onSuccess: () => {
            setAddDialogOpen(false);
            showNotification("Cycle added", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to add cycle", "error"),
        },
      );
    } else {
      createArea.mutate(
        { name, parent_id: addParentId || undefined },
        {
          onSuccess: () => {
            setAddDialogOpen(false);
            showNotification("Area added", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to add area", "error"),
        },
      );
    }
  };

  const handleAddArea = () => {
    setAddMode("areas");
    setAddParentId(null);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };
  const handleAddChildArea = (parent: AreaNode) => {
    setAddMode("areas");
    setAddParentId(parent.id);
    resetAddForm({ name: "" });
    setAddDialogOpen(true);
  };

  const handleRenameCycle = (node: CycleNode) => {
    setRenameNode(node);
    setRenameDialogOpen(true);
  };
  const handleRenameArea = (node: AreaNode) => {
    setRenameNode(node);
    setRenameDialogOpen(true);
  };
  const onSubmitRename = (data: { name: string }) => {
    const name = data.name.trim();
    if (!name || !renameNode) return;
    if ("goal" in renameNode) {
      updateCycle.mutate(
        { cycleNodeId: renameNode.id, body: { name } },
        {
          onSuccess: () => {
            setRenameDialogOpen(false);
            setRenameNode(null);
            showNotification("Cycle updated", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to update", "error"),
        },
      );
    } else {
      updateArea.mutate(
        { areaNodeId: renameNode.id, body: { name } },
        {
          onSuccess: () => {
            setRenameDialogOpen(false);
            setRenameNode(null);
            showNotification("Area updated", "success");
          },
          onError: (e: Error) => showNotification(e?.message ?? "Failed to update", "error"),
        },
      );
    }
  };

  const handleDeleteCycle = (node: CycleNode) => {
    if (!window.confirm(`Delete cycle "${node.name}"?`)) return;
    deleteCycle.mutate(node.id, {
      onSuccess: () => showNotification("Cycle deleted", "success"),
      onError: (e: Error) => showNotification(e?.message ?? "Failed to delete", "error"),
    });
  };
  const handleDeleteArea = (node: AreaNode) => {
    if (!window.confirm(`Delete area "${node.name}"?`)) return;
    deleteArea.mutate(node.id, {
      onSuccess: () => showNotification("Area deleted", "success"),
      onError: (e: Error) => showNotification(e?.message ?? "Failed to delete", "error"),
    });
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <ProjectBreadcrumbs currentPageLabel="Planning" projectName={project?.name} />

      {!project && projectSlug && orgSlug ? (
        <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />
      ) : (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <AccountTree color="primary" />
            <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
              Planning
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cycles (iterations) and Areas for backlog and assignment.
          </Typography>

          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
          >
            <Tab
              value="cycles"
              label={`Cycles${!cyclesLoading ? ` (${cycleNodes.length})` : ""}`}
              icon={<AccountTree fontSize="small" />}
              iconPosition="start"
            />
            <Tab
              value="areas"
              label={`Areas${!areasLoading ? ` (${areaNodes.length})` : ""}`}
              icon={<Folder fontSize="small" />}
              iconPosition="start"
            />
            <Tab value="backlog" label="Cycle backlog" icon={<ViewList fontSize="small" />} iconPosition="start" />
          </Tabs>

          {activeTab === "cycles" && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
                  <Typography component="h2" variant="h6" fontWeight={600}>
                    Cycle tree
                  </Typography>
                </Box>
                <Button size="small" variant="contained" startIcon={<Add />} onClick={handleAddCycle} disabled={cyclesLoading}>
                  Add cycle
                </Button>
              </Box>
              {cyclesLoading ? (
                <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
              ) : cycleNodes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No cycles. Add a cycle to represent iterations or sprints.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {cycleNodes.map((node) => (
                    <CycleTreeItem
                      key={node.id}
                      node={node}
                      level={0}
                      onRename={handleRenameCycle}
                      onDelete={handleDeleteCycle}
                      onAddChild={handleAddChildCycle}
                    />
                  ))}
                </List>
              )}
            </Paper>
          )}

          {activeTab === "areas" && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "secondary.main" }} />
                  <Typography component="h2" variant="h6" fontWeight={600}>
                    Area tree
                  </Typography>
                </Box>
                <Button size="small" variant="contained" startIcon={<Add />} onClick={handleAddArea} disabled={areasLoading}>
                  Add area
                </Button>
              </Box>
              {areasLoading ? (
                <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
              ) : areaNodes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No areas. Add an area path for assignment.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {areaNodes.map((node) => (
                    <AreaTreeItem
                      key={node.id}
                      node={node}
                      level={0}
                      onRename={handleRenameArea}
                      onDelete={handleDeleteArea}
                      onAddChild={handleAddChildArea}
                    />
                  ))}
                </List>
              )}
            </Paper>
          )}

          {activeTab === "backlog" && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "success.main" }} />
                <Typography variant="h6" fontWeight={600}>
                  Cycle backlog
                </Typography>
              </Box>
              <FormProvider {...backlogForm}>
                <Box sx={{ minWidth: 220, mb: 2 }}>
                  <RhfSelect<{ cycleId: string }>
                    name="cycleId"
                    control={backlogForm.control}
                    label="Cycle"
                    placeholder="Select a cycle"
                    options={cycleNodesFlat.map((c) => ({ value: c.id, label: cycleNodeDisplayLabel(c) }))}
                    selectProps={{ size: "small" }}
                  />
                </Box>
              </FormProvider>
              {selectedBacklogCycleId ? (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {backlogTotal} artifact(s) in this cycle
                    </Typography>
                    <Button
                      size="small"
                      component={Link}
                      to={orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}/artifacts` : "#"}
                      onClick={() => setListState({ cycleNodeFilter: selectedBacklogCycleId })}
                    >
                      View all in Artifacts
                    </Button>
                  </Box>
                  {backlogArtifacts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No artifacts assigned to this cycle.
                    </Typography>
                  ) : (
                    <List dense disablePadding>
                      {backlogArtifacts.map((a) => (
                        <BacklogArtifactRow
                          key={a.id}
                          artifact={a}
                          orgSlug={orgSlug}
                          projectId={project?.id}
                          projectSlug={projectSlug}
                          cycleNodesFlat={cycleNodesFlat}
                          showNotification={showNotification}
                        />
                      ))}
                    </List>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Select a cycle to view its backlog (artifacts assigned to that cycle).
                </Typography>
              )}
            </Paper>
          )}
        </>
      )}

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{addMode === "cycles" ? "Add cycle" : "Add area"}</DialogTitle>
        <FormProvider {...addForm}>
          <Box component="form" onSubmit={handleAddSubmit(onSubmitAdd)} noValidate>
            <DialogContent>
              <RhfTextField<{ name: string }>
                name="name"
                label="Name"
                fullWidth
                size="small"
                autoFocus
                sx={{ mt: 1 }}
              />
              {addParentId && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Will be created as child of selected node.
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={addMode === "cycles" ? createCycle.isPending : createArea.isPending}
              >
                Add
              </Button>
            </DialogActions>
          </Box>
        </FormProvider>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => { setRenameDialogOpen(false); setRenameNode(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Rename</DialogTitle>
        <FormProvider {...renameForm}>
          <Box component="form" onSubmit={handleRenameSubmit(onSubmitRename)} noValidate>
            <DialogContent>
              <RhfTextField<{ name: string }>
                name="name"
                label="Name"
                fullWidth
                size="small"
                autoFocus
                sx={{ mt: 1 }}
              />
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={() => { setRenameDialogOpen(false); setRenameNode(null); }}>Cancel</Button>
              <Button type="submit" variant="contained">
                Save
              </Button>
            </DialogActions>
          </Box>
        </FormProvider>
      </Dialog>
    </Container>
  );
}
