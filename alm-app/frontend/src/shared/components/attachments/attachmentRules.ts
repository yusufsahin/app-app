/** Shared limits and rules for artifact attachments. */

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

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

export function extensionAllowedForAttachment(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/** Whether a browser File may be staged for artifact attachment upload. */
export function isAttachmentFileAllowed(file: File): boolean {
  if (file.size > ATTACHMENT_MAX_BYTES) return false;
  const type = (file.type || "").toLowerCase();
  if (ALLOWED_MIME_PREFIXES.some((prefix) => type.startsWith(prefix))) return true;
  if ((type === "" || type === "application/octet-stream") && extensionAllowedForAttachment(file.name)) {
    return true;
  }
  return false;
}
