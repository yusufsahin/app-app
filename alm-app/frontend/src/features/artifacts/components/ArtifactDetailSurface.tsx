import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../../../shared/components/ui";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-4 sm:max-w-[420px]" aria-label="Artifact details">
        <SheetTitle className="sr-only">Artifact details</SheetTitle>
        <SheetDescription className="sr-only">
          View artifact details, tasks, links, attachments, and comments.
        </SheetDescription>
        <ArtifactDetailDrawer>
          <div className="w-full p-4 sm:w-[420px]" aria-label="Artifact details">
            {children}
          </div>
        </ArtifactDetailDrawer>
      </SheetContent>
    </Sheet>
  );
}
