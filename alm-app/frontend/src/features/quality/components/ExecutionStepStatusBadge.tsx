import { useTranslation } from "react-i18next";
import { Badge } from "../../../shared/components/ui/badge";

export type StepRunStatus = "passed" | "failed" | "blocked" | "not-executed" | null | undefined;

function statusVariant(
  status: NonNullable<StepRunStatus>,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "passed") return "default";
  if (status === "failed") return "destructive";
  if (status === "blocked") return "secondary";
  return "outline";
}

/** Compact badge for a single step’s last saved run status (suite plan / step list). */
export function ExecutionStepStatusBadge({ status }: { status: StepRunStatus }) {
  const { t } = useTranslation("quality");
  if (status == null) {
    return <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">—</span>;
  }
  const labelKey =
    status === "passed"
      ? "execution.lastExecution.passed"
      : status === "failed"
        ? "execution.lastExecution.failed"
        : status === "blocked"
          ? "execution.lastExecution.blocked"
          : "execution.lastExecution.notExecuted";

  return (
    <Badge
      variant={statusVariant(status)}
      className="h-5 shrink-0 px-1.5 text-[9px] font-semibold uppercase leading-none"
    >
      {t(labelKey)}
    </Badge>
  );
}
