import { Box, Typography, Button } from "@mui/material";
import type { DeleteArtifactModalProps } from "../modalTypes";

type Props = DeleteArtifactModalProps & { onClose: () => void };

export function DeleteArtifactModal({ artifact, onConfirm, onClose }: Props) {
  const handleDelete = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      <Typography sx={{ mb: 2 }}>
        Delete <strong>{artifact.artifact_key ?? artifact.id}</strong> — {artifact.title}? This
        will remove the artifact from the list.
      </Typography>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={handleDelete}>
          Delete
        </Button>
      </Box>
    </>
  );
}
