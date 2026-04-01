import { Download, FileText, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AttachmentComposer } from "../../../shared/components/attachments";
import { Skeleton, TabsContent } from "../../../shared/components/ui";
import type { Attachment } from "../../../shared/api/attachmentApi";

interface ArtifactDetailAttachmentsProps {
  attachments: Attachment[];
  attachmentsLoading: boolean;
  onDownload: (attachment: Attachment) => void | Promise<void>;
  onDelete: (attachment: Attachment) => void;
  onUpload: (files: File[]) => void;
  onRejectedFiles?: (files: File[]) => void;
  onDuplicateFiles?: (files: File[]) => void;
  onCaptureResult?: (result: "added" | "failed" | "unsupported") => void;
}

export function ArtifactDetailAttachments({
  attachments,
  attachmentsLoading,
  onDownload,
  onDelete,
  onUpload,
  onRejectedFiles,
  onDuplicateFiles,
  onCaptureResult,
}: ArtifactDetailAttachmentsProps) {
  const { t } = useTranslation("quality");

  return (
    <TabsContent value="attachments" className="py-2">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{t("backlogAttachments.title")}</p>
      {attachmentsLoading ? (
        <Skeleton className="h-16 rounded-md" />
      ) : (
        <>
          <ul className="space-y-2">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-2 py-1">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{attachment.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(attachment.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                    aria-label={t("backlogAttachments.downloadAria")}
                    onClick={() => void onDownload(attachment)}
                  >
                    <Download className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-md text-destructive hover:bg-muted"
                    aria-label={t("backlogAttachments.deleteAria")}
                    onClick={() => onDelete(attachment)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <AttachmentComposer
            className="mt-2 space-y-2"
            files={[]}
            onFilesChange={() => undefined}
            onAddFiles={onUpload}
            labels={{
              addFiles: t("backlogAttachments.uploadFile"),
              captureScreen: t("backlogAttachments.captureScreen"),
              clipboardShortcut: t("backlogAttachments.clipboardShortcut"),
              removeFile: t("backlogAttachments.removeFile"),
              pasteHint: t("backlogAttachments.pasteHint"),
              dropFilesHint: t("backlogAttachments.dropFilesHint"),
              dropFilesActiveHint: t("backlogAttachments.dropFilesActiveHint"),
            }}
            onFilesRejected={onRejectedFiles}
            onDuplicateFiles={onDuplicateFiles}
            onCaptureResult={onCaptureResult}
          />
        </>
      )}
    </TabsContent>
  );
}
