import { Box, Typography, Button } from "@mui/material";
import type { ConflictModalProps } from "../modalTypes";

type Props = ConflictModalProps & { onClose: () => void };

export function ConflictModal({ message, onOverwrite, onCancel, onClose }: Props) {
  const handleOverwrite = () => {
    onOverwrite();
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <>
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Do you want to apply your state change anyway (overwrite)?
      </Typography>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleOverwrite}>
          Overwrite
        </Button>
      </Box>
    </>
  );
}
