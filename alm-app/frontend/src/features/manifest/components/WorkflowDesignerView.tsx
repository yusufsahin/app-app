/**
 * C3: Workflow (FSM) visualisation and minimal edit (add transition, save to manifest).
 */
import { useState, useMemo, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import {
  Box,
  Paper,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  Button,
  IconButton,
} from "@mui/material";
import { AccountTree, ArrowForward, Add, Save, Close } from "@mui/icons-material";
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

type WorkflowFormValues = { workflowId: string; addFrom: string; addTo: string };

export function WorkflowDesignerView({
  workflows,
  editable = false,
  onSaveWorkflow,
  isSaving = false,
}: WorkflowDesignerViewProps) {
  const form = useForm<WorkflowFormValues>({
    defaultValues: { workflowId: "", addFrom: "", addTo: "" },
  });
  const { watch, reset, setValue, control } = form;
  const workflowId = watch("workflowId");
  const addFrom = watch("addFrom");
  const addTo = watch("addTo");
  const [draftTransitions, setDraftTransitions] = useState<WorkflowTransition[]>([]);
  const selected = useMemo(
    () => workflows.find((w) => w.id === workflowId) ?? workflows[0] ?? null,
    [workflows, workflowId],
  );

  useEffect(() => {
    const firstId = workflows[0]?.id ?? "";
    if (firstId && !workflows.some((w) => w.id === workflowId)) reset({ workflowId: firstId, addFrom: "", addTo: "" });
  }, [workflows, workflowId, reset]);

  const states: WorkflowState[] = useMemo(() => {
    const raw = selected?.states ?? [];
    return raw.map((s) =>
      typeof s === "string" ? { id: s, name: s } : { id: (s as WorkflowState).id, name: (s as WorkflowState).name, category: (s as WorkflowState).category },
    );
  }, [selected?.states]);
  const baseTransitions = useMemo(() => selected?.transitions ?? [], [selected?.transitions]);
  const transitions = useMemo(
    () => [...baseTransitions, ...draftTransitions],
    [baseTransitions, draftTransitions],
  );
  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);

  useEffect(() => {
    setDraftTransitions([]);
  }, [selected?.id]);

  const NODE_WIDTH = 88;
  const NODE_HEIGHT = 32;
  const GAP = 24;
  const SVG_PAD = 40;
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

  if (workflows.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No workflows defined. Add workflows in the Source tab and save.
        </Typography>
      </Paper>
    );
  }

  const hasDraft = draftTransitions.length > 0;

  const handleAddTransition = () => {
    if (addFrom && addTo) {
      setDraftTransitions((prev) => [...prev, { from: addFrom, to: addTo }]);
      setValue("addFrom", "");
      setValue("addTo", "");
    }
  };

  const handleSaveToManifest = () => {
    if (!selected || !onSaveWorkflow) return;
    const updated: WorkflowDef = {
      ...selected,
      states: selected.states ?? states,
      transitions,
    };
    onSaveWorkflow(updated);
    setDraftTransitions([]);
  };

  const removeDraftTransition = (index: number) => {
    setDraftTransitions((prev) => prev.filter((_, i) => i !== index - baseTransitions.length));
  };

  const totalWidth = states.length > 0 ? SVG_PAD * 2 + states.length * NODE_WIDTH + (states.length - 1) * GAP : 400;
  const svgHeight = SVG_PAD * 2 + NODE_HEIGHT + (transitions.some((t) => t.from === t.to) ? 36 : 0);

  const getPos = (stateId: string) => nodePositions.find((p) => p.id === stateId);
  const nodeLeft = (x: number) => x - NODE_WIDTH / 2;
  const nodeTop = (y: number) => y - NODE_HEIGHT / 2;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="overline" color="primary" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <AccountTree fontSize="small" />
        {editable ? "Workflow" : "Workflow (read-only)"}
      </Typography>

      {workflows.length > 1 && (
        <FormProvider {...form}>
          <Box sx={{ minWidth: 200, mb: 2 }}>
            <RhfSelect<WorkflowFormValues>
              name="workflowId"
              control={control}
              label="Workflow"
              options={workflows.map((w) => ({ value: w.id, label: w.name || w.id }))}
              selectProps={{ size: "small" }}
            />
          </Box>
        </FormProvider>
      )}

      {selected && (
        <>
          {states.length > 0 && (
            <Box sx={{ overflow: "auto", mb: 2 }}>
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
                      ? "var(--mui-palette-success-light)"
                      : category === "in_progress"
                        ? "var(--mui-palette-primary-light)"
                        : "var(--mui-palette-action-hover)";
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
            </Box>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            States
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {states.map((s) => (
              <Chip
                key={s.id}
                label={s.name || s.id}
                size="small"
                variant="outlined"
                color={s.category === "completed" ? "success" : s.category === "in_progress" ? "primary" : "default"}
              />
            ))}
          </Box>

          {editable && states.length >= 2 && (
            <FormProvider {...form}>
              <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                <Box sx={{ minWidth: 140 }}>
                  <RhfSelect<WorkflowFormValues>
                    name="addFrom"
                    control={control}
                    label="From"
                    options={states.map((s) => ({ value: s.id, label: s.name || s.id }))}
                    selectProps={{ size: "small" }}
                  />
                </Box>
                <ArrowForward sx={{ color: "action.active" }} />
                <Box sx={{ minWidth: 140 }}>
                  <RhfSelect<WorkflowFormValues>
                    name="addTo"
                    control={control}
                    label="To"
                    options={states.map((s) => ({ value: s.id, label: s.name || s.id }))}
                    selectProps={{ size: "small" }}
                  />
                </Box>
                <Button size="small" startIcon={<Add />} onClick={handleAddTransition} disabled={!addFrom || !addTo}>
                  Add transition
                </Button>
                {hasDraft && onSaveWorkflow && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveToManifest}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving…" : "Save to manifest"}
                  </Button>
                )}
              </Box>
            </FormProvider>
          )}

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Transitions
          </Typography>
          {transitions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No transitions defined.
            </Typography>
          ) : (
            <List dense disablePadding>
              {transitions.map((t, i) => {
                const fromName = stateMap.get(t.from)?.name ?? t.from;
                const toName = stateMap.get(t.to)?.name ?? t.to;
                const isDraft = i >= baseTransitions.length;
                return (
                  <ListItem
                    key={`${t.from}-${t.to}-${i}`}
                    disablePadding
                    sx={{ py: 0.25 }}
                    secondaryAction={
                      isDraft && editable ? (
                        <IconButton
                          size="small"
                          aria-label="Remove transition"
                          onClick={() => removeDraftTransition(i)}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      ) : null
                    }
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Chip label={fromName} size="small" variant="outlined" sx={{ fontWeight: 500 }} />
                          <ArrowForward fontSize="small" color="action" />
                          <Chip label={toName} size="small" variant="outlined" sx={{ fontWeight: 500 }} />
                          {isDraft && (
                            <Chip label="new" size="small" color="primary" sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </>
      )}
    </Paper>
  );
}
