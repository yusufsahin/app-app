import {
  Button,
  Badge,
  Label,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../../components/ui";
import { MetadataDrivenForm } from "../../components/forms";
import type { BulkTransitionModalProps } from "../modalTypes";

type Props = BulkTransitionModalProps & { onClose: () => void };

export function BulkTransitionModal({
  commonTriggers,
  currentTrigger,
  onSelectTrigger,
  stateOptions,
  transitionSchema,
  transitionValues,
  onTransitionFormChange,
  lastResult,
  errorsExpanded,
  onToggleErrors,
  onConfirm,
  isPending,
  confirmDisabled,
  invalidCount = 0,
  onCloseComplete,
  onClose,
}: Props) {
  const currentState = (transitionValues.state as string) ?? "";
  const handleClose = () => {
    onCloseComplete?.();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm({
      trigger: currentTrigger,
      state: currentState,
      state_reason: (transitionValues.state_reason as string) ?? "",
      resolution: (transitionValues.resolution as string) ?? "",
    });
  };

  return (
    <>
      {lastResult ? (
        <>
          <p
            className={
              lastResult.error_count > 0
                ? "mb-2 text-sm text-amber-600 dark:text-amber-500"
                : "mb-2 text-sm text-green-600 dark:text-green-500"
            }
          >
            {lastResult.success_count} succeeded, {lastResult.error_count} failed.
          </p>
          {lastResult.errors.length > 0 && (
            <div className="mb-2">
              <Button size="sm" variant="outline" onClick={onToggleErrors}>
                {errorsExpanded ? "Hide" : "Show"} failed items
              </Button>
              {errorsExpanded && (
                <ul className="mt-2 max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto rounded-md bg-muted/50 p-2 text-sm">
                  {lastResult.errors.slice(0, 20).map((err, i) => {
                    const colonIdx = err.indexOf(": ");
                    const message = colonIdx > 0 ? err.slice(colonIdx + 2) : err;
                    return <li key={i}>{message}</li>;
                  })}
                  {lastResult.errors.length > 20 && (
                    <li>... and {lastResult.errors.length - 20} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {commonTriggers.length > 0 && (
            <div className="mb-4">
              <span className="mb-1 block text-xs text-muted-foreground">
                Common actions (apply to all selected)
              </span>
              <div className="flex flex-wrap gap-1">
                {commonTriggers.map((item) => (
                  <Badge
                    key={item.trigger}
                    variant={currentTrigger === item.trigger ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => onSelectTrigger(item.trigger)}
                  >
                    {item.label ?? item.to_state}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="mb-4 space-y-2">
            <Label>New state</Label>
            <Select
              value={currentState}
              onValueChange={(v) => onTransitionFormChange({ ...transitionValues, state: v })}
            >
              <SelectTrigger size="sm">
                <SelectValue placeholder="New state" />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalidCount > 0 && currentState && (
              <p className="mt-1 text-xs text-muted-foreground">
                {invalidCount} item(s) cannot transition to this state
              </p>
            )}
          </div>
          {transitionSchema ? (
            <MetadataDrivenForm
              schema={transitionSchema}
              values={transitionValues}
              onChange={onTransitionFormChange}
              onSubmit={() => {}}
              submitLabel="Transition"
              disabled={isPending}
              submitExternally
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-state-reason">State reason (optional)</Label>
                <Input
                  id="bulk-state-reason"
                  value={(transitionValues.state_reason as string) ?? ""}
                  onChange={(e) =>
                    onTransitionFormChange({
                      ...transitionValues,
                      state_reason: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-resolution">Resolution (optional)</Label>
                <Input
                  id="bulk-resolution"
                  value={(transitionValues.resolution as string) ?? ""}
                  onChange={(e) =>
                    onTransitionFormChange({
                      ...transitionValues,
                      resolution: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
        </>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        {!lastResult && (
          <Button onClick={handleConfirm} disabled={confirmDisabled || isPending}>
            Transition
          </Button>
        )}
        {lastResult && <Button onClick={handleClose}>Close</Button>}
      </div>
    </>
  );
}
