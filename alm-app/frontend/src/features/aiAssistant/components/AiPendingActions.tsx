import { Button } from "../../../shared/components/ui";
import type { AiPendingAction } from "../types/ai";

interface Props {
  pendingActions: AiPendingAction[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export function AiPendingActions({ pendingActions, onApprove, onReject }: Props) {
  if (!pendingActions.length) return null;
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-semibold">Pending Actions</p>
      {pendingActions.map((action) => (
        <div key={action.id} className="rounded-md border p-2 text-xs">
          <p className="font-medium">{action.tool_name}</p>
          <pre className="overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(action.tool_args, null, 2)}
          </pre>
          {action.status === "pending" ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => void onApprove(action.id)}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onReject(action.id)}>
                Reject
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">Status: {action.status}</p>
          )}
        </div>
      ))}
    </div>
  );
}
