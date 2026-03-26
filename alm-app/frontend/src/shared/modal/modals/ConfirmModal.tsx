import { Button } from "../../components/ui";
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
      <p className="mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>{cancelLabel}</Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}
