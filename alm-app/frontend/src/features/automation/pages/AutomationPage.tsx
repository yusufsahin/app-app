import { useParams } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  Scale,
  Sparkles,
  CheckCircle,
  Circle,
  Play,
  Pause,
  Search,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../shared/components/ui";
import { RhfSelect, RhfSwitch, RhfTextField } from "../../../shared/components/forms";
import { useOrgProjects } from "../../../shared/api/orgApi";
import { useProjectStore } from "../../../shared/stores/projectStore";
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
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(orgSlug);
  const currentProjectFromStore = useProjectStore((s) => s.currentProject);
  const project =
    projects?.find((p) => p.slug === projectSlug) ??
    (currentProjectFromStore?.slug === projectSlug ? currentProjectFromStore : undefined);
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

  if (projectSlug && orgSlug && !projectsLoading && !project) {
    return <ProjectNotFoundView orgSlug={orgSlug} projectSlug={projectSlug} />;
  }
  if (projectSlug && orgSlug && projectsLoading) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="text-muted-foreground">Loading project…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <ProjectBreadcrumbs currentPageLabel="Automation" projectName={project?.name} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="size-6 text-primary" />
            <h1 className="text-2xl font-bold">Automation</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Run actions when events happen (e.g. artifact created, state changed). Actions: log, notification.
          </p>
        </div>
        <Button onClick={handleOpenDialog}>
          <Plus className="mr-2 size-4" />
          Add rule
        </Button>
      </div>

      {!isLoading && totalRules > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Scale className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRules}</p>
                <p className="text-sm text-muted-foreground">Total Rules</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                <Play className="size-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeRules}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
                <Pause className="size-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveRules}</p>
                <p className="text-sm text-muted-foreground">Inactive Rules</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && totalRules > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search rules by name or trigger…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Loading rules…" />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Scale className="size-12" />}
          title="No workflow rules"
          description="Add a rule to run actions when events happen (e.g. artifact created, state changed)."
          actionLabel="Add rule"
          onAction={handleOpenDialog}
          bordered
        />
      ) : filteredRules.length === 0 ? (
        <EmptyState
          icon={<Search className="size-12" />}
          title="No matching rules"
          description={`No rules match "${searchTerm}".`}
          bordered
        />
      ) : (
        <div className="space-y-2">
          {filteredRules.map((r) => (
            <Card
              key={r.id}
              className="border border-border transition shadow hover:shadow-md"
            >
              <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${r.is_active ? "bg-primary/10" : "bg-muted"}`}
                  >
                    <Scale
                      className={`size-5 ${r.is_active ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                      >
                        {r.is_active ? (
                          <CheckCircle className="size-3" />
                        ) : (
                          <Circle className="size-3" />
                        )}
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Trigger: {TRIGGER_EVENT_TYPES.find((t) => t.value === r.trigger_event_type)?.label ?? r.trigger_event_type}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete rule"
                  onClick={() => handleDelete(r.id)}
                  disabled={deleteRule.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add workflow rule</DialogTitle>
          </DialogHeader>
          <FormProvider {...form}>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
                helperText='e.g. [{"type": "log", "message": "Done"}]'
              />
              <RhfSwitch<AddRuleFormValues> name="is_active" control={control} label="Active" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRule.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}
