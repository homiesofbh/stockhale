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

export function canAccessAttachment(member: { role: string; modules: string[] }, store: { expenses: { attachments?: { key: string }[] }[]; purchases: { attachments?: { key: string }[] }[] }, key: string) {
  const parts = key.split("/");
  if (parts.length !== 4 || !parts.every(Boolean)) return false;
  const [, type] = parts;
  if (type === "expense") return (member.role === "owner" || member.modules.includes("Expenses")) && store.expenses.some(record => record.attachments?.some(item => item.key === key));
  if (type === "purchase") return (member.role === "owner" || member.modules.includes("Purchases")) && store.purchases.some(record => record.attachments?.some(item => item.key === key));
  return false;
}

export function canUploadAttachment(store: { expenses: { attachments?: { key: string }[] }[]; purchases: { attachments?: { key: string }[] }[] }, workspaceId: string, type: "expense" | "purchase", recordId: string, attachmentId: string) {
  const records = type === "expense" ? store.expenses : store.purchases;
  const key = attachmentKey(workspaceId, type, recordId, attachmentId);
  return !records.some(record => record.attachments?.some(item => item.key === key));
}

export function canDeleteAttachment(member: { role: string; modules: string[] }, store: { expenses: { attachments?: { key: string }[] }[]; purchases: { attachments?: { key: string }[] }[] }, workspaceId: string, key: string) {
  const parts = key.split("/");
  if (parts.length !== 4 || !parts.every(Boolean) || parts[0] !== workspaceId) return false;
  const type = parts[1];
  const records = type === "expense" ? store.expenses : type === "purchase" ? store.purchases : null;
  const module = type === "expense" ? "Expenses" : type === "purchase" ? "Purchases" : null;
  if (!records || !module || (member.role !== "owner" && !member.modules.includes(module))) return false;
  const attached = records.some(record => record.attachments?.some(item => item.key === key));
  return !attached || member.role === "owner";
}
