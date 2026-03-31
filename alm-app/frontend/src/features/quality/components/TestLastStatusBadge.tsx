import { useTranslation } from "react-i18next";
import type { LastExecutionStatusItem } from "../../../shared/api/qualityLastExecutionApi";
import { Badge } from "../../../shared/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../shared/components/ui/tooltip";
import { formatDateTime } from "../../../shared/utils/formatDateTime";

function statusVariant(
  status: LastExecutionStatusItem["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "passed") return "default";
  if (status === "failed") return "destructive";
  if (status === "blocked") return "secondary";
  return "outline";
}

export function TestLastStatusBadge({
  item,
  className,
}: {
  item: LastExecutionStatusItem | undefined;
  className?: string;
}) {
  const { t } = useTranslation("quality");
  if (!item?.status || !item.run_id) return null;

  const labelKey =
    item.status === "passed"
      ? "execution.lastExecution.passed"
      : item.status === "failed"
        ? "execution.lastExecution.failed"
        : item.status === "blocked"
          ? "execution.lastExecution.blocked"
          : "execution.lastExecution.notExecuted";

  const title = item.run_title?.trim() || t("execution.lastExecution.runFallback");
  const when = formatDateTime(item.run_updated_at);
  const tooltip = when
    ? t("execution.lastExecution.tooltipFromRun", { title, date: when })
    : title;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={statusVariant(item.status)} className={`shrink-0 text-[10px] uppercase ${className ?? ""}`}>
            {t(labelKey)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
