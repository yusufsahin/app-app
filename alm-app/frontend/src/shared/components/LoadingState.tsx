import { Loader2 } from "lucide-react";

export interface LoadingStateProps {
  label?: string;
  minHeight?: number;
}

/**
 * Centered full-area loading with spinner and optional label.
 */
export function LoadingState({ label = "Loading…", minHeight = 120 }: LoadingStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-6"
      style={{ minHeight }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
