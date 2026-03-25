import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "../../components/ui";
import type { QualityArtifactModalProps } from "../modalTypes";
import { TestStepsEditor } from "../../../features/quality/components/TestStepsEditor";
import { normalizeTestSteps } from "../../../features/quality/lib/testSteps";

type Props = QualityArtifactModalProps & { onClose: () => void };

export function QualityArtifactModal({
  mode,
  initialTitle = "",
  initialDescription = "",
  initialSteps = [],
  enableStepsEditor = false,
  isPending,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useTranslation("quality");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [steps, setSteps] = useState(normalizeTestSteps(initialSteps));
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSaveDisabled = useMemo(() => {
    if (!title.trim()) return true;
    if (!enableStepsEditor) return false;
    return steps.some((step) => !step.name.trim() || !step.expectedResult.trim());
  }, [enableStepsEditor, steps, title]);

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        steps: normalizeTestSteps(steps),
      });
    } catch {
      setSubmitError(t("modals.saveError"));
    }
  };

  return (
    <div className="space-y-4 pb-2" data-testid="quality-artifact-modal">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("modals.fields.title")}</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("modals.placeholders.title")}
          data-testid="artifact-modal-title-input"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t("modals.fields.description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("modals.placeholders.description")}
          className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="artifact-modal-description-input"
        />
      </div>
      {enableStepsEditor ? <TestStepsEditor steps={steps} onChange={setSteps} /> : null}
      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} data-testid="artifact-modal-cancel">
          {t("common.cancel")}
        </Button>
        <Button
          type="button"
          disabled={isPending || isSaveDisabled}
          onClick={handleSubmit}
          data-testid={mode === "create" ? "artifact-modal-create" : "artifact-modal-save"}
        >
          {mode === "create" ? t("common.create") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

