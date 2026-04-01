import { Skeleton, TabsContent } from "../../../shared/components/ui";
import type { EntityHistoryResponse } from "../../../shared/api/auditApi";
import { formatDateTime } from "../utils";

interface ArtifactDetailAuditProps {
  auditTarget: string;
  onAuditTargetChange: (value: string) => void;
  artifactLabel: string;
  tasks: Array<{ id: string; title: string }>;
  entityHistoryLoading: boolean;
  entityHistoryError: boolean;
  entityHistory?: EntityHistoryResponse | null;
}

export function ArtifactDetailAudit({
  auditTarget,
  onAuditTargetChange,
  artifactLabel,
  tasks,
  entityHistoryLoading,
  entityHistoryError,
  entityHistory,
}: ArtifactDetailAuditProps) {
  return (
    <TabsContent value="audit" className="py-2">
      <div className="mb-2 flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Entity history</p>
        <select
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          aria-label="Audit entity target"
          title="Audit entity target"
          value={auditTarget}
          onChange={(e) => onAuditTargetChange(e.target.value)}
        >
          <option value="artifact">Artifact: {artifactLabel}</option>
          {tasks.map((task) => (
            <option key={task.id} value={`task:${task.id}`}>
              Task: {task.title}
            </option>
          ))}
        </select>
      </div>
      {entityHistoryLoading ? (
        <Skeleton className="h-16 rounded-md" />
      ) : entityHistoryError ? (
        <p className="text-sm text-destructive">Failed to load audit history.</p>
      ) : !entityHistory || entityHistory.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries.</p>
      ) : (
        <ul className="space-y-3">
          {entityHistory.entries.map((entry) => (
            <li key={entry.snapshot.id} className="rounded-md border p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  v{entry.snapshot.version} · {entry.snapshot.change_type}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.snapshot.committed_at ? formatDateTime(entry.snapshot.committed_at) : "—"}
                </span>
              </div>
              {entry.changes.length > 0 ? (
                <ul className="space-y-1">
                  {entry.changes.slice(0, 5).map((change) => (
                    <li key={`${entry.snapshot.id}-${change.property_name}`} className="text-xs">
                      <strong>{change.property_name}</strong>:{" "}
                      <span className="text-muted-foreground">
                        {String(change.left ?? "null")} → {String(change.right ?? "null")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No property diff.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </TabsContent>
  );
}
