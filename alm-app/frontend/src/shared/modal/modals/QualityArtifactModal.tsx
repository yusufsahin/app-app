import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "../../components/ui";
import { cn } from "../../components/ui/utils";
import type { QualityArtifactModalProps } from "../modalTypes";
import { attemptModalCloseAsync, setModalCloseGuard } from "../modalCloseGuard";
import { TestStepsEditor } from "../../../features/quality/components/TestStepsEditor";
import { QualityTestParamsEditor } from "../../../features/quality/components/QualityTestParamsEditor";
import { normalizeTestPlan, serializeTestPlan } from "../../../features/quality/lib/testPlan";
import { isTestPlanCall } from "../../../features/quality/types";
import {
  normalizeTestParams,
  serializeTestParams,
  extractReferencedParamNamesFromPlan,
} from "../../../features/quality/lib/testParams";
import { emptyTestParamsDocument } from "../../../features/quality/lib/emptyTestParams";

type Props = QualityArtifactModalProps & { onClose: () => void };

export function QualityArtifactModal({
  mode,
  initialTitle = "",
  initialDescription = "",
  initialSteps = [],
  initialTestParams = null,
  enableStepsEditor = false,
  testCasePickerContext,
  onNavigateToTestCase,
  isPending,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useTranslation("quality");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [steps, setSteps] = useState(() => normalizeTestPlan(initialSteps));
  const [params, setParams] = useState(() =>
    normalizeTestParams(initialTestParams != null ? initialTestParams : emptyTestParamsDocument()),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false);
  const dirtyRef = useRef(false);
  const bypassGuardRef = useRef(false);
  const discardResolverRef = useRef<((allow: boolean) => void) | null>(null);

  const initialSnapshot = useMemo(
    () => ({
      title: initialTitle.trim(),
      description: initialDescription.trim(),
      stepsJson: JSON.stringify(serializeTestPlan(normalizeTestPlan(initialSteps))),
      paramsJson: JSON.stringify(
        serializeTestParams(
          normalizeTestParams(initialTestParams != null ? initialTestParams : emptyTestParamsDocument()),
        ),
      ),
    }),
    [initialTitle, initialDescription, initialSteps, initialTestParams],
  );

  const isDirty = useMemo(() => {
    const cur = JSON.stringify(serializeTestPlan(normalizeTestPlan(steps)));
    const curParams = JSON.stringify(serializeTestParams(normalizeTestParams(params)));
    return (
      title.trim() !== initialSnapshot.title ||
      description.trim() !== initialSnapshot.description ||
      cur !== initialSnapshot.stepsJson ||
      curParams !== initialSnapshot.paramsJson
    );
  }, [title, description, steps, params, initialSnapshot]);

  const undefinedPlaceholders = useMemo(() => {
    if (!enableStepsEditor || params.defs.length === 0) return [];
    const names = extractReferencedParamNamesFromPlan(steps);
    const defSet = new Set(params.defs.map((d) => d.name));
    return [...names].filter((n) => !defSet.has(n));
  }, [enableStepsEditor, steps, params.defs]);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    bypassGuardRef.current = false;
  }, []);

  useEffect(() => {
    setModalCloseGuard(() => {
      if (bypassGuardRef.current) return true;
      if (!dirtyRef.current) return true;
      return new Promise<boolean>((resolve) => {
        discardResolverRef.current = resolve;
        setDiscardPromptOpen(true);
      });
    });
    return () => {
      discardResolverRef.current?.(false);
      discardResolverRef.current = null;
      setModalCloseGuard(null);
    };
  }, []);

  const finishDiscardPrompt = (allow: boolean) => {
    setDiscardPromptOpen(false);
    const r = discardResolverRef.current;
    discardResolverRef.current = null;
    r?.(allow);
  };

  const isSaveDisabled = useMemo(() => {
    if (!title.trim()) return true;
    if (!enableStepsEditor) return false;
    return steps.some((entry) =>
      isTestPlanCall(entry) ? !entry.calledTestCaseId.trim() : !entry.name.trim(),
    );
  }, [enableStepsEditor, steps, title]);

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      const p = normalizeTestParams(params);
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        ...(enableStepsEditor
          ? {
              steps: normalizeTestPlan(steps),
              testParams: p.defs.length > 0 ? p : null,
            }
          : {}),
      });
      bypassGuardRef.current = true;
    } catch (error: unknown) {
      const detail =
        (error as { body?: { detail?: string }; detail?: string; message?: string })?.body?.detail ??
        (error as { detail?: string; message?: string })?.detail ??
        (error as { message?: string })?.message;
      setSubmitError(detail || t("modals.saveError"));
    }
  };

  return (
    <div data-testid="quality-artifact-modal">
      {discardPromptOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="quality-discard-title"
          aria-describedby="quality-discard-desc"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label={t("modals.keepEditing")}
            onClick={() => finishDiscardPrompt(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-lg">
            <h2 id="quality-discard-title" className="text-base font-semibold text-foreground">
              {t("modals.discardChangesTitle")}
            </h2>
            <p id="quality-discard-desc" className="mt-2 text-sm text-muted-foreground">
              {t("modals.discardChangesDetail")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => finishDiscardPrompt(false)}
                data-testid="artifact-modal-discard-cancel"
              >
                {t("modals.keepEditing")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => finishDiscardPrompt(true)}
                data-testid="artifact-modal-discard-confirm"
              >
                {t("modals.discard")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 pb-4">
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
            className="box-border min-h-[90px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid="artifact-modal-description-input"
          />
        </div>
        {enableStepsEditor ? (
          <>
            <QualityTestParamsEditor value={params} onChange={setParams} disabled={!!isPending} />
            {undefinedPlaceholders.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-500" data-testid="quality-params-undefined-warning">
                {t("params.undefinedInSteps", { names: undefinedPlaceholders.join(", ") })}
              </p>
            ) : null}
            <TestStepsEditor
              steps={steps}
              onChange={setSteps}
              testCasePickerContext={testCasePickerContext}
              onNavigateToTestCase={onNavigateToTestCase}
            />
          </>
        ) : null}
        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
      </div>
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-6 border-t border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        )}
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void attemptModalCloseAsync(onClose)}
            data-testid="artifact-modal-cancel"
          >
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
    </div>
  );
}
