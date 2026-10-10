export const ATTACHMENT_BUCKET = "invoices";
export const MAX_ATTACHMENT_BYTES = 5_000_000;
export const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export function validateAttachment(file: { name: string; type: string; size: number }) {
  if (!file.name.trim() || file.name.length > 180) throw new Error("Attachment name is invalid.");
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type as typeof ALLOWED_ATTACHMENT_TYPES[number])) throw new Error("Use a PDF, JPG, PNG, or WEBP attachment.");
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) throw new Error("Attachments must be between 1 byte and 5 MB.");
}

export function attachmentKey(workspaceId: string, recordType: "expense" | "purchase", recordId: string, attachmentId: string) {
  return `${workspaceId}/${recordType}/${recordId}/${attachmentId}`;
}
