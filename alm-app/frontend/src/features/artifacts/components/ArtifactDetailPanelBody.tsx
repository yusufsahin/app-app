import type { ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

/**
 * Minimal DnD shell for artifact detail (task reorder, etc.) when rendered outside the main backlog DndProvider
 * (e.g. full-page `/backlog/:id` or sheet detail).
 */
export function ArtifactDetailDndProvider({ children }: { children: ReactNode }) {
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}

/**
 * Dialog-sized scroll region + DnD for tabular detail modal.
 */
export function ArtifactDetailPanelBody({ children }: { children: ReactNode }) {
  return (
    <ArtifactDetailDndProvider>
      <div className="min-h-0 max-h-[min(78vh,800px)] overflow-y-auto">{children}</div>
    </ArtifactDetailDndProvider>
  );
}
