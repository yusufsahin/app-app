import { useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Card,
  CardContent,
  Stack,
  Paper,
  InputAdornment,
  TextField,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Add, Delete, Rule, AutoAwesome, CheckCircle, Circle, PlayArrow, Pause, Search } from "@mui/icons-material";
import { useState, useMemo } from "react";
import { RhfSelect, RhfSwitch, RhfTextField } from "../../../shared/components/forms";
import { useOrgProjects } from "../../../shared/api/orgApi";
import {
  useWorkflowRules,
  useCreateWorkflowRule,
  useDeleteWorkflowRule,
  TRIGGER_EVENT_TYPES,
  type WorkflowRuleCreateRequest,
} from "../../../shared/api/workflowRuleApi";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
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
  const [searchTerm, setSearchTerm] = useState("");

  const totalRules = rules.length;
  const activeRules = rules.filter((r) => r.is_active).length;
  const inactiveRules = totalRules - activeRules;

  const filteredRules = useMemo(() => {
    if (!searchTerm.trim()) return rules;
    const q = searchTerm.toLowerCase();
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.trigger_event_type.toLowerCase().includes(q),
    );
  }, [rules, searchTerm]);

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

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <AutoAwesome color="primary" />
            <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
              Automation
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Run actions when events happen (e.g. artifact created, state changed). Actions: log, notification.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={handleOpenDialog}>
          Add rule
        </Button>
      </Stack>

      {/* Stat Cards */}
      {!isLoading && totalRules > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: "primary.light",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Rule sx={{ color: "primary.main" }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>{totalRules}</Typography>
                    <Typography variant="body2" color="text.secondary">Total Rules</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: "success.light",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PlayArrow sx={{ color: "success.main" }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>{activeRules}</Typography>
                    <Typography variant="body2" color="text.secondary">Active Rules</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: "warning.light",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Pause sx={{ color: "warning.main" }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" fontWeight={700}>{inactiveRules}</Typography>
                    <Typography variant="body2" color="text.secondary">Inactive Rules</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search */}
      {!isLoading && totalRules > 0 && (
        <Paper sx={{ p: 1.5, mb: 2 }}>
          <TextField
            placeholder="Search rules by name or trigger…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Paper>
      )}

      {isLoading ? (
        <LoadingState label="Loading rules…" />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Rule />}
          title="No workflow rules"
          description="Add a rule to run actions when events happen (e.g. artifact created, state changed)."
          actionLabel="Add rule"
          onAction={handleOpenDialog}
          bordered
        />
      ) : filteredRules.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="No matching rules"
          description={`No rules match "${searchTerm}".`}
          bordered
        />
      ) : (
        <Stack spacing={2}>
          {filteredRules.map((r) => (
            <Card key={r.id} variant="outlined" sx={{ transition: "box-shadow 0.2s", "&:hover": { boxShadow: 3 } }}>
              <CardContent sx={{ py: 2, px: 3, "&:last-child": { pb: 2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        bgcolor: r.is_active ? "primary.light" : "grey.100",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Rule sx={{ color: r.is_active ? "primary.main" : "text.disabled", fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" fontWeight={600}>
                          {r.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={r.is_active ? "Active" : "Inactive"}
                          color={r.is_active ? "success" : "default"}
                          variant="filled"
                          icon={r.is_active ? <CheckCircle sx={{ fontSize: "12px !important" }} /> : <Circle sx={{ fontSize: "12px !important" }} />}
                          sx={{ height: 20, fontSize: "0.7rem" }}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Trigger: {TRIGGER_EVENT_TYPES.find((t) => t.value === r.trigger_event_type)?.label ?? r.trigger_event_type}
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Delete rule"
                    onClick={() => handleDelete(r.id)}
                    disabled={deleteRule.isPending}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
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
