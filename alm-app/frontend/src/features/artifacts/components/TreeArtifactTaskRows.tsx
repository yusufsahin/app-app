import { useCallback, useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { GripVertical, ListTodo, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Artifact } from "../../../shared/api/artifactApi";
import type { Task } from "../../../shared/api/taskApi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../shared/components/ui";
import { cn } from "../../../shared/components/ui";

const TREE_TASK_DND = "artifact-task-tree-row";

type DragItem = { taskId: string; index: number };

function TreeTaskRow({
  artifact,
  task,
  index,
  depth,
  moveRow,
  taskRowSelected,
  onOpenTask,
  taskRowMenu,
  onEditTask,
  onDeleteTask,
  reorderEnabled,
  reorderPending,
  dragOrderStartRef,
  orderedRef,
  onReorderCommitted,
}: {
  artifact: Artifact;
  task: Task;
  index: number;
  depth: number;
  moveRow: (from: number, to: number) => void;
  taskRowSelected: boolean;
  onOpenTask: (artifact: Artifact, task: Task) => void;
  taskRowMenu: boolean;
  onEditTask?: (artifact: Artifact, task: Task) => void;
  onDeleteTask?: (artifact: Artifact, task: Task) => void;
  reorderEnabled: boolean;
  reorderPending: boolean;
  dragOrderStartRef: React.MutableRefObject<string[] | null>;
  orderedRef: React.MutableRefObject<Task[]>;
  onReorderCommitted?: (artifactId: string, orderedTaskIds: string[]) => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const gripRef = useRef<HTMLButtonElement | null>(null);

  const [, drop] = useDrop({
    accept: TREE_TASK_DND,
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
    type: TREE_TASK_DND,
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
        onReorderCommitted(artifact.id, now);
      }
    },
  });

  const setRowRef = useCallback(
    (node: HTMLDivElement | null) => {
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
    <div
      ref={setRowRef}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b py-1.5 text-sm",
        taskRowSelected && "bg-muted/50",
        isDragging && "opacity-50",
      )}
      style={{ paddingLeft: 8 + (depth + 1) * 12 }}
    >
      {reorderEnabled ? (
        <button
          type="button"
          ref={setGripRef}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder task"
          disabled={reorderPending}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="inline-block w-8 shrink-0" />
      )}
      <button
        type="button"
        className={cn(
          "flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-muted/80",
          taskRowSelected && "font-medium",
        )}
        onClick={() => onOpenTask(artifact, task)}
      >
        <ListTodo className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{task.title}</span>
        <span className="shrink-0 text-muted-foreground">{task.state}</span>
      </button>
      {taskRowMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
              aria-label="Task actions"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {onEditTask ? (
              <DropdownMenuItem onClick={() => onEditTask(artifact, task)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
            ) : null}
            {onDeleteTask ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteTask(artifact, task)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="inline-block w-8 shrink-0" />
      )}
    </div>
  );
}

export function TreeArtifactTaskRows({
  artifact,
  tasks,
  depth,
  selectedTreeTask,
  onOpenTask,
  onEditTask,
  onDeleteTask,
  onReorderCommitted,
  reorderPending = false,
}: {
  artifact: Artifact;
  tasks: Task[];
  depth: number;
  selectedTreeTask: { artifactId: string; taskId: string } | null;
  onOpenTask: (artifact: Artifact, task: Task) => void;
  onEditTask?: (artifact: Artifact, task: Task) => void;
  onDeleteTask?: (artifact: Artifact, task: Task) => void;
  onReorderCommitted?: (artifactId: string, orderedTaskIds: string[]) => void;
  reorderPending?: boolean;
}) {
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

  const taskRowMenu = Boolean(onEditTask && onDeleteTask);
  const reorderEnabled = Boolean(onReorderCommitted) && ordered.length > 1;

  return (
    <>
      {ordered.map((task, index) => {
        const taskRowSelected =
          selectedTreeTask?.artifactId === artifact.id && selectedTreeTask.taskId === task.id;
        return (
          <TreeTaskRow
            key={task.id}
            artifact={artifact}
            task={task}
            index={index}
            depth={depth}
            moveRow={moveRow}
            taskRowSelected={taskRowSelected}
            onOpenTask={onOpenTask}
            taskRowMenu={taskRowMenu}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            reorderEnabled={reorderEnabled}
            reorderPending={reorderPending}
            dragOrderStartRef={dragOrderStartRef}
            orderedRef={orderedRef}
            onReorderCommitted={onReorderCommitted}
          />
        );
      })}
    </>
  );
}
