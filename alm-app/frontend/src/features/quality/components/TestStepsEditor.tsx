import { useMemo, useState, useRef, useLayoutEffect, useEffect } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  CircleHelp,
  PhoneForwarded,
  ExternalLink,
} from "lucide-react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Badge,
} from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui/utils";
import type { TestPlanEntry, TestPlanStepCall, TestStep } from "../types";
import { isTestPlanCall } from "../types";
import { useAllQualityTestCases } from "../../../shared/api/artifactApi";
import { useTranslation } from "react-i18next";

export interface TestCasePickerContext {
  orgSlug: string;
  projectId: string;
  excludeArtifactId?: string;
}

interface TestStepsEditorProps {
  steps: TestPlanEntry[];
  onChange: (steps: TestPlanEntry[]) => void;
  readOnly?: boolean;
  testCasePickerContext?: TestCasePickerContext;
  onNavigateToTestCase?: (testCaseId: string) => void;
}

const textareaClassName = cn(
  "text-foreground placeholder:text-muted-foreground border-input box-border block min-h-[3.25rem] w-full min-w-[10rem] resize-none rounded-md border bg-background px-3 py-2 text-base leading-normal ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
);

const tableScrollFrameClass =
  "max-h-[min(520px,50vh)] max-w-full overflow-y-auto overflow-x-auto rounded-xl border border-border md:overflow-x-hidden";

const mdMedia = "(min-width: 768px)";

export function TestStepsEditor({
  steps = [],
  onChange,
  readOnly = false,
  testCasePickerContext,
  onNavigateToTestCase,
}: TestStepsEditorProps) {
  const { t } = useTranslation("quality");
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(mdMedia).matches : true,
  );
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [pickForRowId, setPickForRowId] = useState<string | null>(null);
  const pendingFocusStepIdRef = useRef<string | null>(null);
  const stepIdSeqRef = useRef(0);
  const allocStepId = (kind: "step" | "call") => {
    stepIdSeqRef.current += 1;
    return `${kind}-${stepIdSeqRef.current}`;
  };

  const { data: testCasesList } = useAllQualityTestCases(
    testCasePickerContext?.orgSlug,
    testCasePickerContext?.projectId,
  );

  const pickerOptions = useMemo(() => {
    const items = testCasesList?.items ?? [];
    const ex = testCasePickerContext?.excludeArtifactId;
    return items.filter((a) => a.id !== ex);
  }, [testCasesList?.items, testCasePickerContext?.excludeArtifactId]);

  useEffect(() => {
    const mq = window.matchMedia(mdMedia);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const fieldDefs = useMemo(
    (): { key: keyof Pick<TestStep, "name" | "description" | "expectedResult">; label: string; placeholder: string }[] => [
      { key: "name", label: t("steps.fields.name"), placeholder: t("steps.placeholders.name") },
      { key: "description", label: t("steps.fields.description"), placeholder: t("steps.placeholders.description") },
      {
        key: "expectedResult",
        label: t("steps.fields.expectedResult"),
        placeholder: t("steps.placeholders.expectedResult"),
      },
    ],
    [t],
  );

  const addStep = () => {
    const newId = allocStepId("step");
    const newStep: TestStep = {
      id: newId,
      stepNumber: steps.length + 1,
      name: "",
      description: "",
      expectedResult: "",
      status: "not-executed",
    };
    pendingFocusStepIdRef.current = newId;
    onChange([...steps, newStep]);
  };

  const addCall = () => {
    const newId = allocStepId("call");
    onChange([
      ...steps,
      {
        kind: "call",
        id: newId,
        stepNumber: steps.length + 1,
        calledTestCaseId: "",
        calledTitle: undefined,
      },
    ]);
  };

  useLayoutEffect(() => {
    const id = pendingFocusStepIdRef.current;
    if (!id || readOnly) return;
    pendingFocusStepIdRef.current = null;
    const row = document.querySelector(`[data-step-id="${id}"]`);
    const ta = row?.querySelector("textarea");
    (ta as HTMLTextAreaElement | undefined)?.focus();
  }, [steps, readOnly]);

  const updateStep = (stepId: string, field: "name" | "description" | "expectedResult", value: string) => {
    onChange(
      steps.map((entry) =>
        !isTestPlanCall(entry) && entry.id === stepId ? { ...entry, [field]: value } : entry,
      ),
    );
  };

  const setCallTarget = (rowId: string, testCaseId: string, title: string) => {
    onChange(
      steps.map((entry) =>
        isTestPlanCall(entry) && entry.id === rowId
          ? { ...entry, calledTestCaseId: testCaseId, calledTitle: title }
          : entry,
      ),
    );
    setPickForRowId(null);
  };

  const applyCallParamOverridesFromJson = (rowId: string, raw: string) => {
    const trimmed = raw.trim();
    onChange(
      steps.map((entry) => {
        if (!isTestPlanCall(entry) || entry.id !== rowId) return entry;
        if (!trimmed) {
          const next = { ...entry };
          delete next.paramOverrides;
          return next;
        }
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return entry;
          const m: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (v === undefined) continue;
            m[String(k)] = typeof v === "string" ? v : String(v);
          }
          const next = { ...entry };
          if (Object.keys(m).length === 0) delete next.paramOverrides;
          else next.paramOverrides = m;
          return next;
        } catch {
          return entry;
        }
      }),
    );
  };

  const renderCallParamOverridesField = (call: TestPlanStepCall) => (
    <div className="mt-2 space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("steps.callParamOverrides")}
      </span>
      <textarea
        key={`po-${call.id}-${call.paramOverrides ? JSON.stringify(call.paramOverrides) : "0"}`}
        defaultValue={
          call.paramOverrides && Object.keys(call.paramOverrides).length > 0
            ? JSON.stringify(call.paramOverrides)
            : ""
        }
        onBlur={(e) => applyCallParamOverridesFromJson(call.id, e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
        rows={2}
        placeholder={t("steps.callParamOverridesPlaceholder")}
        className="box-border w-full max-w-md resize-y rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid={`quality-call-param-overrides-${call.id}`}
      />
    </div>
  );

  const removeStep = (stepId: string) => {
    const filtered = steps.filter((step) => {
      const id = isTestPlanCall(step) ? step.id : step.id;
      return id !== stepId;
    });
    onChange(
      filtered.map((step, index) => ({
        ...step,
        stepNumber: index + 1,
      })),
    );
  };

  const moveStep = (stepId: string, direction: "up" | "down") => {
    const index = steps.findIndex((s) => (isTestPlanCall(s) ? s.id : s.id) === stepId);
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
    onChange(
      newSteps.map((step, idx) => ({
        ...step,
        stepNumber: idx + 1,
      })),
    );
  };

  const moveStepToIndex = (stepId: string, toIndex: number) => {
    const fromIndex = steps.findIndex((s) => (isTestPlanCall(s) ? s.id : s.id) === stepId);
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

  const applyTsvPaste = (stepId: string, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const raw = e.clipboardData.getData("text/plain");
    if (!raw.includes("\t")) return;
    e.preventDefault();
    const lines = raw.replace(/\r\n/g, "\n").split("\n").filter((line) => line.length > 0);
    const index = steps.findIndex((s) => !isTestPlanCall(s) && s.id === stepId);
    if (index < 0) return;
    let next: TestPlanEntry[] = [...steps];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i]!.split("\t");
      const name = (parts[0] ?? "").replace(/\r$/, "");
      const description = (parts[1] ?? "").replace(/\r$/, "");
      const expectedResult = (parts[2] ?? "").replace(/\r$/, "");
      const targetIndex = index + i;
      const target = next[targetIndex];
      if (target && !isTestPlanCall(target)) {
        const sid = target.id;
        next = next.map((s) =>
          !isTestPlanCall(s) && s.id === sid ? { ...s, name, description, expectedResult } : s,
        );
      } else if (targetIndex >= next.length) {
        const newId = `${allocStepId("step")}-paste-${i}`;
        next.push({
          id: newId,
          stepNumber: next.length + 1,
          name,
          description,
          expectedResult,
          status: "not-executed",
        });
      }
    }
    onChange(
      next.map((s, idx) => ({
        ...s,
        stepNumber: idx + 1,
      })),
    );
  };

  const stepTextAreaKeyDown = (stepId: string, rowIndex: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || !e.altKey) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) moveStep(stepId, "up");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < steps.length - 1) moveStep(stepId, "down");
    }
  };

  const renderGrip = (entry: TestPlanEntry) => {
    const id = isTestPlanCall(entry) ? entry.id : entry.id;
    return !readOnly ? (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          setDraggedStepId(id);
        }}
        onDragEnd={() => setDraggedStepId(null)}
        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 shrink-0" aria-hidden />
      </div>
    ) : null;
  };

  const renderRowActions = (entry: TestPlanEntry, index: number) => {
    const id = isTestPlanCall(entry) ? entry.id : entry.id;
    return !readOnly ? (
      <div className="flex items-start justify-end gap-0.5 pt-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => moveStep(id, "up")}
          disabled={index === 0}
          data-testid={`quality-step-move-up-${id}`}
          aria-label={t("steps.moveUp")}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => moveStep(id, "down")}
          disabled={index === steps.length - 1}
          data-testid={`quality-step-move-down-${id}`}
          aria-label={t("steps.moveDown")}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => removeStep(id)}
          data-testid={`quality-step-delete-${id}`}
          aria-label={t("common.delete")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    ) : null;
  };

  const renderFieldTextarea = (step: TestStep, index: number, fd: (typeof fieldDefs)[number]) => (
    <textarea
      rows={2}
      aria-label={`${fd.label} ${step.stepNumber}`}
      placeholder={fd.placeholder}
      value={step[fd.key]}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateStep(step.id, fd.key, e.target.value)}
      onPaste={(e) => applyTsvPaste(step.id, e)}
      onKeyDown={(e) => stepTextAreaKeyDown(step.id, index, e)}
      className={cn(textareaClassName, "focus-visible:ring-1 focus-visible:ring-primary/30")}
      readOnly={readOnly}
    />
  );

  const renderCallRowWide = (call: TestPlanStepCall, index: number) => {
    const missingPicker = !testCasePickerContext;
    const broken = !call.calledTestCaseId.trim();
    return (
      <tr
        key={call.id}
        data-testid={`quality-step-card-${call.id}`}
        data-step-id={call.id}
        onDragOver={(e) => {
          if (readOnly) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={() => {
          if (readOnly || !draggedStepId) return;
          moveStepToIndex(draggedStepId, index);
          setDraggedStepId(null);
        }}
        className={cn(
          "border-b border-border bg-muted/20 last:border-b-0",
          draggedStepId === call.id && "opacity-70",
          broken && !readOnly && "bg-amber-500/10 dark:bg-amber-500/15",
        )}
      >
        {!readOnly ? <td className="align-top p-1.5">{renderGrip(call)}</td> : null}
        <td className="align-top px-2 py-3">
          <div className="flex size-7 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-foreground">
            {call.stepNumber}
          </div>
        </td>
        <td className="align-top px-2 py-3" colSpan={fieldDefs.length}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 font-normal">
                <PhoneForwarded className="size-3" aria-hidden />
                {t("steps.callStep")}
              </Badge>
              {broken ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">{t("steps.callMissingTarget")}</span>
              ) : (
                <span className="text-sm font-medium text-foreground">
                  {call.calledTitle || call.calledTestCaseId.slice(0, 8) + "…"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!readOnly && testCasePickerContext ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  data-testid={`quality-call-pick-${call.id}`}
                  onClick={() => setPickForRowId(call.id)}
                >
                  {t("steps.pickTestCase")}
                </Button>
              ) : null}
              {!readOnly && missingPicker ? (
                <p className="text-xs text-muted-foreground">{t("steps.callPickerUnavailable")}</p>
              ) : null}
              {!broken && onNavigateToTestCase ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  data-testid={`quality-call-open-${call.id}`}
                  onClick={() => onNavigateToTestCase(call.calledTestCaseId)}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  {t("steps.openCallee")}
                </Button>
              ) : null}
              {!readOnly || (call.paramOverrides && Object.keys(call.paramOverrides).length > 0)
                ? renderCallParamOverridesField(call)
                : null}
            </div>
          </div>
        </td>
        {!readOnly ? <td className="w-28 min-w-28 align-top px-1 py-3">{renderRowActions(call, index)}</td> : null}
      </tr>
    );
  };

  const renderCallCardMobile = (call: TestPlanStepCall, index: number) => {
    const missingPicker = !testCasePickerContext;
    const broken = !call.calledTestCaseId.trim();
    return (
      <div
        key={call.id}
        data-testid={`quality-step-card-${call.id}`}
        data-step-id={call.id}
        onDragOver={(e) => {
          if (readOnly) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={() => {
          if (readOnly || !draggedStepId) return;
          moveStepToIndex(draggedStepId, index);
          setDraggedStepId(null);
        }}
        className={cn(
          "rounded-lg border border-border bg-card/50 p-3 shadow-sm",
          draggedStepId === call.id && "opacity-70",
          broken && !readOnly && "bg-amber-500/10 dark:bg-amber-500/15",
        )}
      >
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
          {!readOnly ? renderGrip(call) : null}
          <div className="flex size-8 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold">
            {call.stepNumber}
          </div>
          <Badge variant="outline" className="ml-1 gap-1 text-[10px]">
            <PhoneForwarded className="size-3" aria-hidden />
            {t("steps.callStep")}
          </Badge>
          <div className="min-w-0 flex-1" />
          {!readOnly ? renderRowActions(call, index) : null}
        </div>
        <div className="space-y-2 text-sm">
          {broken ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">{t("steps.callMissingTarget")}</p>
          ) : (
            <p className="font-medium">{call.calledTitle || call.calledTestCaseId}</p>
          )}
          {!readOnly && testCasePickerContext ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setPickForRowId(call.id)}>
              {t("steps.pickTestCase")}
            </Button>
          ) : null}
          {!readOnly && missingPicker ? (
            <p className="text-xs text-muted-foreground">{t("steps.callPickerUnavailable")}</p>
          ) : null}
          {!broken && onNavigateToTestCase ? (
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => onNavigateToTestCase(call.calledTestCaseId)}>
              <ExternalLink className="size-3.5" aria-hidden />
              {t("steps.openCallee")}
            </Button>
          ) : null}
          {!readOnly || (call.paramOverrides && Object.keys(call.paramOverrides).length > 0)
            ? renderCallParamOverridesField(call)
            : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Dialog open={pickForRowId !== null} onOpenChange={(o) => !o && setPickForRowId(null)}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t("steps.pickTestCaseTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("steps.pickTestCaseTitle")}</DialogDescription>
          </DialogHeader>
          <Command className="rounded-lg border border-border">
            <CommandInput placeholder={t("steps.pickTestCaseSearch")} />
            <CommandList className="max-h-64">
              <CommandEmpty>{t("steps.pickTestCaseEmpty")}</CommandEmpty>
              <CommandGroup heading={t("steps.title")}>
                {pickerOptions.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.title ?? ""} ${a.id}`}
                    onSelect={() => pickForRowId && setCallTarget(pickForRowId, a.id, a.title ?? a.id)}
                  >
                    <span className="truncate">{a.title ?? a.id}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <label className="text-sm font-medium text-foreground">
            {t("steps.title")}{" "}
            {steps.length > 0 && <span className="text-muted-foreground">({steps.length})</span>}
          </label>
          {!readOnly ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground shrink-0 rounded-sm p-0.5 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("steps.hintTooltipAria")}
                >
                  <CircleHelp className="size-4" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-sm text-left text-xs leading-relaxed">
                {t("steps.tableHint")}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {!readOnly && (
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="button"
              onClick={addStep}
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              data-testid="step-add-button"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("steps.add")}
            </Button>
            <Button
              type="button"
              onClick={addCall}
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              data-testid="step-add-call-button"
            >
              <PhoneForwarded className="h-3.5 w-3.5" />
              {t("steps.addCall")}
            </Button>
          </div>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 py-8 text-center">
          <p className="px-4 text-sm text-muted-foreground">{t("steps.empty")}</p>
        </div>
      ) : wide ? (
        <div className={tableScrollFrameClass}>
          <table className="w-full min-w-[640px] border-collapse text-base">
            <caption className="sr-only">{t("steps.title")}</caption>
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-border bg-muted/95 text-sm font-medium text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                {!readOnly ? (
                  <th scope="col" className="w-10 p-2">
                    <span className="sr-only">{t("steps.dragHint")}</span>
                  </th>
                ) : null}
                <th scope="col" className="w-12 px-2 py-3 text-center font-medium text-foreground">
                  #
                </th>
                {fieldDefs.map((fd) => (
                  <th
                    key={fd.key}
                    scope="col"
                    className="min-w-[12rem] px-2 py-3 text-left font-medium text-foreground"
                  >
                    {fd.label}
                  </th>
                ))}
                {!readOnly ? (
                  <th scope="col" className="w-28 shrink-0 px-1 py-3">
                    <span className="sr-only">{t("steps.rowActions")}</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {steps.map((entry, index) => {
                if (isTestPlanCall(entry)) {
                  return renderCallRowWide(entry, index);
                }
                const step = entry;
                const isEmpty = !step.name && !step.expectedResult;
                return (
                  <tr
                    key={step.id}
                    data-testid={`quality-step-card-${step.id}`}
                    data-step-id={step.id}
                    onDragOver={(e) => {
                      if (readOnly) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={() => {
                      if (readOnly || !draggedStepId) return;
                      moveStepToIndex(draggedStepId, index);
                      setDraggedStepId(null);
                    }}
                    className={cn(
                      "border-b border-border last:border-b-0",
                      draggedStepId === step.id && "opacity-70",
                      isEmpty && !readOnly && "bg-amber-500/10 dark:bg-amber-500/15",
                    )}
                  >
                    {!readOnly ? <td className="align-top p-1.5">{renderGrip(step)}</td> : null}
                    <td className="align-top px-2 py-3">
                      <div className="flex size-7 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-foreground">
                        {step.stepNumber}
                      </div>
                    </td>
                    {fieldDefs.map((fd) => (
                      <td key={fd.key} className="min-w-[12rem] align-top px-2 py-3">
                        {renderFieldTextarea(step, index, fd)}
                      </td>
                    ))}
                    {!readOnly ? (
                      <td className="w-28 min-w-28 align-top px-1 py-3">{renderRowActions(step, index)}</td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="max-h-[min(520px,50vh)] space-y-3 overflow-y-auto rounded-xl border border-border p-2">
            {steps.map((entry, index) => {
              if (isTestPlanCall(entry)) {
                return renderCallCardMobile(entry, index);
              }
              const step = entry;
              const isEmpty = !step.name && !step.expectedResult;
              return (
                <div
                  key={step.id}
                  data-testid={`quality-step-card-${step.id}`}
                  data-step-id={step.id}
                  onDragOver={(e) => {
                    if (readOnly) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={() => {
                    if (readOnly || !draggedStepId) return;
                    moveStepToIndex(draggedStepId, index);
                    setDraggedStepId(null);
                  }}
                  className={cn(
                    "rounded-lg border border-border bg-card/50 p-3 shadow-sm",
                    draggedStepId === step.id && "opacity-70",
                    isEmpty && !readOnly && "bg-amber-500/10 dark:bg-amber-500/15",
                  )}
                >
                  <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                    {!readOnly ? renderGrip(step) : null}
                    <div className="flex size-8 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold">
                      {step.stepNumber}
                    </div>
                    <div className="min-w-0 flex-1" />
                    {!readOnly ? renderRowActions(step, index) : null}
                  </div>
                  <div className="space-y-3">
                    {fieldDefs.map((fd) => (
                      <div key={fd.key} className="space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {fd.label}
                        </span>
                        {renderFieldTextarea(step, index, fd)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {!readOnly ? <p className="text-xs text-muted-foreground">{t("steps.mobileHint")}</p> : null}
        </>
      )}
    </div>
  );
}
