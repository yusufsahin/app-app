import { Button } from "../../components/ui";
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
      <p className="text-muted-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Do you want to apply your state change anyway (overwrite)?
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleOverwrite}>
          Overwrite
        </Button>
      </div>
    </>
  );
}
