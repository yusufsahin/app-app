import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  MessageSquare,
  Copy,
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

const textareaClassName = cn(
  "placeholder:text-muted-foreground border-input flex min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
);

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
  onPassAllSteps?: () => void;
  readOnly?: boolean;
}

export function ExecutionStepList({
  steps,
  results,
  onUpdateStep,
  onCopyBugReport,
  onPassAllSteps,
  readOnly = false,
}: ExecutionStepListProps) {
  const getStepResult = (stepId: string) =>
    results.find((r) => r.stepId === stepId);

  return (
    <div className="space-y-4">
      {!readOnly && onPassAllSteps && steps.length > 0 && (
          <div className="flex justify-end px-4 py-2 border-b border-slate-100 bg-slate-50/30">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onPassAllSteps}
                className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                  Mark All Passed
              </Button>
          </div>
      )}
      <div className="p-4 space-y-4">
      {steps.map((step) => {
        const result = getStepResult(step.id);
        const status = result?.status || "not-executed";

        return (
          <Card
            key={step.id}
            className={cn(
              "group overflow-hidden border-l-4 transition-all duration-200",
              status === "passed" && "border-l-green-500 bg-green-50/10",
              status === "failed" && "border-l-red-500 bg-red-50/10",
              status === "blocked" && "border-l-amber-500 bg-amber-50/10",
              status === "not-executed" && "border-l-slate-300 bg-slate-50/30"
            )}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
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
                    {step.action}
                  </CardTitle>
                </div>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={status === "passed" ? "default" : "outline"}
                      className={cn(
                        "h-7 px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
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
                        "h-7 px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
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
                        "h-7 px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
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

            <CardContent className="p-4 pt-2">
              <div className="mb-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Expected Result
                </span>
                <p className="text-xs leading-relaxed text-slate-600 font-medium">
                  {step.expectedResult}
                </p>
              </div>

              {!readOnly && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Edit3 className="size-3" />
                        Actual Result
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-slate-400 hover:text-slate-600"
                        onClick={() =>
                          onUpdateStep(step.id, status, step.expectedResult)
                        }
                      >
                        Copy Expected
                      </Button>
                    </div>
                    <textarea
                      placeholder="What actually happened?"
                      className={cn(textareaClassName, "border-slate-200 bg-white/50 focus:bg-white resize-none")}
                      value={result?.actualResult || ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        onUpdateStep(step.id, status, e.target.value, result?.notes)
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <MessageSquare className="size-3" />
                      Notes / Observations
                    </Label>
                    <textarea
                      placeholder="Any bugs or context..."
                      className={cn(textareaClassName, "border-slate-200 bg-white/50 focus:bg-white resize-none")}
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
                        Actual Result
                      </span>
                      <p className="text-xs text-slate-600">
                        {result.actualResult}
                      </p>
                    </div>
                  )}
                  {result.notes && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Notes
                      </span>
                      <p className="text-xs text-slate-600 font-medium italic">
                        {result.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!readOnly && status === "failed" && onCopyBugReport && (
                <div className="mt-4 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => onCopyBugReport(step, result!)}
                  >
                    <Copy className="size-3" />
                    Copy Bug Report
                  </Button>
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
