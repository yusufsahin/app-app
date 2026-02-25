import { Box, Button, Chip, Typography } from "@mui/material";
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {artifact.artifact_key ?? artifact.id} — {artifact.title}
      </Typography>
      {permittedTransitions.length > 1 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Change target
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {permittedTransitions.map((item) => (
              <Chip
                key={item.trigger}
                label={item.label ?? item.to_state}
                onClick={() => onSelectTargetState(item.to_state)}
                variant={targetState === item.to_state ? "filled" : "outlined"}
                size="small"
              />
            ))}
          </Box>
        </Box>
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
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm} disabled={isPending}>
          Transition
        </Button>
      </Box>
    </>
  );
}
