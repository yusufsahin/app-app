import { Button } from "../../components/ui";
import type { DeleteArtifactModalProps } from "../modalTypes";

type Props = DeleteArtifactModalProps & { onClose: () => void };

export function DeleteArtifactModal({ artifact, onConfirm, onClose }: Props) {
  const handleDelete = () => {
    onConfirm();
    onClose();
  };

  return (
    <>
      <p className="mb-4">
        Delete <strong>{artifact.artifact_key ?? artifact.id}</strong> — {artifact.title}? This
        will remove the artifact from the list.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </>
  );
}
