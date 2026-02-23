import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Skeleton,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  Collapse,
} from "@mui/material";
import {
  ArrowBack,
  Add,
  MoreVert,
  BugReport,
  Assignment,
  TableChart,
  AccountTree,
  ExpandLess,
  ExpandMore,
} from "@mui/icons-material";
import { useState } from "react";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectManifest } from "../../../shared/api/manifestApi";
import {
  useArtifacts,
  useCreateArtifact,
  useTransitionArtifact,
  type Artifact,
  type CreateArtifactRequest,
} from "../../../shared/api/artifactApi";

function getArtifactIcon(type: string) {
  switch (type) {
    case "defect":
      return <BugReport fontSize="small" />;
    case "requirement":
      return <Assignment fontSize="small" />;
    default:
      return <Assignment fontSize="small" />;
  }
}

/** Derive valid transitions from manifest workflow */
function getValidTransitions(
  manifest: { manifest_bundle?: { workflows?: unknown[]; artifact_types?: Array<{ id: string; workflow_id: string }> } } | null | undefined,
  artifactType: string,
  currentState: string,
): string[] {
  const bundle = manifest?.manifest_bundle;
  if (!bundle) return [];
  const workflows = (bundle.workflows ?? []) as Array<{ id: string; transitions?: Array<{ from: string; to: string }> }>;
  const artifactTypes = bundle.artifact_types ?? [];
  const at = artifactTypes.find((a) => a.id === artifactType);
  if (!at?.workflow_id) return [];
  const wf = workflows.find((w) => w.id === at.workflow_id);
  if (!wf?.transitions) return [];
  return wf.transitions
    .filter((t) => t.from === currentState)
    .map((t) => t.to);
}

export type ViewMode = "table" | "tree";

interface ArtifactNode extends Artifact {
  children: ArtifactNode[];
}

function buildArtifactTree(artifacts: Artifact[]): ArtifactNode[] {
  const byId = new Map<string, ArtifactNode>();
  for (const a of artifacts) {
    byId.set(a.id, { ...a, children: [] });
  }
  const roots: ArtifactNode[] = [];
  for (const a of artifacts) {
    const node = byId.get(a.id)!;
    if (!a.parent_id) {
      roots.push(node);
    } else {
      const parent = byId.get(a.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  return roots;
}

export default function ArtifactsPage() {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const navigate = useNavigate();
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);
  const { data: manifest } = useProjectManifest(orgSlug, project?.id);
  const { data: artifacts, isLoading } = useArtifacts(orgSlug, project?.id);
  const createMutation = useCreateArtifact(orgSlug, project?.id);

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateArtifactRequest>({
    artifact_type: "requirement",
    title: "",
    description: "",
    parent_id: null,
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const bundle = manifest?.manifest_bundle as { artifact_types?: Array<{ id: string; name: string }> } | undefined;
  const artifactTypes = bundle?.artifact_types ?? [
    { id: "requirement", name: "Requirement" },
    { id: "defect", name: "Defect" },
  ];

  const handleCreate = async () => {
    if (!createForm.title.trim()) return;
    try {
      await createMutation.mutateAsync(createForm);
      setCreateOpen(false);
      setCreateForm({ artifact_type: "requirement", title: "", description: "", parent_id: null });
    } catch {
      // Error handled by mutation
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, a: Artifact) => {
    setAnchorEl(e.currentTarget);
    setSelectedArtifact(a);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedArtifact(null);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() =>
          navigate(orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "..")
        }
        sx={{ mb: 3 }}
      >
        Back to project
      </Button>

      {!project && projectSlug ? (
        <Typography color="text.secondary">
          Project &quot;{projectSlug}&quot; not found.
        </Typography>
      ) : (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 2,
              mb: 3,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="h4" fontWeight={700}>
                Artifacts
              </Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, v) => v && setViewMode(v)}
                size="small"
              >
                <ToggleButton value="table" aria-label="Table view">
                  <TableChart sx={{ mr: 0.5 }} />
                  Table
                </ToggleButton>
                <ToggleButton value="tree" aria-label="Tree view">
                  <AccountTree sx={{ mr: 0.5 }} />
                  Tree
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateOpen(true)}
            >
              New artifact
            </Button>
          </Box>

          {isLoading ? (
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
          ) : viewMode === "table" ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {artifacts?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No artifacts yet. Create one to get started.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    artifacts?.map((a) => (
                      <ArtifactRow
                        key={a.id}
                        artifact={a}
                        manifest={manifest}
                        onMenuOpen={handleMenuOpen}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper variant="outlined">
              {artifacts?.length === 0 ? (
                <Box sx={{ py: 4, px: 2, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    No artifacts yet. Create one to get started.
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {buildArtifactTree(artifacts ?? []).map((node) => (
                    <ArtifactTreeNode
                      key={node.id}
                      node={node}
                      manifest={manifest}
                      onMenuOpen={handleMenuOpen}
                      expandedIds={expandedIds}
                      onToggleExpand={toggleExpand}
                      depth={0}
                      orgSlug={orgSlug}
                      projectId={project?.id}
                    />
                  ))}
                </List>
              )}
            </Paper>
          )}

          <Menu
            anchorEl={anchorEl}
            open={!!anchorEl}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            {selectedArtifact &&
              getValidTransitions(
                manifest,
                selectedArtifact.artifact_type,
                selectedArtifact.state,
              ).map((targetState) => (
                <TransitionMenuItem
                  key={targetState}
                  artifact={selectedArtifact}
                  targetState={targetState}
                  orgSlug={orgSlug}
                  projectId={project?.id}
                  onClose={handleMenuClose}
                />
              ))}
            {selectedArtifact &&
              getValidTransitions(
                manifest,
                selectedArtifact.artifact_type,
                selectedArtifact.state,
              ).length === 0 && (
                <MenuItem disabled>No valid transitions</MenuItem>
              )}
          </Menu>
        </Box>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create artifact</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Parent (optional)</InputLabel>
            <Select
              value={createForm.parent_id ?? ""}
              label="Parent (optional)"
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  parent_id: (e.target.value as string) || null,
                }))
              }
            >
              <MenuItem value="">None (root)</MenuItem>
              {artifacts?.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.title} ({a.artifact_type})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={createForm.artifact_type}
              label="Type"
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, artifact_type: e.target.value }))
              }
            >
              {artifactTypes.map((at: { id: string; name: string }) => (
                <MenuItem key={at.id} value={at.id}>
                  {at.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Title"
            value={createForm.title}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, title: e.target.value }))
            }
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={createForm.description ?? ""}
            onChange={(e) =>
              setCreateForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!createForm.title.trim() || createMutation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function ArtifactTreeNode({
  node,
  manifest,
  onMenuOpen,
  expandedIds,
  onToggleExpand,
  depth,
  orgSlug,
  projectId,
}: {
  node: ArtifactNode;
  manifest: Parameters<typeof getValidTransitions>[0];
  onMenuOpen: (e: React.MouseEvent<HTMLElement>, a: Artifact) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  depth: number;
  orgSlug: string | undefined;
  projectId: string | undefined;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const validTransitions = getValidTransitions(
    manifest,
    node.artifact_type,
    node.state,
  );

  return (
    <>
      <ListItem
        sx={{
          pl: 2 + depth * 3,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
        secondaryAction={
          validTransitions.length > 0 && (
            <IconButton
              size="small"
              onClick={(e) => onMenuOpen(e, node)}
              aria-label="Transition"
            >
              <MoreVert />
            </IconButton>
          )
        }
      >
        {hasChildren ? (
          <IconButton size="small" onClick={() => onToggleExpand(node.id)} sx={{ mr: 0.5 }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        ) : (
          <Box component="span" sx={{ width: 32, display: "inline-block" }} />
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
          {getArtifactIcon(node.artifact_type)}
          <Typography variant="body2" textTransform="capitalize" color="text.secondary">
            {node.artifact_type}
          </Typography>
          <Typography fontWeight={500} noWrap>
            {node.title}
          </Typography>
          <Chip label={node.state} size="small" variant="outlined" sx={{ ml: 1 }} />
        </Box>
      </ListItem>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List disablePadding>
          {node.children.map((child) => (
            <ArtifactTreeNode
              key={child.id}
              node={child}
              manifest={manifest}
              onMenuOpen={onMenuOpen}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
              orgSlug={orgSlug}
              projectId={projectId}
            />
          ))}
        </List>
      </Collapse>
    </>
  );
}

function ArtifactRow({
  artifact,
  manifest,
  onMenuOpen,
}: {
  artifact: Artifact;
  manifest: Parameters<typeof getValidTransitions>[0];
  onMenuOpen: (e: React.MouseEvent<HTMLElement>, a: Artifact) => void;
}) {
  const validTransitions = getValidTransitions(
    manifest,
    artifact.artifact_type,
    artifact.state,
  );
  return (
    <TableRow>
      <TableCell sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {getArtifactIcon(artifact.artifact_type)}
        <Typography variant="body2" textTransform="capitalize">
          {artifact.artifact_type}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography fontWeight={500}>{artifact.title}</Typography>
        {artifact.description && (
          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
            {artifact.description}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Chip label={artifact.state} size="small" variant="outlined" />
      </TableCell>
      <TableCell align="right">
        {validTransitions.length > 0 && (
          <IconButton
            size="small"
            onClick={(e) => onMenuOpen(e, artifact)}
            aria-label="Transition"
          >
            <MoreVert />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  );
}

function TransitionMenuItem({
  artifact,
  targetState,
  orgSlug,
  projectId,
  onClose,
}: {
  artifact: Artifact;
  targetState: string;
  orgSlug: string | undefined;
  projectId: string | undefined;
  onClose: () => void;
}) {
  const transitionMutation = useTransitionArtifact(
    orgSlug,
    projectId,
    artifact.id,
  );
  const handleClick = async () => {
    try {
      await transitionMutation.mutateAsync(targetState);
      onClose();
    } catch {
      // Error handled
    }
  };
  return (
    <MenuItem onClick={handleClick} disabled={transitionMutation.isPending}>
      Move to {targetState}
    </MenuItem>
  );
}
