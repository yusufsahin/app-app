import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Skeleton, TabsContent } from "../../../shared/components/ui";
import type { Task } from "../../../shared/api/taskApi";
import type { ArtifactTagBrief } from "../../../shared/stores/artifactStore";

interface ArtifactDetailTasksProps {
  tasks: Task[];
  tasksLoading: boolean;
  artifactTags: ArtifactTagBrief[];
  members?: Array<{ user_id: string; display_name?: string; email?: string }> | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onAddTask: () => void;
}

export function ArtifactDetailTasks({
  tasks,
  tasksLoading,
  artifactTags,
  members,
  onEditTask,
  onDeleteTask,
  onAddTask,
}: ArtifactDetailTasksProps) {
  return (
    <TabsContent value="tasks" className="py-2">
      {tasksLoading ? (
        <Skeleton className="h-16 rounded-md" />
      ) : (
        <>
          {artifactTags.length > 0 && (
            <div
              className="mb-3 rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 px-3 py-2 text-sm"
              aria-label="Work item tags"
            >
              <span className="text-muted-foreground">Work item tags</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {artifactTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="font-normal text-[0.65rem] text-muted-foreground"
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <ul className="space-y-1">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-xs">{task.state}</Badge>
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
            ))}
          </ul>
          <Button size="sm" className="mt-2" onClick={onAddTask}>
            <Plus className="size-4" />
            Add task
          </Button>
        </>
      )}
    </TabsContent>
  );
}
