import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  MessageSquare,
  Copy,
  Bug,
  FileImage,
  Link2,
  Paperclip,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Label,
} from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui/utils";
import type { TestStep, StepResult } from "../types";
import { useTranslation } from "react-i18next";

function textareaClasses(compact: boolean) {
  return cn(
    "placeholder:text-muted-foreground border-input flex w-full rounded-md border bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    compact ? "min-h-[44px]" : "min-h-[60px]",
  );
}

interface ExecutionStepListProps {
  steps: TestStep[];
  results: StepResult[];
  onUpdateStep: (
    stepId: string,
    status: StepResult["status"],
    actualResult?: string,
    notes?: string
  ) => void;
  onCopyBugReport?: (step: TestStep, result: StepResult) => void;
  onOpenCreateDefect?: (step: TestStep, result: StepResult) => void;
  onPassAllSteps?: () => void;
  readOnly?: boolean;
  /** Narrow padding and fields for pop-out / side-by-side layout. */
  layoutCompact?: boolean;
}

export function ExecutionStepList({
  steps,
  results,
  onUpdateStep,
  onCopyBugReport,
  onOpenCreateDefect,
  onPassAllSteps,
  readOnly = false,
  layoutCompact = false,
}: ExecutionStepListProps) {
  const { t } = useTranslation("quality");
  const getStepResult = (stepId: string) =>
    results.find((r) => r.stepId === stepId);

  return (
    <div className={cn("space-y-4", layoutCompact && "space-y-2")}>
      {!readOnly && onPassAllSteps && steps.length > 0 && (
        <div
          className={cn(
            "flex justify-end border-b border-slate-100 bg-slate-50/30 py-2",
            layoutCompact ? "px-2" : "px-4",
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onPassAllSteps}
            className="min-h-9 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          >
            {t("execution.markAllPassed")}
          </Button>
        </div>
      )}
      <div className={cn("space-y-4", layoutCompact ? "space-y-2 p-2" : "space-y-4 p-4")}>
      {steps.map((step) => {
        const result = getStepResult(step.id);
        const status = result?.status || "not-executed";

        return (
          <Card
            key={step.id}
            id={`execution-step-${step.id}`}
            className={cn(
              "group scroll-mt-20 overflow-hidden border-l-4 transition-all duration-200",
              status === "passed" && "border-l-green-500 bg-green-50/10",
              status === "failed" && "border-l-red-500 bg-red-50/10",
              status === "blocked" && "border-l-amber-500 bg-amber-50/10",
              status === "not-executed" && "border-l-slate-300 bg-slate-50/30"
            )}
          >
            <CardHeader className={cn(layoutCompact ? "p-3 pb-2" : "p-4 pb-2")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2 md:gap-3">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                      status === "passed" && "bg-green-100 text-green-700",
                      status === "failed" && "bg-red-100 text-red-700",
                      status === "blocked" && "bg-amber-100 text-amber-700",
                      status === "not-executed" && "bg-slate-100 text-slate-500"
                    )}
                  >
                    {step.stepNumber}
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    {step.name}
                  </CardTitle>
                </div>
                {!readOnly && ((result?.linkedDefectIds?.length ?? 0) > 0 || (result?.attachmentIds?.length ?? 0) > 0) ? (
                  <div className="flex flex-1 flex-wrap justify-end gap-1">
                    {(result?.linkedDefectIds?.length ?? 0) > 0 ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Link2 className="size-3" />
                        {t("execution.defect.linkedCount", { count: result?.linkedDefectIds?.length ?? 0 })}
                      </Badge>
                    ) : null}
                    {(result?.attachmentIds?.length ?? 0) > 0 ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <FileImage className="size-3" />
                        {t("execution.defect.evidenceCount", { count: result?.attachmentIds?.length ?? 0 })}
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                {!readOnly && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant={status === "passed" ? "default" : "outline"}
                      className={cn(
                        "min-h-9 px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                        status === "passed"
                          ? "bg-green-600 hover:bg-green-700"
                          : "text-slate-500"
                      )}
                      onClick={() => onUpdateStep(step.id, "passed")}
                    >
                      <CheckCircle2 className="mr-1 size-3" />
                      Pass
                    </Button>
                    <Button
                      size="sm"
                      variant={status === "failed" ? "destructive" : "outline"}
                      className={cn(
                        "min-h-9 px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                        status === "failed" ? "" : "text-slate-500"
                      )}
                      onClick={() => onUpdateStep(step.id, "failed")}
                    >
                      <XCircle className="mr-1 size-3" />
                      Fail
                    </Button>
                    <Button
                      size="sm"
                      variant={status === "blocked" ? "default" : "outline"}
                      className={cn(
                        "min-h-9 px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                        status === "blocked"
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "text-slate-500"
                      )}
                      onClick={() => onUpdateStep(step.id, "blocked")}
                    >
                      <AlertCircle className="mr-1 size-3" />
                      Block
                    </Button>
                  </div>
                )}
                {readOnly && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      status === "passed" && "border-green-200 bg-green-50 text-green-700",
                      status === "failed" && "border-red-200 bg-red-50 text-red-700",
                      status === "blocked" && "border-amber-200 bg-amber-50 text-amber-700",
                      status === "not-executed" && "text-slate-500"
                    )}
                  >
                    {status.replace("-", " ")}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className={cn(layoutCompact ? "p-3 pt-2" : "p-4 pt-2")}>
              <div className="mb-3 space-y-1">
                {step.description ? (
                  <p className="text-xs leading-relaxed text-slate-500">{step.description}</p>
                ) : null}
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t("steps.fields.expectedResult")}
                </span>
                <p className="text-xs leading-relaxed text-slate-600 font-medium">
                  {step.expectedResult}
                </p>
              </div>

              {!readOnly && (
                <div
                  className={cn(
                    "mt-4 grid grid-cols-1 md:grid-cols-2",
                    layoutCompact ? "gap-2" : "gap-4",
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Edit3 className="size-3" />
                        {t("execution.actualResult")}
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-slate-400 hover:text-slate-600"
                        onClick={() =>
                          onUpdateStep(step.id, status, step.expectedResult)
                        }
                      >
                        {t("execution.copyExpected")}
                      </Button>
                    </div>
                    <textarea
                      placeholder={t("execution.placeholders.actualResult")}
                      className={cn(
                        textareaClasses(layoutCompact),
                        "resize-none border-slate-200 bg-white/50 focus:bg-white",
                      )}
                      value={result?.actualResult || ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        onUpdateStep(step.id, status, e.target.value, result?.notes)
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <MessageSquare className="size-3" />
                      {t("execution.notes")}
                    </Label>
                    <textarea
                      placeholder={t("execution.placeholders.notes")}
                      className={cn(
                        textareaClasses(layoutCompact),
                        "resize-none border-slate-200 bg-white/50 focus:bg-white",
                      )}
                      value={result?.notes || ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        onUpdateStep(
                          step.id,
                          status,
                          result?.actualResult,
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              )}

              {readOnly && (result?.actualResult || result?.notes) && (
                <div className="mt-4 space-y-3 rounded-lg bg-slate-100/50 p-3">
                  {result.actualResult && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        {t("execution.actualResult")}
                      </span>
                      <p className="text-xs text-slate-600">
                        {result.actualResult}
                      </p>
                    </div>
                  )}
                  {result.notes && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        {t("execution.notes")}
                      </span>
                      <p className="text-xs text-slate-600 font-medium italic">
                        {result.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {readOnly && ((result?.linkedDefectIds?.length ?? 0) > 0 || (result?.attachmentNames?.length ?? 0) > 0) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(result?.linkedDefectIds?.length ?? 0) > 0 ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Bug className="size-3" />
                      {t("execution.defect.linkedCount", { count: result?.linkedDefectIds?.length ?? 0 })}
                    </Badge>
                  ) : null}
                  {(result?.attachmentNames?.length ?? 0) > 0 ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Paperclip className="size-3" />
                      {t("execution.defect.evidenceCount", { count: result?.attachmentNames?.length ?? 0 })}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              {!readOnly && (status === "failed" || status === "blocked") && (onCopyBugReport || onOpenCreateDefect) && (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {onCopyBugReport ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-9 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => onCopyBugReport(step, result!)}
                    >
                      <Copy className="size-3" />
                      {t("execution.copyBugReport")}
                    </Button>
                  ) : null}
                  {onOpenCreateDefect ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-9 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-700 hover:bg-red-50"
                      onClick={() => onOpenCreateDefect(step, result!)}
                    >
                      <Bug className="size-3" />
                      {t("execution.createDefect")}
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
}
