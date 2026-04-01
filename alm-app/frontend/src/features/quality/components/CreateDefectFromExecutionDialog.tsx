import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/components/ui";
import { Input } from "../../../shared/components/ui/input";
import { Label } from "../../../shared/components/ui/label";
import { useCreateArtifact } from "../../../shared/api/artifactApi";
import { apiClient } from "../../../shared/api/client";
import { AttachmentComposer } from "../../../shared/components/attachments";
import { toast } from "sonner";
import { artifactDetailPath } from "../../../shared/utils/appPaths";
import type { Attachment } from "../../../shared/api/attachmentApi";

async function uploadAttachment(
  orgSlug: string,
  projectId: string,
  artifactId: string,
  file: File,
): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post<Attachment>(
    `/orgs/${orgSlug}/projects/${projectId}/artifacts/${artifactId}/attachments`,
    formData,
  );
  return data;
}

type ExecutionContextPayload = {
  run_id: string;
  test_case_id: string;
  source: "manual_runner";
  step_id?: string;
  step_name?: string;
  step_order?: number;
  step_status?: string;
  actual_result?: string;
  notes?: string;
  expected_result?: string;
};

export type DefectCreatedPayload = {
  defectId: string;
  runAttachmentIds: string[];
  runAttachmentNames: string[];
  defectAttachmentIds: string[];
  executionContext: ExecutionContextPayload;
};

export type CreateDefectFromExecutionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  projectId: string;
  projectSlug: string;
  runId: string;
  testCaseId: string;
  defectParentId: string | null;
  defectArtifactType: string;
  defaultTitle: string;
  defaultDescription: string;
  canCreateArtifact: boolean;
  canUpdateArtifact: boolean;
  stepContext?: {
    stepId: string;
    stepName: string;
    stepNumber: number;
    stepStatus: string;
    actualResult?: string;
    notes?: string;
    expectedResult?: string;
  } | null;
  manualRunnerMode?: boolean;
  onCreated?: (payload: DefectCreatedPayload) => void;
};

export function CreateDefectFromExecutionDialog({
  open,
  onOpenChange,
  orgSlug,
  projectId,
  projectSlug,
  runId,
  testCaseId,
  defectParentId,
  defectArtifactType,
  defaultTitle,
  defaultDescription,
  canCreateArtifact,
  canUpdateArtifact,
  stepContext,
  manualRunnerMode = false,
  onCreated,
}: CreateDefectFromExecutionDialogProps) {
  const { t } = useTranslation("quality");
  const navigate = useNavigate();
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [files, setFiles] = useState<File[]>([]);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "creating" | "linking" | "uploading">(
    "idle",
  );
  const [uploadIndex, setUploadIndex] = useState(0);

  const createArtifact = useCreateArtifact(orgSlug, projectId);
  const executionContext = useMemo<ExecutionContextPayload>(
    () => ({
      run_id: runId,
      test_case_id: testCaseId,
      source: "manual_runner",
      step_id: stepContext?.stepId,
      step_name: stepContext?.stepName,
      step_order: stepContext?.stepNumber,
      step_status: stepContext?.stepStatus,
      actual_result: stepContext?.actualResult,
      notes: stepContext?.notes,
      expected_result: stepContext?.expectedResult,
    }),
    [runId, testCaseId, stepContext],
  );

  const resetForm = useCallback(() => {
    setTitle(defaultTitle);
    setDescription(defaultDescription);
    setFiles([]);
    setSubmitPhase("idle");
    setUploadIndex(0);
  }, [defaultDescription, defaultTitle]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }, [onOpenChange, resetForm]);

  const handleSubmit = async () => {
    if (!defectParentId) {
      toast.error(t("execution.defect.noDefectRoot"));
      return;
    }
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error(t("execution.defect.titleRequired"));
      return;
    }
    if (submitPhase !== "idle") return;

    setSubmitPhase("creating");
    let defectId: string;
    try {
      const created = await createArtifact.mutateAsync({
        artifact_type: defectArtifactType,
        title: trimmed,
        description,
        parent_id: defectParentId,
        custom_fields: {
          execution_context_json: executionContext,
        },
      });
      defectId = created.id;
    } catch {
      toast.error(t("execution.defect.createFailed"));
      setSubmitPhase("idle");
      return;
    }

    let linkFailures = 0;
    if (canUpdateArtifact) {
      setSubmitPhase("linking");
      try {
        await apiClient.post(`/orgs/${orgSlug}/projects/${projectId}/artifacts/${defectId}/links`, {
          to_artifact_id: runId,
          link_type: "related",
        });
      } catch {
        linkFailures += 1;
      }
      try {
        await apiClient.post(`/orgs/${orgSlug}/projects/${projectId}/artifacts/${defectId}/links`, {
          to_artifact_id: testCaseId,
          link_type: "related",
        });
      } catch {
        linkFailures += 1;
      }
    }

    const runAttachmentIds: string[] = [];
    const runAttachmentNames: string[] = [];
    const defectAttachmentIds: string[] = [];
    if (files.length > 0) {
      setSubmitPhase("uploading");
      let i = 0;
      for (const file of files) {
        setUploadIndex(i + 1);
        try {
          const defectAttachment = await uploadAttachment(orgSlug, projectId, defectId, file);
          defectAttachmentIds.push(defectAttachment.id);
          if (canUpdateArtifact) {
            const runAttachment = await uploadAttachment(orgSlug, projectId, runId, file);
            runAttachmentIds.push(runAttachment.id);
            runAttachmentNames.push(runAttachment.file_name);
          }
        } catch {
          toast.error(t("execution.defect.uploadFailed", { name: file.name }));
        }
        i++;
      }
    }

    const openDefectAction =
      orgSlug && projectSlug
        ? {
            label: t("execution.defect.openInArtifacts"),
            onClick: () => navigate(artifactDetailPath(orgSlug, projectSlug, defectId)),
          }
        : undefined;

    if (linkFailures > 0) {
      toast.success(t("execution.defect.createdSuccess"), {
        description: t("execution.defect.linksPartialFailed"),
        action: openDefectAction,
      });
    } else {
      toast.success(t("execution.defect.createdSuccess"), { action: openDefectAction });
    }
    onCreated?.({
      defectId,
      runAttachmentIds,
      runAttachmentNames,
      defectAttachmentIds,
      executionContext,
    });
    handleOpenChange(false);
    setSubmitPhase("idle");
  };

  const busy =
    submitPhase === "creating" || submitPhase === "linking" || submitPhase === "uploading";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("execution.defect.dialogTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("execution.defect.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {manualRunnerMode && stepContext ? (
            <div className="rounded-md border border-border/80 bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t("execution.defect.stepBadge", { step: stepContext.stepNumber })}</Badge>
                <Badge variant="secondary">{stepContext.stepStatus}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium">{stepContext.stepName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("execution.defect.manualRunnerHint")}
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="defect-title">{t("execution.defect.titleLabel")}</Label>
            <Input
              id="defect-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defect-desc">{t("execution.defect.descriptionLabel")}</Label>
            <textarea
              id="defect-desc"
              placeholder={t("execution.defect.descriptionPlaceholder")}
              className="border-input placeholder:text-muted-foreground flex min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {t("execution.defect.attachmentsLabel")}
            </span>
            <AttachmentComposer
              className="space-y-2"
              files={files}
              onFilesChange={setFiles}
              disabled={busy}
              fileInputId="defect-attachments-input"
              captureFileNamePrefix={stepContext?.stepNumber != null ? `manual-runner-step-${stepContext.stepNumber}` : "manual-runner-step"}
              labels={{
                addFiles: t("execution.defect.addFiles"),
                captureScreen: t("execution.defect.captureScreen"),
                clipboardShortcut: t("execution.defect.clipboardShortcut"),
                removeFile: t("execution.defect.removeFile"),
                pasteHint: t("execution.defect.pasteHint"),
                dropFilesHint: t("execution.defect.dropFilesHint"),
                dropFilesActiveHint: t("execution.defect.dropFilesActiveHint"),
              }}
              onFilesRejected={(rejectedFiles) => {
                for (const file of rejectedFiles) {
                  toast.error(t("execution.defect.fileRejected", { name: file.name }));
                }
              }}
              onDuplicateFiles={(duplicateFiles) => {
                for (const file of duplicateFiles) {
                  toast.error(t("execution.defect.fileDuplicate", { name: file.name }));
                }
              }}
              onCaptureResult={(result) => {
                if (result === "added") {
                  toast.success(t("execution.defect.captureAdded"));
                } else if (result === "unsupported") {
                  toast.error(t("execution.defect.captureUnsupported"));
                } else {
                  toast.error(t("execution.defect.captureFailed"));
                }
              }}
            />
          </div>

          {submitPhase === "uploading" ? (
            <p className="text-xs text-muted-foreground">
              {t("execution.defect.uploadProgress", {
                current: uploadIndex,
                total: files.length,
              })}
            </p>
          ) : null}

        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy || !canCreateArtifact || !defectParentId}
          >
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t("execution.defect.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
