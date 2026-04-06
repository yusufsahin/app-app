import { ChevronLeft, ChevronRight, Link as LinkIcon, Pencil, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/components/ui";

interface ArtifactDetailHeaderProps {
  hasArtifact: boolean;
  isLoading: boolean;
  isEditing: boolean;
  canEdit: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCopyLink: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export function ArtifactDetailHeader({
  hasArtifact,
  isLoading,
  isEditing,
  canEdit,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onCopyLink,
  onEdit,
  onClose,
}: ArtifactDetailHeaderProps) {
  return (
    <div className="mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
      <div className="flex items-center gap-1">
        {hasArtifact && !isLoading && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label="Previous artifact"
                >
                  <ChevronLeft className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Previous artifact</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label="Next artifact"
                >
                  <ChevronRight className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Next artifact</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
      <h2 className="min-w-0 truncate text-lg font-semibold">Artifact details</h2>
      <div className="flex gap-1">
        {isLoading && <span className="text-sm text-muted-foreground">Loading…</span>}
        {hasArtifact && !isEditing && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                  onClick={onCopyLink}
                  aria-label="Copy link to artifact"
                >
                  <LinkIcon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Copy link</TooltipContent>
            </Tooltip>
            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                    onClick={onEdit}
                    aria-label="Edit artifact"
                  >
                    <Pencil className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
            )}
          </>
        )}
        {!isLoading && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Close (Escape)</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
