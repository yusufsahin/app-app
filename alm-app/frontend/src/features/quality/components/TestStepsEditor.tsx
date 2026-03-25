import { useState } from "react";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui/utils";
import type { TestStep } from "../types";
import { useTranslation } from "react-i18next";

interface TestStepsEditorProps {
  steps: TestStep[];
  onChange: (steps: TestStep[]) => void;
  readOnly?: boolean;
}

const textareaClassName = cn(
  "placeholder:text-muted-foreground border-input flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
);

export function TestStepsEditor({ steps = [], onChange, readOnly = false }: TestStepsEditorProps) {
  const { t } = useTranslation("quality");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(
    new Set(steps.map((s) => s.id))
  );
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const addStep = () => {
    const newStep: TestStep = {
      id: `step-${Date.now()}`,
      stepNumber: steps.length + 1,
      name: "",
      description: "",
      expectedResult: "",
      status: "not-executed",
    };
    onChange([...steps, newStep]);
    setExpandedSteps(new Set([...expandedSteps, newStep.id]));
  };

  const updateStep = (stepId: string, field: "name" | "description" | "expectedResult", value: string) => {
    onChange(
      steps.map((step) =>
        step.id === stepId ? { ...step, [field]: value } : step
      )
    );
  };

  const removeStep = (stepId: string) => {
    const filtered = steps.filter((step) => step.id !== stepId);
    // Renumber steps
    const renumbered = filtered.map((step, index) => ({
      ...step,
      stepNumber: index + 1,
    }));
    onChange(renumbered);
  };

  const moveStep = (stepId: string, direction: "up" | "down") => {
    const index = steps.findIndex((s) => s.id === stepId);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === steps.length - 1)
    ) {
      return;
    }

    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const a = newSteps[index];
    const b = newSteps[targetIndex];
    if (a === undefined || b === undefined) return;
    newSteps[index] = b;
    newSteps[targetIndex] = a;

    // Renumber
    const renumbered = newSteps.map((step, idx) => ({
      ...step,
      stepNumber: idx + 1,
    }));
    onChange(renumbered);
  };

  const moveStepToIndex = (stepId: string, toIndex: number) => {
    const fromIndex = steps.findIndex((s) => s.id === stepId);
    if (fromIndex < 0 || fromIndex === toIndex || toIndex < 0 || toIndex >= steps.length) return;
    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    onChange(
      next.map((step, idx) => ({
        ...step,
        stepNumber: idx + 1,
      })),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">
          {t("steps.title")} {steps.length > 0 && <span className="text-slate-400 ml-1">({steps.length})</span>}
        </label>
        {!readOnly && (
          <Button type="button" onClick={addStep} size="sm" variant="outline" className="h-8 gap-1.5 text-xs" data-testid="step-add-button">
            <Plus className="h-3.5 w-3.5" />
            {t("steps.add")}
          </Button>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-xl bg-slate-50/50">
          <p className="text-sm text-slate-500">
            {t("steps.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const isEmpty = !step.name && !step.expectedResult;

            return (
              <div
                key={step.id}
                draggable={!readOnly}
                onDragStart={() => setDraggedStepId(step.id)}
                onDragOver={(e) => {
                  if (readOnly) return;
                  e.preventDefault();
                }}
                onDrop={() => {
                  if (readOnly || !draggedStepId) return;
                  moveStepToIndex(draggedStepId, index);
                  setDraggedStepId(null);
                }}
                onDragEnd={() => setDraggedStepId(null)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border transition-all duration-200",
                  draggedStepId === step.id && "opacity-70",
                  isExpanded ? "border-slate-200 bg-white shadow-sm" : "border-slate-100 bg-slate-50/30 hover:bg-slate-50",
                  isEmpty && !readOnly && "border-amber-100 bg-amber-50/30"
                )}
              >
                {/* Step Header: toggle is a button; toolbar stays outside to avoid nested interactive elements */}
                <div className="flex items-center gap-1 p-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => toggleStep(step.id)}
                  >
                    {!readOnly && (
                      <GripVertical className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-400" />
                    )}

                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-600">
                      {step.stepNumber}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "truncate text-sm font-medium transition-colors",
                          isExpanded ? "text-slate-800" : "text-slate-600",
                        )}
                      >
                        {step.name || (
                          <span className="font-normal italic text-slate-400">{t("steps.noName")}</span>
                        )}
                      </div>
                      {!readOnly ? (
                        <div className="text-[10px] text-slate-400">{t("steps.dragHint")}</div>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!readOnly && (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 h-7 w-7 text-slate-400 hover:text-slate-600"
                          onClick={() => moveStep(step.id, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 h-7 w-7 text-slate-400 hover:text-slate-600"
                          onClick={() => moveStep(step.id, "down")}
                          disabled={index === steps.length - 1}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 h-7 w-7 text-slate-400 hover:text-destructive"
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                    <div className="ml-1 text-slate-400" aria-hidden>
                      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </div>
                  </div>
                </div>

                {/* Step Details */}
                {isExpanded && (
                  <div className="p-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`ts-step-${step.id}-action`}
                          className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          {t("steps.fields.name")}
                        </label>
                        <textarea
                          id={`ts-step-${step.id}-action`}
                          placeholder={t("steps.placeholders.name")}
                          value={step.name}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            updateStep(step.id, "name", e.target.value)
                          }
                          className={cn(
                            textareaClassName,
                            "resize-none border-slate-200 bg-white focus:ring-1 focus:ring-primary/20",
                          )}
                          readOnly={readOnly}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor={`ts-step-${step.id}-description`}
                          className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          {t("steps.fields.description")}
                        </label>
                        <textarea
                          id={`ts-step-${step.id}-description`}
                          placeholder={t("steps.placeholders.description")}
                          value={step.description}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            updateStep(step.id, "description", e.target.value)
                          }
                          className={cn(
                            textareaClassName,
                            "resize-none border-slate-200 bg-white focus:ring-1 focus:ring-primary/20",
                          )}
                          readOnly={readOnly}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor={`ts-step-${step.id}-expected`}
                          className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          {t("steps.fields.expectedResult")}
                        </label>
                        <textarea
                          id={`ts-step-${step.id}-expected`}
                          placeholder={t("steps.placeholders.expectedResult")}
                          value={step.expectedResult}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            updateStep(step.id, "expectedResult", e.target.value)
                          }
                          className={cn(
                            textareaClassName,
                            "resize-none border-slate-200 bg-white focus:ring-1 focus:ring-primary/20",
                          )}
                          readOnly={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
