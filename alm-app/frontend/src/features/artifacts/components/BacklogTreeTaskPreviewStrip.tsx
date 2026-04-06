import { Pencil, X } from "lucide-react";
import { Badge, Button } from "../../../shared/components/ui";
import type { Task } from "../../../shared/api/taskApi";

export interface BacklogTreeTaskPreviewStripProps {
  task: Task;
  /** Parent work item label (e.g. key + title). */
  parentLabel: string;
  members?: Array<{ user_id: string; display_name?: string; email?: string }> | null;
  onEdit: () => void;
  onDismiss: () => void;
}

export function BacklogTreeTaskPreviewStrip({
  task,
  parentLabel,
  members,
  onEdit,
  onDismiss,
}: BacklogTreeTaskPreviewStripProps) {
  const assigneeLabel =
    task.assignee_id &&
    (members?.find((m) => m.user_id === task.assignee_id)?.display_name ||
      members?.find((m) => m.user_id === task.assignee_id)?.email ||
      task.assignee_id);

  return (
    <aside
      className="border-t border-border bg-muted/40 px-4 py-3"
      aria-label="Task preview"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Task</p>
            <p className="text-sm text-muted-foreground line-clamp-2" title={parentLabel}>
              {parentLabel}
            </p>
            <h3 className="mt-1 text-base font-semibold leading-snug">{task.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-xs font-normal">
              {task.state}
            </Badge>
            {(task.tags ?? []).map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-[0.65rem] font-normal">
                {tag.name}
              </Badge>
            ))}
          </div>
          {assigneeLabel ? (
            <p className="text-sm text-muted-foreground">
              Assignee: <span className="text-foreground">{assigneeLabel}</span>
            </p>
          ) : null}
          {task.rank_order != null ? (
            <p className="text-xs text-muted-foreground tabular-nums">Rank: {task.rank_order}</p>
          ) : null}
          {task.description?.trim() ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="sm" variant="outline" onClick={onEdit} className="gap-1">
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={onDismiss} aria-label="Close task preview">
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
