import { Box, Button, Typography } from "@mui/material";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Show inside a bordered card container */
  bordered?: boolean;
  /** Compact layout (less padding) for inline/tab use */
  compact?: boolean;
  sx?: object;
}

/**
 * Empty state block (pamera-ui pattern, MUI). Use when a list or section has no items.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  bordered = false,
  compact = false,
  sx,
}: EmptyStateProps) {
  const content = (
    <>
      {icon && (
        <Box
          sx={{
            color: "text.secondary",
            opacity: 0.7,
            mb: compact ? 1.5 : 2,
            "& > svg": { fontSize: compact ? 40 : 48 },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography component="h3" variant={compact ? "subtitle1" : "h6"} fontWeight={600} sx={{ mt: compact ? 1 : 2 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: "auto", mt: compact ? 0.5 : 1 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button size={compact ? "small" : "medium"} onClick={onAction} sx={{ mt: compact ? 2 : 3 }}>
          {actionLabel}
        </Button>
      )}
    </>
  );

  const wrapperSx = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    py: compact ? 4 : 6,
    ...(bordered && {
      borderRadius: 1,
      border: 1,
      borderColor: "divider",
      bgcolor: "action.hover",
    }),
    ...sx,
  };

  return <Box sx={wrapperSx}>{content}</Box>;
}
