/**
 * Detail drawer (right panel) for a single artifact.
 * Renders summary, tabs (Details, Tasks, Links, Attachments, Comments), and actions.
 */

export interface ArtifactDetailDrawerProps {
  children: React.ReactNode;
}

export function ArtifactDetailDrawer({ children }: ArtifactDetailDrawerProps) {
  return <>{children}</>;
}
