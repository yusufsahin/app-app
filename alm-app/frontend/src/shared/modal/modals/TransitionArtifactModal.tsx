import { Button, Badge } from "../../components/ui";
import { MetadataDrivenForm } from "../../components/forms";
import type { TransitionArtifactModalProps } from "../modalTypes";

type Props = TransitionArtifactModalProps & { onClose: () => void };

export function TransitionArtifactModal({
  artifact,
  targetState,
  permittedTransitions,
  onSelectTargetState,
  schema,
  values,
  onChange,
  onConfirm,
  isPending,
  onCloseComplete,
  onClose,
}: Props) {
  const handleCancel = () => {
    onCloseComplete?.();
    onClose();
  };
  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {artifact.artifact_key ?? artifact.id} — {artifact.title}
      </p>
      {permittedTransitions.length > 1 && (
        <div className="mb-4">
          <span className="mb-1 block text-xs text-muted-foreground">Change target</span>
          <div className="flex flex-wrap gap-1">
            {permittedTransitions.map((item) => (
              <Badge
                key={item.trigger}
                variant={targetState === item.to_state ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => onSelectTargetState(item.to_state)}
              >
                {item.label ?? item.to_state}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {schema && (
        <MetadataDrivenForm
          schema={schema}
          values={values}
          onChange={onChange}
          onSubmit={onConfirm}
          submitLabel="Transition"
          disabled={isPending}
          submitExternally
        />
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button onClick={onConfirm} disabled={isPending}>
          Transition
        </Button>
      </div>
    </>
  );
}
