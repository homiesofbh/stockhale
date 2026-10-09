import type { Audit } from "./workspace";
import type { Store } from "./model";
import { validateStore } from "./operation-validation";
import { validateAccounts } from "./accounts";
import { validateJournals } from "./journals";
import { validateBanks } from "./bank-vouchers";
export type RecoveryBackup = { format: "stockwell-backup"; version: 1; workspaceId: string; workspaceName: string; revision: number; exportedAt: string; store: Store; audit: Audit[]; checksum: string };
export function recoveryContent(b: Omit<RecoveryBackup, "checksum"> | RecoveryBackup) {
  return JSON.stringify({ format: b.format, version: b.version, workspaceId: b.workspaceId, workspaceName: b.workspaceName, revision: b.revision, exportedAt: b.exportedAt, store: b.store, audit: b.audit });
}
export async function backupChecksum(b: Omit<RecoveryBackup, "checksum"> | RecoveryBackup) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(recoveryContent(b)));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
export async function validateRecoveryBackup(b: RecoveryBackup, workspaceId: string) {
  if (!b || b.format !== "stockwell-backup" || b.version !== 1 || b.workspaceId !== workspaceId || !Number.isInteger(b.revision) || b.revision < 0 || !Number.isFinite(Date.parse(b.exportedAt)) || typeof b.workspaceName !== "string") throw new Error("This is not a supported backup for this workspace.");
  if (!Array.isArray(b.audit) || b.audit.some(a => !a || [a.id, a.actor, a.module, a.action, a.records, a.occurredAt, a.receivedAt, a.emailStatus].some(v => typeof v !== "string") || !Number.isFinite(Date.parse(a.occurredAt)) || !Number.isFinite(Date.parse(a.receivedAt)))) throw new Error("Invalid backup audit history.");
  if (new Set(b.audit.map(a => a.id)).size !== b.audit.length) throw new Error("Duplicate audit events in backup.");
  if (typeof b.checksum !== "string" || b.checksum !== await backupChecksum(b)) throw new Error("Backup checksum failed. The file is incomplete or has changed.");
  const keys = ["version", "products", "categories", "customers", "suppliers", "heads", "accounts", "journals", "bankVouchers", "corrections", "walkInLinks", "chequeEvents", "dailyCloses", "expenseCategories", "purchases", "invoices", "movements", "payments", "expenses", "returns", "financialAccounts", "units", "partners"];
  if (Object.keys(b.store).some(k => !keys.includes(k) || k !== "version" && !Array.isArray((b.store as any)[k]))) throw new Error("Invalid backup collections.");
  for (const record of [...b.store.expenses, ...b.store.invoices, ...b.store.purchases]) for (const attachment of record.attachments || []) {
    if (!attachment || typeof attachment.id !== "string" || typeof attachment.key !== "string" || !attachment.key.startsWith(`${workspaceId}/`) || typeof attachment.name !== "string" || typeof attachment.contentType !== "string" || !Number.isInteger(attachment.size) || attachment.size <= 0 || attachment.size > 5_000_000 || !["pending", "uploaded", "failed"].includes(attachment.status)) throw new Error("Invalid attachment metadata in backup.");
  }
  validateStore(b.store); validateAccounts(b.store); validateJournals(b.store); validateBanks(b.store);
  return b;
}
export async function readRecoveryFile(file: File, workspaceId: string): Promise<RecoveryBackup> {
  if (file.size > 45_000_000) throw new Error("Backup exceeds the 45 MB restore limit.");
  let backup: RecoveryBackup;
  if (/\.xlsx$/i.test(file.name)) {
    const { Workbook } = await import("exceljs"), book = new Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.getWorksheet("Backup snapshot");
    if (!sheet) throw new Error("Missing lossless Backup snapshot sheet.");
    let raw = ""; sheet.eachRow((row, n) => { if (n > 1) raw += String(row.getCell(2).value || ""); });
    backup = JSON.parse(raw).recovery;
  } else backup = JSON.parse(await file.text());
  return validateRecoveryBackup(backup, workspaceId);
}
