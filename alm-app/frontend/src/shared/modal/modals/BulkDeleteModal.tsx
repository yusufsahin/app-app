import { Box, Typography, Button } from "@mui/material";
import type { BulkDeleteModalProps } from "../modalTypes";

type Props = BulkDeleteModalProps & { onClose: () => void };

export function BulkDeleteModal({ selectedIds, onConfirm, onClose }: Props) {
  const count = selectedIds.length;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Delete {count} artifact(s)? This will soft-delete the selected artifacts. This action cannot
        be undone from this screen.
      </Typography>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={handleConfirm}>
          Delete
        </Button>
      </Box>
    </>
  );
}
