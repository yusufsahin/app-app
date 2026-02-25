import { Box, CircularProgress, Typography } from "@mui/material";

export interface LoadingStateProps {
  /** Accessible label for screen readers */
  label?: string;
  /** Minimum height so layout doesn't jump */
  minHeight?: number;
}

/**
 * Centered full-area loading with spinner and optional label (pamera-ui pattern, MUI).
 * Use for list/content loading instead of ad-hoc skeletons where a single block is preferred.
 */
export function LoadingState({ label = "Loading…", minHeight = 120 }: LoadingStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        py: 6,
        minHeight,
      }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <CircularProgress size={32} aria-hidden />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
