/**
 * List/board/tree view and bulk actions for Artifacts page.
 * Renders the main content area (bulk bar, table, board, or tree, pagination).
 */
import { Box } from "@mui/material";

export interface ArtifactsListProps {
  children: React.ReactNode;
}

export function ArtifactsList({ children }: ArtifactsListProps) {
  return <Box>{children}</Box>;
}
