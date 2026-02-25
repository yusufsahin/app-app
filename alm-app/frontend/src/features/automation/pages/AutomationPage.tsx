import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Container,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Breadcrumbs,
  Link as MuiLink,
  Chip,
  Skeleton,
} from "@mui/material";
import { ArrowBack, Add, Delete } from "@mui/icons-material";
import { useState } from "react";
import { useOrgProjects } from "../../../shared/api/orgApi";
import {
  useWorkflowRules,
  useCreateWorkflowRule,
  useDeleteWorkflowRule,
  TRIGGER_EVENT_TYPES,
  type WorkflowRuleCreateRequest,
} from "../../../shared/api/workflowRuleApi";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import type { ProblemDetail } from "../../../shared/api/types";

const DEFAULT_ACTIONS_JSON = '[{"type": "log", "message": "Rule triggered"}]';

export default function AutomationPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const navigate = useNavigate();
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);
  const { data: rules = [], isLoading } = useWorkflowRules(orgSlug, project?.id);
  const createRule = useCreateWorkflowRule(orgSlug, project?.id);
  const deleteRule = useDeleteWorkflowRule(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerEventType, setTriggerEventType] = useState("artifact_created");
  const [actionsJson, setActionsJson] = useState(DEFAULT_ACTIONS_JSON);
  const [actionsError, setActionsError] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleOpenDialog = () => {
    setName("");
    setTriggerEventType("artifact_created");
    setActionsJson(DEFAULT_ACTIONS_JSON);
    setActionsError("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const parseActions = (): Record<string, unknown>[] | null => {
    try {
      const parsed = JSON.parse(actionsJson);
      if (!Array.isArray(parsed)) {
        setActionsError("Actions must be a JSON array");
        return null;
      }
      setActionsError("");
      return parsed;
    } catch {
      setActionsError("Invalid JSON");
      return null;
    }
  };

  const handleCreate = () => {
    const actions = parseActions();
    if (!actions || !name.trim() || !project?.id) return;
    const body: WorkflowRuleCreateRequest = {
      name: name.trim(),
      trigger_event_type: triggerEventType,
      actions,
      is_active: isActive,
    };
    createRule.mutate(body, {
      onSuccess: () => {
        setDialogOpen(false);
        showNotification("Workflow rule created", "success");
      },
      onError: (err: Error) => {
        const body = (err as unknown as { body?: ProblemDetail })?.body;
        showNotification(body?.detail ?? "Failed to create rule", "error");
      },
    });
  };

  const handleDelete = (ruleId: string) => {
    if (!window.confirm("Delete this workflow rule?")) return;
    deleteRule.mutate(ruleId, {
      onSuccess: () => showNotification("Rule deleted", "success"),
      onError: (err: Error) => {
        const body = (err as unknown as { body?: ProblemDetail })?.body;
        showNotification(body?.detail ?? "Failed to delete rule", "error");
      },
    });
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "..")}
        sx={{ mb: 2 }}
      >
        Back to project
      </Button>
      <Breadcrumbs sx={{ mb: 2 }}>
        <MuiLink component={Link} to={orgSlug ? `/${orgSlug}` : "#"} underline="hover" color="inherit">
          {orgSlug ?? "Org"}
        </MuiLink>
        <MuiLink
          component={Link}
          to={orgSlug && projectSlug ? `/${orgSlug}/${projectSlug}` : "#"}
          underline="hover"
          color="inherit"
        >
          {project?.name ?? projectSlug}
        </MuiLink>
        <Typography color="text.primary">Automation</Typography>
      </Breadcrumbs>

      <Typography variant="h4" fontWeight={700} gutterBottom>
        Workflow rules
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Run actions when events happen (e.g. artifact created, state changed). Actions: log, notification.
      </Typography>

      <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog} sx={{ mb: 2 }}>
        Add rule
      </Button>

      {isLoading ? (
        <Skeleton variant="rectangular" height={120} />
      ) : rules.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">No workflow rules yet. Add one to get started.</Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <List disablePadding>
            {rules.map((r) => (
              <ListItem key={r.id} divider>
                <ListItemText
                  primary={r.name}
                  secondary={
                    <>
                      Trigger: {TRIGGER_EVENT_TYPES.find((t) => t.value === r.trigger_event_type)?.label ?? r.trigger_event_type}
                      {!r.is_active && (
                        <Chip size="small" label="Inactive" color="default" sx={{ ml: 1 }} />
                      )}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="Delete rule"
                    onClick={() => handleDelete(r.id)}
                    disabled={deleteRule.isPending}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add workflow rule</DialogTitle>
        <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional for modal UX
            autoFocus
            label="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            placeholder="e.g. Log new artifacts"
          />
          <FormControl fullWidth>
            <InputLabel>When</InputLabel>
            <Select
              label="When"
              value={triggerEventType}
              onChange={(e) => setTriggerEventType(e.target.value)}
            >
              {TRIGGER_EVENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Actions (JSON array)"
            value={actionsJson}
            onChange={(e) => setActionsJson(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            error={!!actionsError}
            helperText={actionsError || 'e.g. [{"type": "log", "message": "Done"}]'}
          />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(_, v) => setIsActive(v)} />}
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!name.trim() || createRule.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
