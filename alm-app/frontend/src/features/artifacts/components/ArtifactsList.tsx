/**
 * List/tree view and bulk actions for the backlog workspace.
 * Renders the main content area (bulk bar, table or tree, pagination).
 */
export interface ArtifactsListProps {
  children: React.ReactNode;
}

export function ArtifactsList({ children }: ArtifactsListProps) {
  return <div>{children}</div>;
}

export { ArtifactsList as BacklogWorkspaceLayout };
export type { ArtifactsListProps as BacklogWorkspaceLayoutProps };
