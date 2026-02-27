import type { ReactNode } from "react";
import { cn } from "../ui/utils";

/**
 * Standard page structure. Use for consistent: breadcrumbs strip, title + description + actions row, optional filter bar, content, optional pagination.
 */
export interface StandardPageLayoutProps {
  breadcrumbs?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  filterBar?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

export function StandardPageLayout({
  breadcrumbs,
  title,
  description,
  actions,
  filterBar,
  children,
  pagination,
  fullWidth = false,
  className,
}: StandardPageLayoutProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {breadcrumbs && (
        <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
          {breadcrumbs}
        </div>
      )}

      {(title != null || actions) && (
        <div className="flex flex-col gap-4 px-4 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="min-w-0">
            {title != null &&
              (typeof title === "string" ? (
                <h1 className="text-2xl font-bold">{title}</h1>
              ) : (
                title
              ))}
            {description != null &&
              (typeof description === "string" ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              ) : (
                <div className="mt-1">{description}</div>
              ))}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      {filterBar && (
        <div className="border-b border-border px-4 pb-4 sm:px-6">
          {filterBar}
        </div>
      )}

      <div className={cn("flex-1 py-4", fullWidth ? "px-0" : "px-4 sm:px-6")}>
        {children}
      </div>

      {pagination && (
        <div className="border-t border-border px-4 py-3 sm:px-6">
          {pagination}
        </div>
      )}
    </div>
  );
}
