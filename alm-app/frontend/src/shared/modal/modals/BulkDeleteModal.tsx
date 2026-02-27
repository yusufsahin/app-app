import { Button } from "../../components/ui";
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
      <p className="mb-4 text-muted-foreground">
        Delete {count} artifact(s)? This will soft-delete the selected artifacts. This action cannot
        be undone from this screen.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={handleConfirm}>
          Delete
        </Button>
      </div>
    </>
  );
}
