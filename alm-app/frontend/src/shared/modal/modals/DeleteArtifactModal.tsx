import { Button } from "../../components/ui";
import type { DeleteArtifactModalProps } from "../modalTypes";
import { useTranslation } from "react-i18next";

type Props = DeleteArtifactModalProps & { onClose: () => void };

export function DeleteArtifactModal({ artifact, onConfirm, onClose }: Props) {
  const { t } = useTranslation("quality");
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
        <Button variant="outline" onClick={onClose} data-testid="artifact-modal-delete-cancel">{t("common.cancel")}</Button>
        <Button variant="destructive" onClick={handleDelete} data-testid="artifact-modal-delete-confirm">
          {t("common.delete")}
        </Button>
      </div>
    </>
  );
}
