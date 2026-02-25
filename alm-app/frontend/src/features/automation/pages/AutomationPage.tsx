import { useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
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
  Chip,
  Skeleton,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";
import { useState } from "react";
import { RhfSelect, RhfSwitch, RhfTextField } from "../../../shared/components/forms";
import { useOrgProjects } from "../../../shared/api/orgApi";
import {
  useWorkflowRules,
  useCreateWorkflowRule,
  useDeleteWorkflowRule,
  TRIGGER_EVENT_TYPES,
  type WorkflowRuleCreateRequest,
} from "../../../shared/api/workflowRuleApi";
import { ProjectBreadcrumbs, ProjectNotFoundView } from "../../../shared/components/Layout";
import { useNotificationStore } from "../../../shared/stores/notificationStore";
import type { ProblemDetail } from "../../../shared/api/types";

const DEFAULT_ACTIONS_JSON = '[{"type": "log", "message": "Rule triggered"}]';

const addRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(200),
  trigger_event_type: z.string().min(1),
  actions_json: z
    .string()
    .min(1, "Actions JSON is required")
    .refine(
      (s) => {
        try {
          const p = JSON.parse(s);
          return Array.isArray(p);
        } catch {
          return false;
        }
      },
      { message: "Must be a valid JSON array, e.g. [{\"type\": \"log\", \"message\": \"Done\"}]" },
    ),
  is_active: z.boolean(),
});

type AddRuleFormValues = z.infer<typeof addRuleSchema>;

export default function AutomationPage() {
  const { orgSlug, projectSlug } = useParams<{ orgSlug: string; projectSlug: string }>();
  const { data: projects } = useOrgProjects(orgSlug);
  const project = projects?.find((p) => p.slug === projectSlug);
  const { data: rules = [], isLoading } = useWorkflowRules(orgSlug, project?.id);
  const createRule = useCreateWorkflowRule(orgSlug, project?.id);
  const deleteRule = useDeleteWorkflowRule(orgSlug, project?.id);
  const showNotification = useNotificationStore((s) => s.showNotification);

  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<AddRuleFormValues>({
    resolver: zodResolver(addRuleSchema),
    defaultValues: {
      name: "",
      trigger_event_type: "artifact_created",
      actions_json: DEFAULT_ACTIONS_JSON,
      is_active: true,
    },
  });
  const { reset, handleSubmit, control } = form;

  const handleOpenDialog = () => {
    reset({
      name: "",
      trigger_event_type: "artifact_created",
      actions_json: DEFAULT_ACTIONS_JSON,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: AddRuleFormValues) => {
    if (!project?.id) return;
    const actions = JSON.parse(data.actions_json) as Record<string, unknown>[];
    const body: WorkflowRuleCreateRequest = {
      name: data.name.trim(),
      trigger_event_type: data.trigger_event_type,
      actions,
      is_active: data.is_active,
    };
    createRule.mutate(body, {
      onSuccess: () => {
        setDialogOpen(false);
        showNotification("Workflow rule created", "success");
      },
      onError: (err: Error) => {
        const errBody = (err as unknown as { body?: ProblemDetail })?.body;
        showNotification(errBody?.detail ?? "Failed to create rule", "error");
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

  if (!project && projectSlug && orgSlug) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <ProjectBreadcrumbs currentPageLabel="Automation" projectName={project?.name} />

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
        <FormProvider {...form}>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <DialogContent sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <RhfTextField<AddRuleFormValues>
                name="name"
                label="Rule name"
                fullWidth
                placeholder="e.g. Log new artifacts"
                autoFocus
              />
              <RhfSelect<AddRuleFormValues>
                name="trigger_event_type"
                control={control}
                label="When"
                options={TRIGGER_EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
              <RhfTextField<AddRuleFormValues>
                name="actions_json"
                label="Actions (JSON array)"
                fullWidth
                multiline
                minRows={4}
                helperText='e.g. [{"type": "log", "message": "Done"}]'
              />
              <RhfSwitch<AddRuleFormValues> name="is_active" control={control} label="Active" />
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={createRule.isPending}>
                Create
              </Button>
            </DialogActions>
          </Box>
        </FormProvider>
      </Dialog>
    </Container>
  );
}
