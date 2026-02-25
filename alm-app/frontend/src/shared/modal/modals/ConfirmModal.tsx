import { Box, Button, Typography } from "@mui/material";
import type { ConfirmModalProps } from "../modalTypes";

type Props = ConfirmModalProps & { onClose: () => void };

export function ConfirmModal({
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onClose,
}: Props) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      <Typography sx={{ mb: 2 }}>{message}</Typography>
      <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <Button onClick={onClose}>{cancelLabel}</Button>
        <Button
          variant="contained"
          color={variant === "destructive" ? "error" : "primary"}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </Box>
    </>
  );
}
