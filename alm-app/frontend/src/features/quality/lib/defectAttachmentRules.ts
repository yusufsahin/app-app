/** Backward-compatible re-export for defect attachment validation. */

export {
  ATTACHMENT_MAX_BYTES as DEFECT_ATTACHMENT_MAX_BYTES,
  extensionAllowedForAttachment as extensionAllowedForDefectAttachment,
  isAttachmentFileAllowed as isDefectAttachmentFileAllowed,
} from "../../../shared/components/attachments/attachmentRules";
