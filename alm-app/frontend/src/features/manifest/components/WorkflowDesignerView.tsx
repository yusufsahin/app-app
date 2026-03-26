/**
 * C3: Workflow (FSM) visualisation and edit (add/remove states, add transitions, save to manifest).
 */
import { useState, useMemo, useEffect } from "react";
import { useForm, FormProvider, useWatch, type UseFormReturn } from "react-hook-form";
import { Button, Badge } from "../../../shared/components/ui";
import { GitBranch, ArrowRight, Plus, Save, X, Layers } from "lucide-react";
import { RhfSelect } from "../../../shared/components/forms";

export interface WorkflowState {
  id: string;
  name?: string;
  category?: string;
}

export interface WorkflowTransition {
  from: string;
  to: string;
}

export interface WorkflowDef {
  id: string;
  name?: string;
  states?: WorkflowState[];
  transitions?: WorkflowTransition[];
}

export interface WorkflowDesignerViewProps {
  workflows: WorkflowDef[];
  /** When true, show Add transition and Save to manifest. */
  editable?: boolean;
  /** Called when user saves workflow changes; parent should merge into bundle and PUT manifest. */
  onSaveWorkflow?: (workflow: WorkflowDef) => void;
  isSaving?: boolean;
}

const STATE_CATEGORIES = [
  { value: "", label: "Default" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

type WorkflowFormValues = { workflowId: string; addFrom: string; addTo: string };

const NODE_WIDTH = 88;
const NODE_HEIGHT = 32;
const GAP = 24;
const SVG_PAD = 40;

type WorkflowDesignerBodyProps = {
  selected: WorkflowDef;
  form: UseFormReturn<WorkflowFormValues>;
  addFrom: string;
  addTo: string;
  editable: boolean;
  onSaveWorkflow?: (workflow: WorkflowDef) => void;
  isSaving: boolean;
};

function WorkflowDesignerBody({
  selected,
  form,
  addFrom,
  addTo,
  editable,
  onSaveWorkflow,
  isSaving,
}: WorkflowDesignerBodyProps) {
  const { control, setValue } = form;

  const [draftTransitions, setDraftTransitions] = useState<WorkflowTransition[]>([]);
  const [draftStates, setDraftStates] = useState<WorkflowState[]>([]);
  const [deletedStateIds, setDeletedStateIds] = useState<Set<string>>(new Set());
  const [newStateId, setNewStateId] = useState("");
  const [newStateName, setNewStateName] = useState("");
  const [newStateCategory, setNewStateCategory] = useState("");
  const [stateIdError, setStateIdError] = useState("");

  const baseStates: WorkflowState[] = useMemo(() => {
    const raw = selected.states ?? [];
    return raw.map((s) =>
      typeof s === "string" ? { id: s, name: s } : { id: (s as WorkflowState).id, name: (s as WorkflowState).name, category: (s as WorkflowState).category },
    );
  }, [selected.states]);

  // Effective states: base (minus deleted) + draft additions
  const states: WorkflowState[] = useMemo(
    () => [...baseStates.filter((s) => !deletedStateIds.has(s.id)), ...draftStates],
    [baseStates, draftStates, deletedStateIds],
  );

  const baseTransitions = useMemo(() => selected.transitions ?? [], [selected.transitions]);

  // Effective transitions: base + draft, auto-filtered for deleted states
  const transitions = useMemo(
    () => [...baseTransitions, ...draftTransitions].filter(
      (t) => !deletedStateIds.has(t.from) && !deletedStateIds.has(t.to),
    ),
    [baseTransitions, draftTransitions, deletedStateIds],
  );
  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  const nodePositions = useMemo(() => {
    const pos: Array<{ id: string; x: number; y: number }> = [];
    states.forEach((s, i) => {
      pos.push({
        id: s.id,
        x: SVG_PAD + i * (NODE_WIDTH + GAP) + NODE_WIDTH / 2,
        y: SVG_PAD + NODE_HEIGHT / 2,
      });
    });
    return pos;
  }, [states]);

  const hasDraft =
    draftTransitions.length > 0 || draftStates.length > 0 || deletedStateIds.size > 0;

  const handleAddState = () => {
    const id = newStateId.trim().replace(/\s+/g, "_");
    if (!id) { setStateIdError("ID required"); return; }
    if (states.some((s) => s.id === id)) { setStateIdError("ID already exists"); return; }
    setStateIdError("");
    setDraftStates((prev) => [
      ...prev,
      { id, name: newStateName.trim() || id, category: newStateCategory || undefined },
    ]);
    setNewStateId("");
    setNewStateName("");
    setNewStateCategory("");
  };

  const handleRemoveState = (stateId: string, isDraft: boolean) => {
    if (isDraft) {
      setDraftStates((prev) => prev.filter((s) => s.id !== stateId));
      setDraftTransitions((prev) => prev.filter((t) => t.from !== stateId && t.to !== stateId));
    } else {
      setDeletedStateIds((prev) => new Set([...prev, stateId]));
      if (addFrom === stateId) setValue("addFrom", "");
      if (addTo === stateId) setValue("addTo", "");
    }
  };

  const handleAddTransition = () => {
    if (addFrom && addTo) {
      setDraftTransitions((prev) => [...prev, { from: addFrom, to: addTo }]);
      setValue("addFrom", "");
      setValue("addTo", "");
    }
  };

  const handleSaveToManifest = () => {
    if (!onSaveWorkflow) return;
    const updated: WorkflowDef = {
      ...selected,
      states,
      transitions,
    };
    onSaveWorkflow(updated);
    setDraftTransitions([]);
    setDraftStates([]);
    setDeletedStateIds(new Set());
  };

  const removeDraftTransition = (index: number) => {
    // index is within the full transitions array; draft transitions start after base (minus deleted)
    const baseCount = baseTransitions.filter(
      (t) => !deletedStateIds.has(t.from) && !deletedStateIds.has(t.to),
    ).length;
    setDraftTransitions((prev) => prev.filter((_, i) => i !== index - baseCount));
  };

  const totalWidth = states.length > 0 ? SVG_PAD * 2 + states.length * NODE_WIDTH + (states.length - 1) * GAP : 400;
  const svgHeight = SVG_PAD * 2 + NODE_HEIGHT + (transitions.some((t) => t.from === t.to) ? 36 : 0);

  const getPos = (stateId: string) => nodePositions.find((p) => p.id === stateId);
  const nodeLeft = (x: number) => x - NODE_WIDTH / 2;
  const nodeTop = (y: number) => y - NODE_HEIGHT / 2;

  return (
    <>
      {states.length > 0 && (
        <div className="mb-4 overflow-auto">
          <svg
            width="100%"
            viewBox={`0 0 ${totalWidth} ${svgHeight}`}
            style={{ minHeight: 100, display: "block" }}
            aria-label={`Workflow ${selected.name || selected.id} diagram`}
          >
            <defs>
              <marker
                id="workflow-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
              </marker>
            </defs>
            {transitions.map((t, i) => {
              const fromPos = getPos(t.from);
              const toPos = getPos(t.to);
              if (!fromPos || !toPos) return null;
              const isSelf = t.from === t.to;
              if (isSelf) {
                const sx = fromPos.x + NODE_WIDTH / 2;
                const sy = fromPos.y;
                const path = `M ${sx} ${sy} C ${sx + 28} ${sy - 22}, ${sx + 28} ${sy + 22}, ${sx} ${sy}`;
                return (
                  <path
                    key={`e-${i}`}
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    markerEnd="url(#workflow-arrow)"
                    opacity={0.7}
                  />
                );
              }
              const startX = fromPos.x + NODE_WIDTH / 2;
              const startY = fromPos.y;
              const endX = toPos.x - NODE_WIDTH / 2;
              const endY = toPos.y;
              const midX = (startX + endX) / 2;
              const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
              return (
                <path
                  key={`e-${i}`}
                  d={path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  markerEnd="url(#workflow-arrow)"
                  opacity={0.7}
                />
              );
            })}
            {nodePositions.map((pos) => {
              const state = stateMap.get(pos.id);
              const category = state?.category;
              const fill =
                category === "completed"
                  ? "hsl(var(--success) / 0.2)"
                  : category === "in_progress"
                    ? "hsl(var(--primary) / 0.2)"
                    : "hsl(var(--muted))";
              return (
                <g key={pos.id}>
                  <rect
                    x={nodeLeft(pos.x)}
                    y={nodeTop(pos.y)}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={6}
                    fill={fill}
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontSize: 12, fontWeight: 500, fill: "currentColor" }}
                  >
                    {state?.name || pos.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <p className="mb-2 text-sm font-medium text-muted-foreground">States</p>
      <div className="mb-4 flex flex-wrap gap-1">
        {states.map((s) => {
          const isDraftState = draftStates.some((d) => d.id === s.id);
          return (
            <Badge
              key={s.id}
              variant="outline"
              className={`flex items-center gap-1 text-xs ${s.category === "completed" ? "border-green-500/50 text-green-700 dark:text-green-400" : s.category === "in_progress" ? "border-primary/50" : ""} ${isDraftState ? "border-dashed" : ""}`}
            >
              {s.name || s.id}
              {isDraftState && <span className="text-[10px] opacity-60">(new)</span>}
              {editable && (
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                  aria-label={`Remove state ${s.name || s.id}`}
                  onClick={() => handleRemoveState(s.id, isDraftState)}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>

      {editable && (
        <div className="mb-4 rounded-md border border-dashed p-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Layers className="size-3" /> Add state
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex flex-col gap-1">
              <input
                type="text"
                placeholder="State ID (e.g. review)"
                value={newStateId}
                onChange={(e) => { setNewStateId(e.target.value); setStateIdError(""); }}
                className="h-8 min-w-[140px] rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddState(); }}
              />
              {stateIdError && <p className="text-xs text-destructive">{stateIdError}</p>}
            </div>
            <input
              type="text"
              placeholder="Label (optional)"
              value={newStateName}
              onChange={(e) => setNewStateName(e.target.value)}
              className="h-8 min-w-[120px] rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddState(); }}
            />
            <select
              aria-label="State category"
              title="State category"
              value={newStateCategory}
              onChange={(e) => setNewStateCategory(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {STATE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={handleAddState} disabled={!newStateId.trim()}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
        </div>
      )}

      {editable && states.length >= 2 && (
        <FormProvider {...form}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[140px]">
              <RhfSelect<WorkflowFormValues>
                name="addFrom"
                control={control}
                label="From"
                options={states.map((s) => ({ value: s.id, label: s.name || s.id }))}
              />
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
            <div className="min-w-[140px]">
              <RhfSelect<WorkflowFormValues>
                name="addTo"
                control={control}
                label="To"
                options={states.map((s) => ({ value: s.id, label: s.name || s.id }))}
              />
            </div>
            <Button size="sm" onClick={handleAddTransition} disabled={!addFrom || !addTo}>
              <Plus className="size-4" />
              Add transition
            </Button>
            {hasDraft && onSaveWorkflow && (
              <Button size="sm" onClick={handleSaveToManifest} disabled={isSaving}>
                <Save className="size-4" />
                {isSaving ? "Saving…" : "Save to manifest"}
              </Button>
            )}
          </div>
        </FormProvider>
      )}

      <p className="mb-2 text-sm font-medium text-muted-foreground">Transitions</p>
      {transitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transitions defined.</p>
      ) : (
        <ul className="space-y-0.5">
          {transitions.map((t, i) => {
            const fromName = stateMap.get(t.from)?.name ?? t.from;
            const toName = stateMap.get(t.to)?.name ?? t.to;
            const isDraft = i >= baseTransitions.length;
            return (
              <li
                key={`${t.from}-${t.to}-${i}`}
                className="flex items-center justify-between py-0.5"
              >
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs font-medium">{fromName}</Badge>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs font-medium">{toName}</Badge>
                  {isDraft && (
                    <Badge className="ml-1 text-xs">new</Badge>
                  )}
                </div>
                {isDraft && editable ? (
                  <button
                    type="button"
                    className="rounded p-1 hover:bg-muted"
                    aria-label="Remove transition"
                    onClick={() => removeDraftTransition(i)}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function WorkflowDesignerView({
  workflows,
  editable = false,
  onSaveWorkflow,
  isSaving = false,
}: WorkflowDesignerViewProps) {
  const form = useForm<WorkflowFormValues>({
    defaultValues: { workflowId: "", addFrom: "", addTo: "" },
  });
  const { reset, setValue, control } = form;
  const workflowId = useWatch({ control, name: "workflowId" }) ?? "";
  const addFrom = useWatch({ control, name: "addFrom" }) ?? "";
  const addTo = useWatch({ control, name: "addTo" }) ?? "";

  const selected = useMemo(
    () => workflows.find((w) => w.id === workflowId) ?? workflows[0] ?? null,
    [workflows, workflowId],
  );

  useEffect(() => {
    const firstId = workflows[0]?.id ?? "";
    if (firstId && !workflows.some((w) => w.id === workflowId)) reset({ workflowId: firstId, addFrom: "", addTo: "" });
  }, [workflows, workflowId, reset]);

  useEffect(() => {
    setValue("addFrom", "");
    setValue("addTo", "");
  }, [selected?.id, setValue]);

  if (workflows.length === 0) {
    return (
      <div className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">
          No workflows defined. Add workflows in the Source tab and save.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
        <GitBranch className="size-4" />
        {editable ? "Workflow" : "Workflow (read-only)"}
      </p>

      {workflows.length > 1 && (
        <FormProvider {...form}>
          <div className="mb-4 min-w-[200px]">
            <RhfSelect<WorkflowFormValues>
              name="workflowId"
              control={control}
              label="Workflow"
              options={workflows.map((w) => ({ value: w.id, label: w.name || w.id }))}
            />
          </div>
        </FormProvider>
      )}

      {selected && (
        <WorkflowDesignerBody
          key={selected.id}
          selected={selected}
          form={form}
          addFrom={addFrom}
          addTo={addTo}
          editable={editable}
          onSaveWorkflow={onSaveWorkflow}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
