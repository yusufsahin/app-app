import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { Badge, Button, Skeleton, TabsContent, cn } from "../../../shared/components/ui";
import type { Task } from "../../../shared/api/taskApi";

const ARTIFACT_TASK_DND = "artifact-task-detail-row";

type DragItem = { taskId: string; index: number };

interface ArtifactDetailTasksProps {
  tasks: Task[];
  tasksLoading: boolean;
  members?: Array<{ user_id: string; display_name?: string; email?: string }> | null;
  /** Matches tree task selection; row is highlighted and scrolled into view. */
  highlightedTaskId?: string | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onAddTask: () => void;
  /** Persist order after drag; omit when user cannot reorder. */
  onReorderTasksCommitted?: (orderedTaskIds: string[]) => void;
  taskReorderPending?: boolean;
}

function DetailTaskRow({
  task,
  index,
  moveRow,
  rowHighlighted,
  members,
  onEditTask,
  onDeleteTask,
  reorderEnabled,
  reorderPending,
  dragOrderStartRef,
  orderedRef,
  onReorderCommitted,
}: {
  task: Task;
  index: number;
  moveRow: (from: number, to: number) => void;
  rowHighlighted: boolean;
  members?: Array<{ user_id: string; display_name?: string; email?: string }> | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  reorderEnabled: boolean;
  reorderPending: boolean;
  dragOrderStartRef: React.MutableRefObject<string[] | null>;
  orderedRef: React.MutableRefObject<Task[]>;
  onReorderCommitted?: (orderedTaskIds: string[]) => void;
}) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const gripRef = useRef<HTMLButtonElement | null>(null);

  const [, drop] = useDrop({
    accept: ARTIFACT_TASK_DND,
    hover(dragged: DragItem, monitor) {
      const el = rowRef.current;
      if (!el || !reorderEnabled || reorderPending) return;
      const dragIndex = dragged.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      const rect = el.getBoundingClientRect();
      const mid = (rect.bottom - rect.top) / 2;
      const offset = monitor.getClientOffset();
      if (!offset) return;
      const hoverClientY = offset.y - rect.top;
      if (dragIndex < hoverIndex && hoverClientY < mid) return;
      if (dragIndex > hoverIndex && hoverClientY > mid) return;
      moveRow(dragIndex, hoverIndex);
      dragged.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: ARTIFACT_TASK_DND,
    item: () => {
      dragOrderStartRef.current = orderedRef.current.map((t) => t.id);
      return { taskId: task.id, index };
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    canDrag: reorderEnabled && !reorderPending,
    end: () => {
      const start = dragOrderStartRef.current;
      dragOrderStartRef.current = null;
      if (!start || !onReorderCommitted) return;
      const now = orderedRef.current.map((t) => t.id);
      if (start.join(",") !== now.join(",")) {
        onReorderCommitted(now);
      }
    },
  });

  const setRowRef = useCallback(
    (node: HTMLLIElement | null) => {
      rowRef.current = node;
      if (node) drop(node);
    },
    [drop],
  );

  const setGripRef = useCallback(
    (node: HTMLButtonElement | null) => {
      gripRef.current = node;
      if (node && reorderEnabled) drag(node);
    },
    [drag, reorderEnabled],
  );

  return (
    <li
      ref={setRowRef}
      data-task-row-id={task.id}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md py-2 pl-1 pr-1",
        rowHighlighted && "bg-muted/50",
        isDragging && "opacity-50",
      )}
      aria-current={rowHighlighted ? "true" : undefined}
    >
      <div className="flex min-w-0 flex-1 items-start gap-1">
        {reorderEnabled ? (
          <button
            type="button"
            ref={setGripRef}
            className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder task"
            disabled={reorderPending}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="inline-block w-2 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{task.title}</p>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {task.state}
            </Badge>
            {(task.tags ?? []).map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-[0.65rem] font-normal">
                {tag.name}
              </Badge>
            ))}
            {task.assignee_id &&
              (members?.find((member) => member.user_id === task.assignee_id)?.display_name ||
                members?.find((member) => member.user_id === task.assignee_id)?.email ||
                task.assignee_id)}
          </div>
        </div>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
          aria-label="Edit task"
          onClick={() => onEditTask(task)}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-destructive hover:bg-muted"
          aria-label="Delete task"
          onClick={() => onDeleteTask(task)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

export function ArtifactDetailTasks({
  tasks,
  tasksLoading,
  members,
  highlightedTaskId = null,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onReorderTasksCommitted,
  taskReorderPending = false,
}: ArtifactDetailTasksProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [ordered, setOrdered] = useState<Task[]>(tasks);
  const orderedRef = useRef<Task[]>(tasks);
  const dragOrderStartRef = useRef<string[] | null>(null);

  useEffect(() => {
    setOrdered(tasks);
  }, [tasks]);

  useEffect(() => {
    orderedRef.current = ordered;
  }, [ordered]);

  const moveRow = useCallback((from: number, to: number) => {
    setOrdered((prev) => {
      const next = [...prev];
      const row = next.splice(from, 1)[0];
      if (row === undefined) return prev;
      next.splice(to, 0, row);
      return next;
    });
  }, []);

  const reorderEnabled = Boolean(onReorderTasksCommitted) && ordered.length > 1;

  useLayoutEffect(() => {
    if (!highlightedTaskId || tasksLoading || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-task-row-id="${CSS.escape(highlightedTaskId)}"]`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedTaskId, tasksLoading, ordered]);

  return (
    <TabsContent value="tasks" className="py-2">
      {tasksLoading ? (
        <Skeleton className="h-16 rounded-md" />
      ) : (
        <>
          <ul ref={listRef} className="space-y-1">
            {ordered.map((task, index) => {
              const rowHighlighted = Boolean(highlightedTaskId && task.id === highlightedTaskId);
              return (
                <DetailTaskRow
                  key={task.id}
                  task={task}
                  index={index}
                  moveRow={moveRow}
                  rowHighlighted={rowHighlighted}
                  members={members}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  reorderEnabled={reorderEnabled}
                  reorderPending={taskReorderPending}
                  dragOrderStartRef={dragOrderStartRef}
                  orderedRef={orderedRef}
                  onReorderCommitted={onReorderTasksCommitted}
                />
              );
            })}
          </ul>
          {reorderEnabled ? (
            <p className="mt-1 text-xs text-muted-foreground">Drag the handle to reorder tasks.</p>
          ) : null}
          <Button size="sm" className="mt-2" onClick={onAddTask}>
            <Plus className="size-4" />
            Add task
          </Button>
        </>
      )}
    </TabsContent>
  );
}
