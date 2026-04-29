import type { CSSProperties, ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../../../shared/components/ui";
import { Button } from "../../../shared/components/ui";
import { useAiStore } from "../../../shared/stores/aiStore";
import { ARTIFACT_DETAIL_SHEET_MAX_WIDTH_CSS } from "../constants/layout";
import { ArtifactDetailDrawer } from "./ArtifactDetailDrawer";
import { ArtifactDetailDndProvider } from "./ArtifactDetailPanelBody";

export interface ArtifactDetailSurfaceProps {
  isPage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Pinned below the scrollable detail body (e.g. task read-only preview). */
  footer?: ReactNode;
}

export function ArtifactDetailSurface({
  isPage,
  open,
  onOpenChange,
  children,
  footer,
}: ArtifactDetailSurfaceProps) {
  const openChat = useAiStore((s) => s.openChat);
  if (isPage) {
    return (
      <div className="mt-6 rounded-lg border bg-background shadow-sm" aria-label="Artifact details page">
        <ArtifactDetailDrawer>
          <div className="flex min-h-0 w-full flex-col" aria-label="Artifact details">
            <div className="flex justify-end p-2">
              <Button size="sm" variant="outline" onClick={() => openChat()}>
                AI Assistant
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ArtifactDetailDndProvider>{children}</ArtifactDetailDndProvider>
            </div>
            {footer ? <div className="shrink-0">{footer}</div> : null}
          </div>
        </ArtifactDetailDrawer>
      </div>
    );
  }

  const sheetMaxStyle = {
    maxWidth: ARTIFACT_DETAIL_SHEET_MAX_WIDTH_CSS,
  } satisfies CSSProperties;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l p-0 sm:!max-w-none"
        style={sheetMaxStyle}
        aria-label="Artifact details"
      >
        <SheetTitle className="sr-only">Artifact details</SheetTitle>
        <SheetDescription className="sr-only">
          View artifact details, tasks, links, attachments, and comments.
        </SheetDescription>
        <ArtifactDetailDrawer>
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" aria-label="Artifact details">
            <div className="flex justify-end border-b px-4 py-2">
              <Button size="sm" variant="outline" onClick={() => openChat()}>
                AI Assistant
              </Button>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto px-4 pt-4 ${footer ? "pb-2" : "pb-4"}`}>
              <ArtifactDetailDndProvider>{children}</ArtifactDetailDndProvider>
            </div>
            {footer}
          </div>
        </ArtifactDetailDrawer>
      </SheetContent>
    </Sheet>
  );
}
