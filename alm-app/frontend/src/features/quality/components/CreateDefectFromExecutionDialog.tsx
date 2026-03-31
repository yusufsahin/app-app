import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Clipboard, Loader2, Paperclip, X } from "lucide-react";
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
import { toast } from "sonner";
import { isDefectAttachmentFileAllowed } from "../lib/defectAttachmentRules";
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

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription(defaultDescription);
      setFiles([]);
      setSubmitPhase("idle");
      setUploadIndex(0);
    }
  }, [open, defaultTitle, defaultDescription]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const next: File[] = [];
    for (const f of Array.from(incoming)) {
      if (!isDefectAttachmentFileAllowed(f)) {
        toast.error(t("execution.defect.fileRejected", { name: f.name }));
        continue;
      }
      next.push(f);
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  }, [t]);

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it?.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles],
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const captureScreenshot = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      toast.error(t("execution.defect.captureUnsupported"));
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        toast.error(t("execution.defect.captureFailed"));
        return;
      }
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve(undefined);
        else video.onloadeddata = () => resolve(undefined);
      });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        toast.error(t("execution.defect.captureFailed"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        toast.error(t("execution.defect.captureFailed"));
        return;
      }
      const safeStep = stepContext?.stepNumber != null ? `step-${stepContext.stepNumber}` : "step";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = new File([blob], `manual-runner-${safeStep}-${timestamp}.png`, { type: "image/png" });
      addFiles([file]);
      toast.success(t("execution.defect.captureAdded"));
    } catch {
      toast.error(t("execution.defect.captureFailed"));
    } finally {
      stream?.getTracks().forEach((item) => item.stop());
    }
  }, [addFiles, stepContext?.stepNumber, t]);

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
    onOpenChange(false);
    setSubmitPhase("idle");
  };

  const busy =
    submitPhase === "creating" || submitPhase === "linking" || submitPhase === "uploading";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" onPaste={onPaste}>
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
          <p className="text-xs text-muted-foreground">{t("execution.defect.pasteHint")}</p>

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
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={busy} asChild>
                <label htmlFor="defect-attachments-input" className="cursor-pointer">
                  <Paperclip className="mr-1 inline size-4" />
                  {t("execution.defect.addFiles")}
                  <input
                    id="defect-attachments-input"
                    type="file"
                    className="sr-only"
                    multiple
                    accept="image/*,application/pdf"
                    aria-label={t("execution.defect.addFiles")}
                    onChange={(e) => {
                      if (e.target.files?.length) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void captureScreenshot()}>
                <Camera className="mr-1 size-4" />
                {t("execution.defect.captureScreen")}
              </Button>
              <div className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
                <Clipboard className="size-3.5" />
                {t("execution.defect.clipboardShortcut")}
              </div>
            </div>
            {files.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {files.map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded border bg-muted/40 px-2 py-1"
                  >
                    <span className="truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-8 shrink-0 p-0"
                      onClick={() => removeFile(idx)}
                      disabled={busy}
                      aria-label={t("execution.defect.removeFile")}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
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
