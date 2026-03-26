/**
 * List/board/tree view and bulk actions for Artifacts page.
 * Renders the main content area (bulk bar, table, board, or tree, pagination).
 */
export interface ArtifactsListProps {
  children: React.ReactNode;
}

export function ArtifactsList({ children }: ArtifactsListProps) {
  return <div>{children}</div>;
}
