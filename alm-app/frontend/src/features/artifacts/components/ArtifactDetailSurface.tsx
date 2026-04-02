import type { CSSProperties, ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../../../shared/components/ui";
import { ARTIFACT_DETAIL_SHEET_MAX_WIDTH_CSS } from "../constants/layout";
import { ArtifactDetailDrawer } from "./ArtifactDetailDrawer";

export interface ArtifactDetailSurfaceProps {
  isPage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function ArtifactDetailSurface({
  isPage,
  open,
  onOpenChange,
  children,
}: ArtifactDetailSurfaceProps) {
  if (isPage) {
    return (
      <div className="mt-6 rounded-lg border bg-background p-4 shadow-sm" aria-label="Artifact details page">
        <ArtifactDetailDrawer>
          <div className="w-full" aria-label="Artifact details">
            {children}
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
          <div
            className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-4"
            aria-label="Artifact details"
          >
            {children}
          </div>
        </ArtifactDetailDrawer>
      </SheetContent>
    </Sheet>
  );
}
