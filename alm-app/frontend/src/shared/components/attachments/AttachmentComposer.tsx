import { useEffect, useMemo, useState, type ClipboardEvent, type DragEvent } from "react";
import { Camera, Clipboard, Paperclip, X } from "lucide-react";
import { cn, Button } from "../ui";
import { isAttachmentFileAllowed } from "./attachmentRules";
import { getClipboardImageFiles } from "./useClipboardImagePaste";
import { captureScreenshotFile } from "./useScreenshotCapture";

export type AttachmentComposerLabels = {
  addFiles: string;
  captureScreen: string;
  clipboardShortcut: string;
  removeFile: string;
  pasteHint?: string;
  dropFilesHint?: string;
  dropFilesActiveHint?: string;
};

export type AttachmentComposerProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onAddFiles?: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  allowScreenshot?: boolean;
  allowPaste?: boolean;
  labels: AttachmentComposerLabels;
  fileInputId?: string;
  captureFileNamePrefix?: string;
  onFilesRejected?: (files: File[]) => void;
  onDuplicateFiles?: (files: File[]) => void;
  onCaptureResult?: (result: "added" | "failed" | "unsupported") => void;
  className?: string;
};

function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.type}`;
}

function mergeAcceptedFiles(
  currentFiles: File[],
  incomingFiles: File[] | FileList,
): { nextFiles: File[]; rejectedFiles: File[]; duplicateFiles: File[]; addedCount: number } {
  const nextFiles = [...currentFiles];
  const rejectedFiles: File[] = [];
  const duplicateFiles: File[] = [];
  let addedCount = 0;
  const existingKeys = new Set(currentFiles.map(fileKey));

  for (const file of Array.from(incomingFiles)) {
    if (!isAttachmentFileAllowed(file)) {
      rejectedFiles.push(file);
      continue;
    }
    const key = fileKey(file);
    if (existingKeys.has(key)) {
      duplicateFiles.push(file);
      continue;
    }
    existingKeys.add(key);
    nextFiles.push(file);
    addedCount += 1;
  }

  return { nextFiles, rejectedFiles, duplicateFiles, addedCount };
}

export function AttachmentComposer({
  files,
  onFilesChange,
  onAddFiles,
  disabled = false,
  accept = "image/*,application/pdf",
  allowScreenshot = true,
  allowPaste = true,
  labels,
  fileInputId = "attachment-composer-input",
  captureFileNamePrefix = "screenshot",
  onFilesRejected,
  onDuplicateFiles,
  onCaptureResult,
  className,
}: AttachmentComposerProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const addFiles = (incomingFiles: File[] | FileList) => {
    const { nextFiles, rejectedFiles, duplicateFiles, addedCount } = mergeAcceptedFiles(files, incomingFiles);
    if (rejectedFiles.length) onFilesRejected?.(rejectedFiles);
    if (duplicateFiles.length) onDuplicateFiles?.(duplicateFiles);
    if (addedCount > 0) {
      const acceptedFiles = nextFiles.slice(files.length);
      onFilesChange(nextFiles);
      onAddFiles?.(acceptedFiles);
    }
    return addedCount;
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  const previewUrls = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      for (const preview of previewUrls) {
        if (preview.url) URL.revokeObjectURL(preview.url);
      }
    };
  }, [previewUrls]);

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled || !allowPaste) return;
    const pastedFiles = getClipboardImageFiles(event.clipboardData?.items);
    if (!pastedFiles.length) return;
    event.preventDefault();
    addFiles(pastedFiles);
  };

  const handleCapture = async () => {
    if (disabled || !allowScreenshot) return;
    try {
      const file = await captureScreenshotFile({ fileNamePrefix: captureFileNamePrefix });
      const addedCount = addFiles([file]);
      onCaptureResult?.(addedCount > 0 ? "added" : "failed");
    } catch (error) {
      if (error instanceof Error && error.message === "SCREEN_CAPTURE_UNSUPPORTED") {
        onCaptureResult?.("unsupported");
        return;
      }
      onCaptureResult?.("failed");
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    setIsDragActive(false);
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles?.length) addFiles(droppedFiles);
  };

  return (
    <div
      data-testid="attachment-composer-dropzone"
      className={cn(
        "rounded-md border border-dashed border-border/70 p-3 transition-colors",
        isDragActive && "border-primary bg-primary/5",
        disabled && "opacity-70",
        className,
      )}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {labels.pasteHint ? <p className="text-xs text-muted-foreground">{labels.pasteHint}</p> : null}
      {labels.dropFilesHint || labels.dropFilesActiveHint ? (
        <p className="text-xs text-muted-foreground">
          {isDragActive ? labels.dropFilesActiveHint ?? labels.dropFilesHint : labels.dropFilesHint}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} asChild>
          <label htmlFor={fileInputId} className="cursor-pointer">
            <Paperclip className="mr-1 inline size-4" />
            {labels.addFiles}
            <input
              id={fileInputId}
              type="file"
              className="sr-only"
              multiple
              accept={accept}
              aria-label={labels.addFiles}
              onChange={(event) => {
                if (event.target.files?.length) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </Button>
        {allowScreenshot ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void handleCapture()}>
            <Camera className="mr-1 size-4" />
            {labels.captureScreen}
          </Button>
        ) : null}
        {allowPaste ? (
          <div className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
            <Clipboard className="size-3.5" />
            {labels.clipboardShortcut}
          </div>
        ) : null}
      </div>
      {files.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {previewUrls.map(({ file, url }, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded border bg-muted/40 px-2 py-1"
            >
              <div className="flex min-w-0 items-center gap-2">
                {url ? (
                  <img
                    src={url}
                    alt={file.name}
                    className="size-10 shrink-0 rounded object-cover ring-1 ring-border/60"
                  />
                ) : null}
                <span className="truncate">{file.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 shrink-0 p-0"
                onClick={() => removeFile(index)}
                disabled={disabled}
                aria-label={labels.removeFile}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
