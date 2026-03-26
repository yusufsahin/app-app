import type { ReactNode } from "react";
import { Button } from "./ui";
import { cn } from "./ui/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  bordered?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Empty state block. Use when a list or section has no items.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  bordered = false,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-12",
        bordered && "rounded-lg border border-border bg-muted/30",
        className,
      )}
    >
      {icon && (
        <div className={cn("text-muted-foreground opacity-70", compact ? "mb-3" : "mb-4")}>
          <span className={cn("inline-flex", compact ? "size-10" : "size-12")}>{icon}</span>
        </div>
      )}
      <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>{title}</h3>
      {description && (
        <p className="mx-auto mt-1 max-w-[360px] text-sm text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button size={compact ? "sm" : "default"} onClick={onAction} className={compact ? "mt-4" : "mt-6"}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
