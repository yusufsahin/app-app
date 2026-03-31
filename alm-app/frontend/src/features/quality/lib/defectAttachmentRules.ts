/** Limits and rules for files attached when creating a defect from manual execution. */

export const DEFECT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".pdf",
]);

export function extensionAllowedForDefectAttachment(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/** Whether a browser File may be staged for defect attachment upload. */
export function isDefectAttachmentFileAllowed(file: File): boolean {
  if (file.size > DEFECT_ATTACHMENT_MAX_BYTES) return false;
  const type = (file.type || "").toLowerCase();
  if (ALLOWED_MIME_PREFIXES.some((p) => type.startsWith(p))) return true;
  if ((type === "" || type === "application/octet-stream") && extensionAllowedForDefectAttachment(file.name)) {
    return true;
  }
  return false;
}
