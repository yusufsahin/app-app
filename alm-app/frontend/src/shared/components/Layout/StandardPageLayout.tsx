import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

/**
 * Standard page structure (adapted from pamera-ui StandardPageLayout).
 * Use for consistent: breadcrumbs strip, title + description + actions row, optional filter bar, content, optional pagination.
 */
export interface StandardPageLayoutProps {
  /** Breadcrumb element at the top (e.g. ProjectBreadcrumbs or custom) */
  breadcrumbs?: ReactNode;
  /** Page title (string or custom element). Rendered as semantic h1 when string. */
  title?: ReactNode;
  /** Description below the title (string or element). Muted text when string. */
  description?: ReactNode;
  /** Action buttons/controls to the right of the title */
  actions?: ReactNode;
  /** Optional filter bar between header and content */
  filterBar?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Optional pagination below content */
  pagination?: ReactNode;
  /** When true, content has no horizontal padding (full-bleed) */
  fullWidth?: boolean;
  /** Extra class/sx for root */
  sx?: object;
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
  sx,
}: StandardPageLayoutProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", ...sx }}>
      {breadcrumbs && (
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "action.hover",
            px: { xs: 2, sm: 3 },
            py: 1.5,
          }}
        >
          {breadcrumbs}
        </Box>
      )}

      {(title != null || actions) && (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { sm: "flex-start" },
            justifyContent: { sm: "space-between" },
            gap: 2,
            px: { xs: 2, sm: 3 },
            py: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title != null &&
              (typeof title === "string" ? (
                <Typography component="h1" variant="h4" sx={{ fontWeight: 600 }}>
                  {title}
                </Typography>
              ) : (
                title
              ))}
            {description != null &&
              (typeof description === "string" ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {description}
                </Typography>
              ) : (
                <Box sx={{ mt: 0.5 }}>{description}</Box>
              ))}
          </Box>
          {actions && (
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, flexShrink: 0 }}>
              {actions}
            </Box>
          )}
        </Box>
      )}

      {filterBar && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: { xs: 2, sm: 3 }, pb: 2 }}>
          {filterBar}
        </Box>
      )}

      <Box sx={{ flex: 1, px: fullWidth ? 0 : { xs: 2, sm: 3 }, py: 2 }}>
        {children}
      </Box>

      {pagination && (
        <Box sx={{ borderTop: 1, borderColor: "divider", px: { xs: 2, sm: 3 }, py: 1.5 }}>
          {pagination}
        </Box>
      )}
    </Box>
  );
}
